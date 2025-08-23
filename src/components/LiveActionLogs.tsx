"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { getBrowserSupabaseClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/database.types";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";

type ActionLogRow = Database["public"]["Tables"]["action_logs"]["Row"];

let supabase: ReturnType<typeof getBrowserSupabaseClient> | null = null;
if (typeof window !== 'undefined') {
  supabase = getBrowserSupabaseClient();
}

// Realtime pane should focus on immediate capture/analysis events only
const TYPES: ActionLogRow["type"][] = ["screen_capture_analyze"];

function toTime(iso?: string | null) {
  if (!iso) return "";
  try { return new Date(iso).toLocaleTimeString(); } catch { return ""; }
}

export default function LiveActionLogs() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<ActionLogRow[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [grouping, setGrouping] = useState<boolean>(() => {
    try {
      if (typeof window === "undefined") return true;
      const raw = window.localStorage.getItem("logs.grouping.v1");
      return raw ? raw === "true" : true;
    } catch {
      return true;
    }
  });

  useEffect(() => {
    if (!user?.id || !supabase) return;

    let cancel = false;
    let cleanup: (() => void) | null = null;

    async function init() {
      setLoading(true);
      // Load a larger recent window to ensure latest visibility
      const { data } = await supabase!
        .from("action_logs")
        .select("*")
        .eq("user_id", user!.id)
        .in("type", TYPES)
        .order("created_at", { ascending: false })
        .limit(200);
      if (!cancel) setLogs(data ?? []);
      setLoading(false);

      // Subscribe to inserts and updates for real-time changes
      const channel = supabase!
        .channel("action_logs_live")
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "action_logs", filter: `user_id=eq.${user!.id}` }, (payload) => {
          const row = payload.new as ActionLogRow;
          if (!TYPES.includes(row.type)) return;
          // Deduplicate on id; add newest to top
          setLogs((prev) => {
            const exists = prev.findIndex((p) => p.id === row.id) !== -1;
            const next = exists ? prev : [row, ...prev];
            return next.slice(0, 300);
          });
        })
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "action_logs", filter: `user_id=eq.${user!.id}` }, (payload) => {
          const row = payload.new as ActionLogRow;
          if (!TYPES.includes(row.type)) return;
          // Update existing row in place to reflect latest summary/details
          setLogs((prev) => {
            const idx = prev.findIndex((p) => p.id === row.id);
            if (idx === -1) return prev;
            const copy = prev.slice();
            copy[idx] = row;
            return copy;
          });
        })
        .subscribe();

      cleanup = () => { supabase!.removeChannel(channel); };
    }

    init();
    return () => { 
      cancel = true; 
      if (cleanup) cleanup();
    };
  }, [user]);

  // Persist grouping preference
  useEffect(() => {
    try {
      if (typeof window !== "undefined") {
        window.localStorage.setItem("logs.grouping.v1", String(grouping));
      }
    } catch {}
  }, [grouping]);

  // Manual refetch
  async function refetch() {
    if (!user?.id || !supabase) return;
    setLoading(true);
    try {
      const { data } = await supabase
        .from("action_logs")
        .select("*")
        .eq("user_id", user.id)
        .in("type", TYPES)
        .order("created_at", { ascending: false })
        .limit(200);
      setLogs(data ?? []);
    } finally {
      setLoading(false);
    }
  }

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

  const flat = useMemo(() => {
    return logs
      .slice()
      .sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''));
  }, [logs]);

  return (
    <div className="h-[60vh] flex flex-col">
      <div className="flex items-center justify-between px-3 py-2 border-b bg-white/60">
        <div className="text-xs text-gray-600">
          {grouping ? "Grouped by 10 minutes" : "Latest events"}
          {loading ? <span className="ml-2 text-gray-400">Loading…</span> : null}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={refetch} disabled={loading}>
            {loading ? "Loading..." : "Refetch"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setGrouping((v) => !v)}>
            {grouping ? "Ungroup" : "Group"}
          </Button>
        </div>
      </div>
      <ScrollArea className="flex-1 overflow-y-auto p-3">
        {grouping ? (
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
        ) : (
          <ul className="space-y-2">
            {flat.map((l) => (
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
        )}
      </ScrollArea>
    </div>
  );
}


