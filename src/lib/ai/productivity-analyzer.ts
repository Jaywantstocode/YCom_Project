/**
 * Simple AI productivity analyzer
 */

import { generateText } from 'ai';
import { google } from '@ai-sdk/google';
import { GoogleModel } from './lm-models';
import { loadVideoData } from './video-loader';
import { PRODUCTIVITY_AGENT_PROMPT } from './prompts';

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