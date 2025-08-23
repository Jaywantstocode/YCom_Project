import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';
import { getDefaultModel, getModelConfig } from './lm-models';
import { getSupabaseServiceClient } from '../supabase/server';
import { Database } from '../supabase/database.types';

// 時間間隔タイプの定義
export type TimeInterval = '10min' | '1hour' | '1day';

// サマリー集約の入力パラメータ
export interface IntervalSummaryInput {
  userId: string;
  interval: TimeInterval;
  endTime?: Date; // 終了時刻（デフォルトは現在時刻）
}

// サマリー集約の結果
export interface IntervalSummaryResult {
  success: boolean;
  interval: TimeInterval;
  timeRange: {
    start: Date;
    end: Date;
  };
  summary?: string; // シンプルなサマリー文字列のみ
  sourceCount: number; // 集約元のサマリー数
  actionLogId?: string;
  error?: string;
}

// Zod schema for structured output - サマリのみ
const IntervalSummarySchema = z.object({
  description: z.string().describe("Overall summary of activities during this time period")
});

// Type definition for action_logs table
type ActionLogInsert = Database['public']['Tables']['action_logs']['Insert'];

/**
 * 時間間隔に基づいて開始時刻を計算
 */
function calculateStartTime(endTime: Date, interval: TimeInterval): Date {
  const start = new Date(endTime);
  
  switch (interval) {
    case '10min':
      start.setMinutes(start.getMinutes() - 10);
      break;
    case '1hour':
      start.setHours(start.getHours() - 1);
      break;
    case '1day':
      start.setDate(start.getDate() - 1);
      break;
  }
  
  return start;
}

/**
 * データベースタイプを時間間隔に基づいて生成
 * summary_XXタイプを使用（データベース制約に合わせる）
 */
function getActionLogType(interval: TimeInterval): string {
  switch (interval) {
    case '10min':
      return 'summary_10min';
    case '1hour':
      return 'summary_1hour';
    case '1day':
      return 'summary_24hour';
  }
}

/**
 * 指定時間範囲のスクリーンキャプチャサマリーを取得
 */
async function getScreenCaptureSummaries(
  userId: string,
  startTime: Date,
  endTime: Date
): Promise<Array<{ id: string; summary: string; started_at: string }>> {
  const supabase = getSupabaseServiceClient();
  
  const { data, error } = await supabase
    .from('action_logs')
    .select('id, summary, started_at')
    .eq('user_id', userId)
    .eq('type', 'screen_capture_analyze')
    .gte('started_at', startTime.toISOString())
    .lte('started_at', endTime.toISOString())
    .not('summary', 'is', null)
    .order('started_at', { ascending: true });

  if (error) {
    console.error('❌ Failed to fetch summaries:', error);
    throw new Error(`Database query failed: ${error.message}`);
  }

  return data || [];
}

/**
 * 時間間隔サマリーをデータベースに保存
 */
async function saveIntervalSummary(
  summaryDescription: string,
  userId: string,
  interval: TimeInterval,
  timeRange: { start: Date; end: Date },
  sourceLogIds: string[]
): Promise<string> {
  const supabase = getSupabaseServiceClient();
  
  // サマリから簡単なタグを生成
  const words = summaryDescription.toLowerCase().split(/\s+/);
  const tags = [
    ...words.filter(word => word.length > 3).slice(0, 5),
    'consolidated',
    interval
  ]
    .filter(item => item.length > 2)
    .slice(0, 10);

  const actionLogData: ActionLogInsert = {
    user_id: userId,
    type: getActionLogType(interval),
    summary: summaryDescription,
    details: {}, // 空のオブジェクト
    source_log_ids: sourceLogIds,
    tags: tags.length > 0 ? tags : null,
    started_at: timeRange.start.toISOString(),
    ended_at: timeRange.end.toISOString()
  };

  const { data, error } = await supabase
    .from('action_logs')
    .insert(actionLogData)
    .select('id')
    .single();

  if (error) {
    console.error('❌ Failed to save interval summary:', error);
    throw new Error(`Database save failed: ${error.message}`);
  }

  console.log(`✅ ${interval} summary saved with ID:`, data.id);
  return data.id;
}

