/**
 * Simple AI productivity analyzer
 */

import { generateObject } from 'ai';
import { google } from '@ai-sdk/google';
import { z } from 'zod';
import { GoogleModel } from './lm-models';
import { loadVideoData } from './video-loader';
import { PRODUCTIVITY_AGENT_PROMPT } from './prompts';

// 生産性分析の構造化スキーマ
const ProductivityAnalysisSchema = z.object({
  summary: z.object({
    totalTime: z.string().describe('分析した時間（分）'),
    productivityScore: z.number().min(1).max(100).describe('生産性スコア（1-100）'),
    mainActivity: z.string().describe('主な作業内容'),
    keyInsights: z.array(z.string()).describe('最も重要な発見、改善すべき点、強みとして活かせる点')
  }),
  patterns: z.object({
    repetitiveTasks: z.array(z.object({
      task: z.string().describe('繰り返し作業の内容'),
      frequency: z.string().describe('頻度'),
      timeLost: z.string().describe('失われた時間'),
      solution: z.string().describe('具体的な解決策')
    })).describe('繰り返し作業のリスト'),
    inefficiencies: z.array(z.object({
      issue: z.string().describe('非効率な点'),
      impact: z.string().describe('影響度'),
      recommendation: z.string().describe('改善提案')
    })).describe('非効率な点のリスト'),
    strengths: z.array(z.string()).describe('既に効率的な点、維持すべき良い習慣')
  }),
  recommendations: z.array(z.object({
    category: z.enum(['shortcut', 'tool', 'workflow', 'automation', 'habit']).describe('カテゴリ'),
    priority: z.enum(['critical', 'high', 'medium', 'low']).describe('優先度'),
    title: z.string().describe('具体的なアクションタイトル'),
    description: z.string().describe('詳細な説明と実装方法'),
    expectedBenefit: z.string().describe('期待される効果（時間短縮、エラー削減など）'),
    implementation: z.object({
      difficulty: z.enum(['easy', 'medium', 'hard']).describe('実装難易度'),
      timeRequired: z.string().describe('実装に必要な時間'),
      steps: z.array(z.string()).describe('実装ステップ')
    }),
    tools: z.array(z.object({
      name: z.string().describe('推奨ツール名'),
      category: z.enum(['ProductHunt', 'Chrome拡張', 'VSCode拡張', 'デスクトップアプリ', 'Webサービス']).describe('ツールカテゴリ'),
      purpose: z.string().describe('このツールで解決できること'),
      features: z.array(z.string()).describe('主要機能'),
      pricing: z.enum(['Free', 'Freemium', 'Paid']).describe('料金体系'),
      alternativeSearch: z.string().describe('Product Huntで検索すべきキーワード')
    })).optional()
  })).describe('改善提案のリスト'),
  shortcuts: z.array(z.object({
    action: z.string().describe('頻繁に行う操作'),
    currentMethod: z.string().describe('現在の方法'),
    shortcut: z.string().describe('推奨ショートカット'),
    timeSaved: z.string().describe('節約時間/回'),
    platform: z.string().describe('Mac|Windows|VSCode|Chrome|アプリ名')
  })).describe('ショートカット提案'),
  actionPlan: z.object({
    immediate: z.array(z.string()).describe('今すぐできること（5分以内）、本日中に実行すべきこと'),
    thisWeek: z.array(z.string()).describe('今週中に導入すべきツール、習慣化すべきこと'),
    thisMonth: z.array(z.string()).describe('1ヶ月で達成すべき改善目標、学習すべきスキル')
  }),
  productHuntSearch: z.object({
    suggestedSearches: z.array(z.object({
      query: z.string().describe('検索クエリ'),
      purpose: z.string().describe('何を解決するためか'),
      expectedTools: z.array(z.string()).describe('期待されるツールタイプ')
    })).describe('推奨検索クエリ'),
    recommendedCategories: z.array(z.string()).describe('推奨カテゴリ')
  }),
  userAdvice: z.string().describe('ユーザーへのシンプルなアドバイス（最も効果的な改善点を1つだけ、3行以内で具体的に）')
});

/**
 * Send productivity advice as notification
 */
