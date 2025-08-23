"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { getBrowserSupabaseClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/database.types";
import { ScrollArea } from "@/components/ui/scroll-area";

type ActionLogRow = Database["public"]["Tables"]["action_logs"]["Row"];

let supabase: ReturnType<typeof getBrowserSupabaseClient> | null = null;
if (typeof window !== 'undefined') {
  supabase = getBrowserSupabaseClient();
}

const TYPES: ActionLogRow["type"][] = [
  "screen_capture_analyze",
  "summary_10min",
  "summary_1hour",
  "summary_12hour",
  "summary_24hour",
  "summary_1week",
  "custom",
];

function toTime(iso?: string | null) {
  if (!iso) return "";
  try { return new Date(iso).toLocaleTimeString(); } catch { return ""; }
}

export default function LiveActionLogs() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<ActionLogRow[]>([]);

  useEffect(() => {
    if (!user?.id || !supabase) return;

    let cancel = false;
    async function init() {
      // load latest 50
      const { data } = await supabase!
        .from("action_logs")
        .select("*")
        .eq("user_id", user!.id)
        .in("type", TYPES)
        .order("created_at", { ascending: false })
        .limit(50);
      if (!cancel) setLogs(data ?? []);

      // subscribe to inserts
      const channel = supabase!
        .channel("action_logs_live")
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "action_logs", filter: `user_id=eq.${user!.id}` }, (payload) => {
          const row = payload.new as ActionLogRow;
          if (!TYPES.includes(row.type)) return;
          setLogs((prev) => [row, ...prev].slice(0, 200));
        })
        .subscribe();

      return () => { supabase!.removeChannel(channel); };
    }

    const cleanup = init();
    return () => { cancel = true; void cleanup; };
  }, [user]);

  const grouped = useMemo(() => {
    // group by 10-minute buckets
    const BUCKET_MS = 10 * 60 * 1000;
    const map = new Map<string, ActionLogRow[]>();
    for (const l of logs) {
      const when = l.created_at ? new Date(l.created_at) : new Date();
      const bucketStartMs = Math.floor(when.getTime() / BUCKET_MS) * BUCKET_MS;
      const key = new Date(bucketStartMs).toISOString();
      const arr = map.get(key) || [];
      arr.push(l);
      map.set(key, arr);
    }
    // sort logs within each bucket by time DESC, and buckets DESC
    const entries = Array.from(map.entries());
    entries.forEach(([, arr]) => arr.sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? '')));
    return entries.sort((a, b) => (a[0] > b[0] ? -1 : 1));
  }, [logs]);

  return (
    <ScrollArea className="h-[60vh] overflow-y-auto p-3">
      <div className="space-y-4">
        {grouped.map(([iso, items]) => {
          const start = new Date(iso);
          const end = new Date(start.getTime() + 10 * 60 * 1000);
          return (
          <div key={iso}>
            <div className="text-xs font-medium text-gray-600 mb-1">
              {start.toLocaleString()} - {end.toLocaleTimeString()}
            </div>
            <ul className="space-y-2">
              {items.map((l) => (
                <li key={l.id} className="text-xs border rounded p-2 bg-gray-50">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-gray-500">{toTime(l.created_at)}</span>
                    <span className="px-1 py-0.5 bg-blue-100 text-blue-800 rounded text-xs">{l.type}</span>
                  </div>
                  <div className="text-gray-800">{l.summary || "(no summary)"}</div>
                  {l.tags && l.tags.length > 0 && (
                    <div className="flex gap-1 mt-1">
                      {l.tags.map((tag, i) => (
                        <span key={i} className="px-1 py-0.5 bg-green-100 text-green-700 rounded text-xs">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}


