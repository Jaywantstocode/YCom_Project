"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { getBrowserSupabaseClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/database.types";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

type ActionLogRow = Database["public"]["Tables"]["action_logs"]["Row"];
type ImageRow = Database["public"]["Tables"]["images"]["Row"];

let supabase: ReturnType<typeof getBrowserSupabaseClient> | null = null;
if (typeof window !== 'undefined') {
	supabase = getBrowserSupabaseClient();
}

const CHILD_TYPES: ActionLogRow["type"][] = ["screen_capture_analyze"];

type SummaryWithChildren = {
  summary: ActionLogRow; // summary_10min row from action_logs
  children?: {
    logs: ActionLogRow[];
    images: Array<ImageRow & { url: string }>;
  };
  loadingChildren: boolean;
};

function toTimeHM(iso?: string | null): string {
  if (!iso) return "";
  try {
    return new Date(iso).toISOString().slice(11, 16);
  } catch {
    return "";
  }
}

export default function ActionLogViewer() {
  const { user } = useAuth();
  const [items, setItems] = useState<SummaryWithChildren[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  // Load latest summary_10min windows for current user
  useEffect(() => {
    async function load() {
      if (!user?.id) return;
      setLoading(true);
      try {
        if (!supabase) return;
        const { data, error } = await supabase
          .from("action_logs")
          .select("*")
          .eq("user_id", user.id)
          .eq("type", "summary_10min")
          .order("started_at", { ascending: false })
          .limit(24);
        if (error) throw error;
        const list: SummaryWithChildren[] = (data ?? []).map((s) => ({ summary: s as ActionLogRow, loadingChildren: false }));
        setItems(list);
      } catch {
        setItems([]);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [user?.id]);

  async function loadChildren(idx: number) {
    const base = items[idx];
    if (!base || base.loadingChildren) return;
    const s = base.summary;
    const startISO = s.started_at ?? s.created_at ?? new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const endISO = s.ended_at ?? new Date().toISOString();

    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, loadingChildren: true } : it)));
    try {
      // Fetch logs inside this summary window
      if (!supabase) return;
      const { data: logs, error: logErr } = await supabase
        .from("action_logs")
        .select("*")
        .eq("user_id", user!.id)
        .gte("created_at", startISO)
        .lte("created_at", endISO)
        .in("type", CHILD_TYPES)
        .order("created_at", { ascending: true });
      if (logErr) throw logErr;

      const logIds = (logs ?? []).map((l) => l.id);
      let images: Array<ImageRow & { url: string }> = [];
      if (logIds.length > 0) {
        const { data: imgs, error: imgErr } = await supabase
          .from("images")
          .select("*")
          .in("action_log_id", logIds);
        if (imgErr) throw imgErr;
        images = await Promise.all(
          (imgs ?? []).map(async (img) => {
            const { data: pub } = supabase.storage.from("captures").getPublicUrl(img.storage_path);
            return { ...img, url: pub.publicUrl };
          })
        );
      }

      setItems((prev) =>
        prev.map((it, i) => (i === idx ? { ...it, loadingChildren: false, children: { logs: logs ?? [], images } } : it))
      );
    } catch {
      setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, loadingChildren: false } : it)));
    }
  }

  const empty = useMemo(() => !loading && items.length === 0, [loading, items.length]);

  return (
    <div className="space-y-4">
      <div className="text-sm font-medium text-gray-700 mb-2">Action Logs (10 min grouped)</div>
      <div>
          {loading ? (
            <div className="text-sm text-gray-600">Loading...</div>
          ) : empty ? (
            <div className="text-sm text-gray-600">No summaries yet.</div>
          ) : (
            <Accordion type="multiple" className="w-full">
              {items.map((it, idx) => {
                const created = it.summary.created_at ?? undefined;
                const time = created ? new Date(created).toLocaleString() : "";
                const firstLine = (it.summary.summary || "").split("\n")[0]?.slice(0, 120);
                return (
                  <AccordionItem key={it.summary.id} value={it.summary.id}>
                    <AccordionTrigger onClick={() => (!it.children ? loadChildren(idx) : null)}>
                      <div className="flex flex-col items-start text-left">
                        <div className="text-sm font-medium">{time}</div>
                        <div className="text-xs text-gray-600">{firstLine}</div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-4">
                        <div className="text-sm whitespace-pre-wrap">{it.summary.summary}</div>
                        {it.loadingChildren ? (
                          <div className="text-xs text-gray-500">Loading details…</div>
                        ) : it.children ? (
                          <div className="space-y-4">
                            <div>
                              <div className="text-sm font-medium mb-1">Logs</div>
                              <ul className="list-disc pl-5 text-sm space-y-1">
                                {it.children.logs.map((l) => (
                                  <li key={l.id}>
                                    <span className="text-gray-500 mr-2">[{toTimeHM(l.created_at)}]</span>
                                    <span className="mr-2">{l.type}</span>
                                    <span className="text-gray-800">{l.summary || "(no summary)"}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                            <div>
                              <div className="text-sm font-medium mb-2">Screenshots</div>
                              {it.children.images.length === 0 ? (
                                <div className="text-xs text-gray-500">No screenshots in this window.</div>
                              ) : (
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                                  {it.children.images.map((img) => (
                                    <a key={img.id} href={img.url} target="_blank" rel="noreferrer" className="block">
                                      <img
                                        src={img.url}
                                        alt={img.storage_path}
                                        className="w-full h-28 object-cover rounded border"
                                        loading="lazy"
                                      />
                                    </a>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          )}
      </div>
    </div>
  );
}


