/**
 * Simple AI productivity analyzer
 */

import { generateText } from 'ai';
import { google } from '@ai-sdk/google';
import { z } from 'zod';
import { GoogleModel } from './lm-models';
import { loadVideoData } from './video-loader';
import { PRODUCTIVITY_AGENT_PROMPT } from './prompts';

// Structured schema for productivity analysis (English)
const ProductivityAnalysisSchema = z.object({
  summary: z.object({
    totalTime: z.string().describe('Total analyzed time (minutes)'),
    productivityScore: z.number().min(1).max(100).describe('Productivity score (1-100)'),
    mainActivity: z.string().describe('Primary activity'),
    keyInsights: z.array(z.string()).describe('Key findings, improvement areas, strengths')
  }),
  patterns: z.object({
    repetitiveTasks: z.array(z.object({
      task: z.string().describe('Repeated task'),
      frequency: z.string().describe('Frequency'),
      timeLost: z.string().describe('Time lost'),
      solution: z.string().describe('Concrete solution')
    })).describe('List of repeated tasks'),
    inefficiencies: z.array(z.object({
      issue: z.string().describe('Inefficiency'),
      impact: z.string().describe('Impact'),
      recommendation: z.string().describe('Recommendation')
    })).describe('List of inefficiencies'),
    strengths: z.array(z.string()).describe('Efficient areas / habits to keep')
  }),
  recommendations: z.array(z.object({
    category: z.enum(['shortcut', 'tool', 'workflow', 'automation', 'habit']).describe('Category'),
    priority: z.enum(['critical', 'high', 'medium', 'low']).describe('Priority'),
    title: z.string().describe('Action title'),
    description: z.string().describe('Detailed description and implementation'),
    expectedBenefit: z.string().describe('Expected benefit (time saved, fewer errors, etc.)'),
    implementation: z.object({
      difficulty: z.enum(['easy', 'medium', 'hard']).describe('Implementation difficulty'),
      timeRequired: z.string().describe('Time required'),
      steps: z.array(z.string()).describe('Implementation steps')
    }),
    tools: z.array(z.object({
      name: z.string().describe('Recommended tool name'),
      category: z.enum(['ProductHunt', 'Chrome Extension', 'VSCode Extension', 'Desktop App', 'Web Service']).describe('Tool category'),
      purpose: z.string().describe('What this tool solves'),
      features: z.array(z.string()).describe('Key features'),
      pricing: z.enum(['Free', 'Freemium', 'Paid']).describe('Pricing'),
      alternativeSearch: z.string().describe('Keywords to search on Product Hunt')
    })).optional()
  })).describe('List of improvement recommendations'),
  shortcuts: z.array(z.object({
    action: z.string().describe('Frequent action'),
    currentMethod: z.string().describe('Current method'),
    shortcut: z.string().describe('Recommended shortcut'),
    timeSaved: z.string().describe('Time saved per action'),
    platform: z.string().describe('Mac|Windows|VSCode|Chrome|App name')
  })).describe('Shortcut suggestions'),
  actionPlan: z.object({
    immediate: z.array(z.string()).describe('Do now (within 5 minutes) / today'),
    thisWeek: z.array(z.string()).describe('Adopt this week / habits to establish'),
    thisMonth: z.array(z.string()).describe('Goals for this month / skills to learn')
  }),
  productHuntSearch: z.object({
    suggestedSearches: z.array(z.object({
      query: z.string().describe('Search query'),
      purpose: z.string().describe('What problem it solves'),
      expectedTools: z.array(z.string()).describe('Expected tool types')
    })).describe('Recommended search queries'),
    recommendedCategories: z.array(z.string()).describe('Recommended categories')
  }),
  userAdvice: z.string().describe('Simple user advice: one actionable improvement within 3 lines')
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
        title: '💡 Productivity Advice',
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
    
    const result = await generateText({
      model: google(GoogleModel.GEMINI_2_5_PRO),
      messages: [
        {
          role: 'system',
          content: PRODUCTIVITY_AGENT_PROMPT
        },
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
      temperature: 0.3,
    });
    
    console.log('📝 解析完了');
    
    // Parse JSON from response
    let analysis;
    try {
      // Remove markdown code blocks if present
      const jsonText = result.text.replace(/```json\n?|```\n?/g, '').trim();
      analysis = JSON.parse(jsonText);
    } catch (parseError) {
      console.error('❌ JSON解析エラー:', parseError);
      // Return raw text if JSON parsing fails
      analysis = { rawText: result.text };
    }
    
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
    
    const result = await generateText({
      model: google(GoogleModel.GEMINI_2_5_PRO),
      messages: [
        {
          role: 'system',
          content: PRODUCTIVITY_AGENT_PROMPT
        },
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
      temperature: 0.3,
    });
    
    console.log('📝 フレーム解析完了');
    
    // Parse JSON from response
    let analysis;
    try {
      // Remove markdown code blocks if present
      const jsonText = result.text.replace(/```json\n?|```\n?/g, '').trim();
      analysis = JSON.parse(jsonText);
    } catch (parseError) {
      console.error('❌ JSON解析エラー:', parseError);
      // Return raw text if JSON parsing fails
      analysis = { rawText: result.text };
    }
    
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