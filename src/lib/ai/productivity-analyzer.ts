/**
 * AI productivity analyzer with video support
 */

import { generateText } from 'ai';
import { google } from '@ai-sdk/google';
import { PRODUCTIVITY_AGENT_PROMPT } from './prompts';
import { GoogleModel } from './lm-models';
import { loadVideoData } from './video-loader';
import { searchProductHunt } from '../tools/search-products';
import { setPlan } from '../tools/set-plan';

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
  analysis: string;
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
      analysis: '',
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
    console.log('🤖 Gemini 2.5 Flashで動画解析開始');
    
    // ツールを定義
    const tools = {
      setPlan,
      searchProductHunt,
    };
    
    const result = await generateText({
      model: google(GoogleModel.GEMINI_2_5_FLASH),
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
              text: `この録画データを分析して、生産性向上のための改善提案を行ってください。

必ず以下の順番で実行してください：
1. PHASE 1: setPlanツールで分析結果と改善計画を設定
2. PHASE 2: 必要に応じてsearchProductHuntツールで製品を検索
3. PHASE 3: ユーザー向けの最終レポートを作成

各フェーズを順番に実行し、最終的に実行可能なアクションプランを提供してください。`
            },
            {
              type: 'image',
              image: `data:video/mp4;base64,${videoBase64}`
            }
          ]
        }
      ],
      tools,
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
 * Analyze multiple frames extracted from video
 */
export async function analyzeFrames(frames: string[]): Promise<ProductivityAnalysis> {
  try {
    console.log(`🖼️ ${frames.length}個のフレームを解析中`);
    
    // ツールを定義
    const tools = {
      setPlan,
      searchProductHunt,
    };
    
    // フレームをGeminiに送信
    const result = await generateText({
      model: google(GoogleModel.GEMINI_2_5_FLASH),
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
              text: `以下のスクリーンショットは時系列順に抜き出された作業セッションのキーフレームです。
全体的な作業パターンを分析し、生産性向上のための改善提案を行ってください。

必ず以下の順番で実行してください：
1. PHASE 1: setPlanツールで分析結果と改善計画を設定
2. PHASE 2: 必要に応じてsearchProductHuntツールで製品を検索
3. PHASE 3: ユーザー向けの最終レポートを作成

各フェーズを順番に実行し、最終的に実行可能なアクションプランを提供してください。`
            },
            ...frames.map((frame) => ({
              type: 'image' as const,
              image: `data:image/jpeg;base64,${frame}`
            }))
          ]
        }
      ],
      tools,
      temperature: 0.7,
    });
    
    console.log('📝 フレーム解析完了');
    
    return {
      success: true,
      analysis: result.text,
    };

  } catch (error) {
    console.error('❌ フレーム解析エラー:', error);
    return {
      success: false,
      analysis: '',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}