/**
 * 時間間隔サマリーを生成
 */
export async function generateIntervalSummary(input: IntervalSummaryInput): Promise<IntervalSummaryResult> {
  const endTime = input.endTime || new Date();
  const startTime = calculateStartTime(endTime, input.interval);
  
  console.log(`🔬 Generating ${input.interval} summary:`, {
    userId: input.userId,
    timeRange: { start: startTime, end: endTime }
  });

  try {
    // 指定時間範囲のサマリーを取得
    const sourceSummaries = await getScreenCaptureSummaries(input.userId, startTime, endTime);
    
    if (sourceSummaries.length === 0) {
      return {
        success: false,
        interval: input.interval,
        timeRange: { start: startTime, end: endTime },
        sourceCount: 0,
        error: 'No screen capture summaries found for the specified time range'
      };
    }

    console.log(`📊 Found ${sourceSummaries.length} summaries to aggregate`);

    // サマリーテキストを結合
    const combinedSummaries = sourceSummaries
      .map((item, index) => {
        const time = new Date(item.started_at).toLocaleTimeString('ja-JP', { 
          hour: '2-digit', 
          minute: '2-digit' 
        });
        return `[${time}] ${item.summary}`;
      })
      .join('\n');

    // AI モデルの設定 (GPT-5 mini使用)
    const modelId = getDefaultModel('FAST_ANALYSIS');
    const modelConfig = getModelConfig(modelId);
    console.log('🤖 Using model:', { modelId, name: modelConfig?.name });

    // AI を使用して集約サマリーを生成
    const result = await generateObject({
      model: openai(modelId),
      messages: [
        {
          role: "user",
          content: `Analyze the following screen capture summaries from the past ${input.interval} and create an aggregated summary.

Time range: ${startTime.toLocaleString('ja-JP')} - ${endTime.toLocaleString('ja-JP')}

Screen capture summaries:
${combinedSummaries}

Please provide a comprehensive description of the overall activities during this time period.

Respond in English with a clear, concise summary.`
        }
      ],
      schema: IntervalSummarySchema,
      temperature: 0.3,
    });

    console.log('🔍 AI response:', {
      object: result.object,
      usage: result.usage
    });

    // データベースに保存
    const sourceLogIds = sourceSummaries.map(s => s.id);
    const actionLogId = await saveIntervalSummary(
      result.object.description,
      input.userId,
      input.interval,
      { start: startTime, end: endTime },
      sourceLogIds
    );

    return {
      success: true,
      interval: input.interval,
      timeRange: { start: startTime, end: endTime },
      summary: result.object.description,
      sourceCount: sourceSummaries.length,
      actionLogId
    };

  } catch (error) {
    console.error(`❌ ${input.interval} summary generation failed:`, error);
    return {
      success: false,
      interval: input.interval,
      timeRange: { start: startTime, end: endTime },
      sourceCount: 0,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * 10分間隔のサマリーを生成
 */
export async function generate10MinuteSummary(userId: string, endTime?: Date): Promise<IntervalSummaryResult> {
  return generateIntervalSummary({
    userId,
    interval: '10min',
    endTime
  });
}

/**
 * 1時間間隔のサマリーを生成  
 */
export async function generate1HourSummary(userId: string, endTime?: Date): Promise<IntervalSummaryResult> {
  return generateIntervalSummary({
    userId,
    interval: '1hour', 
    endTime
  });
}

/**
 * 1日間隔のサマリーを生成
 */
export async function generate1DaySummary(userId: string, endTime?: Date): Promise<IntervalSummaryResult> {
  return generateIntervalSummary({
    userId,
    interval: '1day',
    endTime
  });
}
