/**
 * AI productivity analyzer with video support
 */

import { generateText } from 'ai';
import { google } from '@ai-sdk/google';
import { PRODUCTIVITY_AGENT_PROMPT } from './prompts';
import { GoogleModel } from './lm-models';
import { readFileSync } from 'fs';

// Session data (from SessionContext)
export interface SessionRecord {
  id: string;
  startedAt: number;
  stoppedAt?: number;
  log: AgentLogItem[];
  tips: AgentTip[];
  videoPath?: string; // 動画ファイルパス
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
  analysis: string;
  error?: string;
}

/**
 * Analyze video file with Gemini 2.0 Flash
 */
export async function analyzeVideoFile(videoPath: string): Promise<ProductivityAnalysis> {
  try {
    console.log('🎥 動画ファイルを解析:', videoPath);
    
    // 動画ファイルを読み込み
    const videoBuffer = readFileSync(videoPath);
    const videoBase64 = videoBuffer.toString('base64');
    
    return analyzeVideoBase64(videoBase64);
  } catch (error) {
    console.error('❌ 動画読み込みエラー:', error);
    return {
      success: false,
      analysis: '',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Analyze Base64 encoded video with Gemini 2.0 Flash
 */
export async function analyzeVideoBase64(videoBase64: string): Promise<ProductivityAnalysis> {
  try {
    console.log('🤖 Gemini 2.0 Flashで動画解析開始');
    
    const result = await generateText({
      model: google(GoogleModel.GEMINI_2_0_FLASH),
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
              text: `この録画データを分析してください。以下の点に特に注目して具体的な改善提案を行ってください：

1. 繰り返し作業の自動化機会
2. キーボードショートカットで改善できる操作
3. Product Huntで見つかる生産性向上ツール
4. ワークフローの最適化ポイント
5. 時間の無駄になっている操作

必ずJSONフォーマットで回答してください。`
            },
            {
              type: 'image',
              image: `data:video/mp4;base64,${videoBase64}`
            }
          ]
        }
      ],
      temperature: 0.7,
    });
    
    console.log('📝 解析完了');
    
    return {
      success: true,
      analysis: result.text,
    };

  } catch (error) {
    console.error('❌ Gemini解析エラー:', error);
    return {
      success: false,
      analysis: '',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Analyze sessions with optional video data
 */
export async function analyzeProductivitySessions(sessions: SessionRecord[]): Promise<ProductivityAnalysis> {
  try {
    // 動画データがある場合は最初のセッションの動画を解析
    const sessionWithVideo = sessions.find(s => s.videoPath || s.videoBase64);
    
    if (sessionWithVideo) {
      if (sessionWithVideo.videoPath) {
        return analyzeVideoFile(sessionWithVideo.videoPath);
      } else if (sessionWithVideo.videoBase64) {
        return analyzeVideoBase64(sessionWithVideo.videoBase64);
      }
    }
    
    // 動画がない場合は従来のログベース解析
    const sessionData = formatSessions(sessions);
    
    console.log('🤖 ログデータから生産性を解析');
    
    const result = await generateText({
      model: google(GoogleModel.GEMINI_2_0_FLASH),
      messages: [
        {
          role: 'system',
          content: PRODUCTIVITY_AGENT_PROMPT
        },
        {
          role: 'user',
          content: `以下のセッションログを分析し、生産性向上のための具体的な提案を行ってください：

${sessionData}

必ずJSONフォーマットで回答してください。`
        }
      ],
      temperature: 0.7,
    });

    return {
      success: true,
      analysis: result.text,
    };

  } catch (error) {
    console.error('❌ Analysis error:', error);
    return {
      success: false,
      analysis: '',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

function formatSessions(sessions: SessionRecord[]): string {
  return sessions.map(session => {
    const duration = session.stoppedAt ? 
      Math.round((session.stoppedAt - session.startedAt) / 60000) : 
      'ongoing';
    
    return `Session ID: ${session.id}
Duration: ${duration} minutes
Logs: ${session.log.length} entries
Tips: ${session.tips.length} entries
Recent logs: ${session.log.slice(-5).map(log => `[${log.level}] ${log.message}`).join(', ')}`;
  }).join('\n\n');
}