import { defineConfig, schedules } from "@trigger.dev/sdk/v3";
import { createClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/supabase/database.types";
import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";
import { generateLogSummaryEmbedding } from "@/lib/ai/embedding";

const supabase = createClient<Database>(
	process.env.NEXT_PUBLIC_SUPABASE_URL!,
	process.env.SUPABASE_SERVICE_ROLE_KEY!,
	{
		auth: { persistSession: false, autoRefreshToken: false },
		global: { headers: { "x-worker": "trigger" } },
	},
);

type ActionLogRow = Database["public"]["Tables"]["action_logs"]["Row"];

// Simple compression: truncate overly long summaries and mark as compressed
async function compressActionLogsBatch(): Promise<void> {
	const { data, error } = await supabase
		.from("action_logs")
		.select("id, summary, details")
		.order("created_at", { ascending: false })
		.limit(500);
	if (error) throw new Error(error.message);

	const rows = (data ?? []) as ActionLogRow[];
	for (const row of rows) {
		const summary = row.summary;
		if (!summary || summary.length <= 500) continue;
		const compact = summary.slice(0, 480) + "…";
		const details = ((row.details as Json) ?? {}) as Record<string, unknown>;
		(details as Record<string, unknown>).compressed = true;
		await supabase
			.from("action_logs")
			.update({ summary: compact, details: details as unknown as Json })
			.eq("id", row.id);
	}
}

export const compressEvery10m = schedules.task({
	id: "compress-action-logs",
	cron: "*/10 * * * *",
	run: async () => {
		await compressActionLogsBatch();
	},
});

type LogSummaryRowInsert = Database["public"]["Tables"]["log_summary"]["Insert"];

async function summarizeUserRecentLogs(userId: string, sinceISO: string): Promise<void> {
	const { data, error } = await supabase
		.from("action_logs")
		.select("id, summary, type, created_at")
		.eq("user_id", userId)
		.gte("created_at", sinceISO)
		.order("created_at", { ascending: true });
	if (error) throw new Error(error.message);
	const logs = (data ?? []) as Array<Pick<Database["public"]["Tables"]["action_logs"]["Row"], "id" | "summary" | "type" | "created_at">>;
	const withSummary = logs.filter((l) => !!l.summary);
	if (withSummary.length === 0) return;

	const bulletLines = withSummary.map((l) => {
		const time = new Date(l.created_at ?? Date.now()).toISOString().slice(11, 16);
		return `- [${time}] ${l.type}: ${l.summary}`;
	});
	const prompt = [
		"The following are newly recorded user logs from the past 10 minutes.",
		"Please summarize in English, focusing only on important points with a maximum of 5 items, removing duplicates and minor details.",
		"Keep sentences short and as specific as possible. End with a one-line overall summary.",
		"",
		bulletLines.join("\n"),
	].join("\n");

	const { text } = await generateText({
		model: openai("gpt-4o-mini"),
		prompt,
		temperature: 0.3,
	});

	const structured: Json = {
		windowMinutes: 10,
		logCount: withSummary.length,
		firstId: withSummary[0].id,
		lastId: withSummary[withSummary.length - 1].id,
	} as unknown as Json;
	const tags = ["cron", "10min", "auto-summary"];

	let embedding: string | null = null;
	try {
		embedding = await generateLogSummaryEmbedding(text, structured as unknown as Record<string, unknown>, tags);
	} catch {
		embedding = null;
	}

	// Also persist to action_logs as a summary window for later grouping
	await supabase
		.from("action_logs")
		.insert({
			user_id: userId,
			type: "summary_10min",
			summary: text,
			details: structured,
			tags,
			started_at: sinceISO,
			ended_at: new Date().toISOString(),
			embedding,
		});

	const row: LogSummaryRowInsert = {
		user_id: userId,
		summary_text: text,
		structured,
		tags,
		embedding,
	};
	await supabase.from("log_summary").insert([row]);
}

async function summarizeRecentLogsForAllUsers(): Promise<void> {
	const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
	const { data, error } = await supabase
		.from("action_logs")
		.select("user_id")
		.gte("created_at", since);
	if (error) throw new Error(error.message);
	const userIds = Array.from(new Set((data ?? []).map((r) => (r as { user_id: string }).user_id).filter(Boolean)));
	for (const uid of userIds) {
		await summarizeUserRecentLogs(uid, since);
	}
}

export const summarizeEvery10m = schedules.task({
	id: "summarize-recent-logs",
	cron: "*/10 * * * *",
	run: async () => {
		await summarizeRecentLogsForAllUsers();
	},
});

export default defineConfig({
	project: process.env.TRIGGER_PROJECT_ID || "proj_lvhnlycecwelrywprpje",
	maxDuration: 300,
});