async function sendProductivityNotification(userAdvice: string): Promise<void> {
  try {
    await fetch('/api/send-productivity-advice', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: '💡 生産性アドバイス',
        body: userAdvice
      })
    });
    console.log('📱 生産性アドバイス通知を送信しました');
  } catch (error) {
    console.warn('⚠️ 通知送信に失敗:', error);
    // 通知エラーは分析結果に影響しない
  }
}

// Session data (from SessionContext)
export interface SessionRecord {
  id: string;
  startedAt: number;
  stoppedAt?: number;
  log: AgentLogItem[];
  tips: AgentTip[];
  videoPath?: string; // 動画ファイルパス（ローカル or Supabase）
  videoBase64?: string; // Base64エンコードされた動画
}

export interface AgentLogItem {
  id: string;
  ts: number;
  level: 'info' | 'warn' | 'error';
  message: string;
}

export interface AgentTip {
  id: string;
  ts: number;
  title: string;
  detail?: string;
}

// Analysis result interface
export interface ProductivityAnalysis {
  success: boolean;
  analysis: Record<string, unknown> | null; // JSON analysis result
  error?: string;
}

/**
 * Analyze video from path (local file, Supabase storage, or URL)
 */
export async function analyzeVideoFromPath(path: string): Promise<ProductivityAnalysis> {
  try {
    console.log('🎥 動画を読み込み中:', path);
    
    // パスから動画データを取得（自動圧縮・フレーム抽出対応）
    const result = await loadVideoData(path);
    
    if (result.type === 'video') {
      // 動画として解析
      return analyzeVideoBase64(result.data as string);
    } else {
      // フレームとして解析
      return analyzeFrames(result.data as string[]);
    }
  } catch (error) {
    console.error('❌ 動画読み込みエラー:', error);
    return {
      success: false,
      analysis: null,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Analyze video from Base64 encoded data
 */
export async function analyzeVideoBase64(videoBase64: string): Promise<ProductivityAnalysis> {
  try {
    const sizeInMB = (videoBase64.length * 0.75 / 1024 / 1024).toFixed(2);
    console.log('📊 動画サイズ（推定）:', sizeInMB, 'MB');
    console.log('🤖 動画解析開始');
    
    const result = await generateObject({
      model: google(GoogleModel.GEMINI_2_5_FLASH),
      system: PRODUCTIVITY_AGENT_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'この録画データを分析してください。'
            },
            {
              type: 'image',
              image: `data:video/mp4;base64,${videoBase64}`
            }
          ]
        }
      ],
      schema: ProductivityAnalysisSchema,
      temperature: 1,
    });
    
    console.log('📝 解析完了');
    
    // 構造化された結果を直接使用
    const analysis = result.object;
    
    // 分析完了時にユーザーアドバイスを通知
    if (analysis && analysis.userAdvice) {
      await sendProductivityNotification(analysis.userAdvice);
    }
    
    return {
      success: true,
      analysis,
    };

  } catch (error) {
    console.error('❌ 解析エラー:', error);
    return {
      success: false,
      analysis: null,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}


/**
 * Analyze multiple frames extracted from video
 */
export async function analyzeFrames(frames: string[]): Promise<ProductivityAnalysis> {
  try {
    console.log(`🖼️ ${frames.length}個のフレームを解析中`);
    
    const result = await generateObject({
      model: google(GoogleModel.GEMINI_2_5_FLASH),
      system: PRODUCTIVITY_AGENT_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: '以下のスクリーンショットを分析してください。'
            },
            ...frames.map((frame) => ({
              type: 'image' as const,
              image: `data:image/jpeg;base64,${frame}`
            }))
          ]
        }
      ],
      schema: ProductivityAnalysisSchema,
      temperature: 1,
    });
    
    console.log('📝 フレーム解析完了');
    
    // 構造化された結果を直接使用
    const analysis = result.object;
    
    // 分析完了時にユーザーアドバイスを通知
    if (analysis && analysis.userAdvice) {
      await sendProductivityNotification(analysis.userAdvice);
    }
    
    return {
      success: true,
      analysis,
    };

  } catch (error) {
    console.error('❌ フレーム解析エラー:', error);
    return {
      success: false,
      analysis: null,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}