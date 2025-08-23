"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { getBrowserSupabaseClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/database.types";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import Image from 'next/image';

type ActionLogRow = Database["public"]["Tables"]["action_logs"]["Row"];
type ImageRow = Database["public"]["Tables"]["images"]["Row"];

let supabase: ReturnType<typeof getBrowserSupabaseClient> | null = null;
if (typeof window !== 'undefined') {
  supabase = getBrowserSupabaseClient();
}

// Include summaries and child events for grouping
const SUMMARY_TYPE: ActionLogRow["type"] = "summary_10min";
const CHILD_TYPES: ActionLogRow["type"][] = ["screen_capture_analyze"];
// Note: Live list fetches summaries and children separately

function toTime(iso?: string | null) {
  if (!iso) return "";
  try { return new Date(iso).toLocaleTimeString(); } catch { return ""; }
}

export default function LiveActionLogs() {
  const { user } = useAuth();
  const [summaries, setSummaries] = useState<ActionLogRow[]>([]);
  const [events, setEvents] = useState<ActionLogRow[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [imagesByAction, setImagesByAction] = useState<Record<string, Array<ImageRow & { url: string }>>>({});
  const [expandedSummaries, setExpandedSummaries] = useState<Set<string>>(() => new Set());
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(() => new Set());
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
      // Load summaries and recent child events
      const [summRes, evtRes] = await Promise.all([
        supabase!
          .from("action_logs")
          .select("*")
          .eq("user_id", user!.id)
          .eq("type", SUMMARY_TYPE)
          .order("started_at", { ascending: false })
          .limit(50),
        supabase!
          .from("action_logs")
          .select("*")
          .eq("user_id", user!.id)
          .in("type", CHILD_TYPES)
          .order("created_at", { ascending: false })
          .limit(500),
      ]);
      if (!cancel) {
        setSummaries(summRes.data ?? []);
        setEvents(evtRes.data ?? []);
      }
      setLoading(false);

      // Subscribe to inserts and updates for real-time changes
      const channel = supabase!
        .channel("action_logs_live")
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "action_logs", filter: `user_id=eq.${user!.id}` }, (payload) => {
          const row = payload.new as ActionLogRow;
          if (row.type === SUMMARY_TYPE) {
            setSummaries((prev) => {
              const exists = prev.findIndex((p) => p.id === row.id) !== -1;
              const next = exists ? prev : [row, ...prev];
              return next
                .slice()
                .sort((a, b) => (b.started_at ?? '').localeCompare(a.started_at ?? ''))
                .slice(0, 100);
            });
          } else if (CHILD_TYPES.includes(row.type)) {
            setEvents((prev) => {
              const exists = prev.findIndex((p) => p.id === row.id) !== -1;
              const next = exists ? prev : [row, ...prev];
              return next.slice(0, 1000);
            });
          }
        })
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "action_logs", filter: `user_id=eq.${user!.id}` }, (payload) => {
          const row = payload.new as ActionLogRow;
          if (row.type === SUMMARY_TYPE) {
            setSummaries((prev) => {
              const idx = prev.findIndex((p) => p.id === row.id);
              if (idx === -1) return prev;
              const copy = prev.slice();
              copy[idx] = row;
              return copy
                .slice()
                .sort((a, b) => (b.started_at ?? '').localeCompare(a.started_at ?? ''));
            });
          } else if (CHILD_TYPES.includes(row.type)) {
            setEvents((prev) => {
              const idx = prev.findIndex((p) => p.id === row.id);
              if (idx === -1) return prev;
              const copy = prev.slice();
              copy[idx] = row;
              return copy;
            });
          }
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
      const [summRes, evtRes] = await Promise.all([
        supabase
          .from("action_logs")
          .select("*")
          .eq("user_id", user.id)
          .eq("type", SUMMARY_TYPE)
          .order("started_at", { ascending: false })
          .limit(50),
        supabase
          .from("action_logs")
          .select("*")
          .eq("user_id", user.id)
          .in("type", CHILD_TYPES)
          .order("created_at", { ascending: false })
          .limit(500),
      ]);
      setSummaries(summRes.data ?? []);
      setEvents(evtRes.data ?? []);
    } finally {
      setLoading(false);
    }
  }

  // Load screenshots for current event set
  useEffect(() => {
    if (!supabase) return;
    const ids = events.map((e) => e.id).filter(Boolean) as string[];
    if (ids.length === 0) {
      setImagesByAction({});
      return;
    }
    let cancel = false;
    (async () => {
      const { data: imgs } = await supabase!
        .from("images")
        .select("*")
        .in("action_log_id", ids);
      if (cancel) return;
      const map: Record<string, Array<ImageRow & { url: string }>> = {};
      for (const img of (imgs ?? []) as ImageRow[]) {
        const { data: pub } = supabase!.storage.from("captures").getPublicUrl(img.storage_path);
        const withUrl = { ...img, url: pub.publicUrl } as ImageRow & { url: string };
        const key = img.action_log_id || "";
        if (!map[key]) map[key] = [];
        map[key].push(withUrl);
      }
      setImagesByAction(map);
    })();
    return () => { cancel = true; };
  }, [events]);

  function truncate(text: string, max = 200): string {
    if (!text) return "";
    return text.length > max ? text.slice(0, max) + "…" : text;
  }

  const grouped = useMemo(() => {
    // Group child events into each summary window using started_at/ended_at
    const groups: Array<{ iso: string; start: Date; end: Date; items: ActionLogRow[]; summary?: ActionLogRow }> = [];
    const sortedSumm = summaries.slice().sort((a, b) => (b.started_at ?? '').localeCompare(a.started_at ?? ''));
    const evts = events.slice();
    for (const s of sortedSumm) {
      const startISO = s.started_at ?? s.created_at ?? new Date().toISOString();
      const endISO = s.ended_at ?? new Date(new Date(startISO).getTime() + 10 * 60 * 1000).toISOString();
      const start = new Date(startISO);
      const end = new Date(endISO);
      const items = evts.filter((e) => {
        const t = e.created_at ? new Date(e.created_at).getTime() : 0;
        return t >= start.getTime() && t <= end.getTime();
      }).sort((a, b) => (a.created_at ?? '').localeCompare(b.created_at ?? ''));
      groups.push({ iso: start.toISOString(), start, end, items, summary: s });
    }
    return groups;
  }, [summaries, events]);

  const flat = useMemo(() => {
    return [...summaries, ...events]
      .slice()
      .sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''));
  }, [summaries, events]);

  return (
    <div className="h-[60vh] flex flex-col">
      <div className="flex items-center justify-between px-3 py-2 border-b bg-white/60">
        <div className="text-xs text-gray-600">
          {grouping ? "Grouped by summary window" : "Latest events"}
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
            {grouped.map(({ iso, start, end, items, summary }) => {
              return (
                <div key={iso}>
                  <div className="text-xs font-medium text-gray-600 mb-1">
                    {start.toLocaleString()} - {end.toLocaleTimeString()}
                  </div>
                  {summary ? (
                    <div className="text-xs border rounded p-2 bg-blue-50 mb-2">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-gray-500">{toTime(summary.created_at)}</span>
                        <span className="px-1 py-0.5 bg-purple-100 text-purple-800 rounded text-xs">summary_10min</span>
                      </div>
                      <div className="text-gray-800 whitespace-pre-wrap">
                        {expandedSummaries.has(summary.id)
                          ? (summary.summary || "(no summary)")
                          : truncate(summary.summary || "", 220)}
                      </div>
                      {(summary.summary && summary.summary.length > 220) && (
                        <button
                          className="mt-1 underline text-blue-700"
                          onClick={() => {
                            setExpandedSummaries((prev) => {
                              const next = new Set(prev);
                              if (next.has(summary.id)) next.delete(summary.id); else next.add(summary.id);
                              return next;
                            });
                          }}
                        >
                          {expandedSummaries.has(summary.id) ? "Read less" : "Read more"}
                        </button>
                      )}
                    </div>
                  ) : null}
                  <ul className="space-y-2">
                    {items.map((l) => (
                      <li key={l.id} className="text-xs border rounded p-2 bg-gray-50">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-gray-500">{toTime(l.created_at)}</span>
                          <span className="px-1 py-0.5 bg-blue-100 text-blue-800 rounded text-xs">{l.type}</span>
                        </div>
                        <div className="text-gray-800 whitespace-pre-wrap">
                          {expandedEvents.has(l.id)
                            ? (l.summary || "(no summary)")
                            : truncate(l.summary || "", 200)}
                        </div>
                        {(l.summary && l.summary.length > 200) && (
                          <button
                            className="mt-1 underline text-blue-700"
                            onClick={() => {
                              setExpandedEvents((prev) => {
                                const next = new Set(prev);
                                if (next.has(l.id)) next.delete(l.id); else next.add(l.id);
                                return next;
                              });
                            }}
                          >
                            {expandedEvents.has(l.id) ? "Read less" : "Read more"}
                          </button>
                        )}
                        {imagesByAction[l.id]?.length ? (
                          <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                            {imagesByAction[l.id].map((img) => (
                              <a key={img.id} href={img.url} target="_blank" rel="noreferrer" className="block">
                                <Image
                                  src={img.url}
                                  alt={img.storage_path}
                                  width={200}
                                  height={96}
                                  className="w-full h-24 object-cover rounded border"
                                />
                              </a>
                            ))}
                          </div>
                        ) : null}
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


