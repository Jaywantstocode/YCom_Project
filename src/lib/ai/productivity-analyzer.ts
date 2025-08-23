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

各フェーズを順番に実行し、最終的に実行可能なアクションプランを提供してください。
絶対に一個のフェーズを完了して処理を終了せず、連鎖的にツールを実行してください。`
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
      // maxSteps: 10, // 複数のツールを連続実行できるようにする
      onStepFinish: async ({ toolCalls, toolResults, finishReason, text, usage }) => {
        const timestamp = new Date().toISOString();
        
        // ツール呼び出しがある場合
        if (toolCalls && toolCalls.length > 0) {
          const toolCall = toolCalls[0] as any;
          const toolName = toolCall.toolName;
          const args = toolCall.input || toolCall.args;
          
          console.log('\n========================================');
          console.log(`🛠️  ツール呼び出し: ${toolName}`);
          console.log('========================================');
          console.log('📥 入力引数:');
          console.log(JSON.stringify(args, null, 2));
          
          // ツール実行結果
          if (toolResults && toolResults.length > 0) {
            const result = toolResults[0] as any;
            if (result.output) {
              console.log('✅ 実行結果:');
              console.log(JSON.stringify(result.output, null, 2));
            }
          }
          
          // フェーズ表示
          if (toolName === 'setPlan') {
            console.log('\n📍 PHASE 1: 分析と計画設定 - 完了');
          } else if (toolName === 'searchProductHunt') {
            console.log('\n📍 PHASE 2: 製品検索 - 完了');
          }
          
        } else if (text) {
          // AIの思考出力
          console.log('\n💭 AI思考中...');
          if (text.length > 200) {
            console.log(text.substring(0, 200) + '...');
          } else {
            console.log(text);
          }
        }
        
        // エラーの場合
        if (finishReason === 'error') {
          console.error('\n❌❌❌ エラー発生 ❌❌❌');
          if (toolCalls && toolCalls.length > 0) {
            const toolCall = toolCalls[0] as any;
            console.error(`失敗したツール: ${toolCall.toolName}`);
            console.error('失敗時の引数:');
            console.error(JSON.stringify(toolCall.input || toolCall.args, null, 2));
          } else {
            console.error('エラータイプ: ツール呼び出し以外のエラー');
            console.error('可能性のある原因:');
            console.error('  - モデルの処理エラー');
            console.error('  - トークン制限超過');
            console.error('  - API接続エラー');
            console.error('  - 不正な入力データ');
          }
          console.error('エラー詳細:', text || '(エラーメッセージなし)');
          console.error('トークン使用量:', JSON.stringify(usage, null, 2));
          console.error('タイムスタンプ:', timestamp);
          console.error('終了理由:', finishReason);
        }
        
        // その他の終了理由をログ出力
        if (finishReason && finishReason !== 'tool-calls' && finishReason !== 'error') {
          console.log(`\n📌 ステップ終了 - 理由: ${finishReason}`);
          if (finishReason === 'stop') {
            console.log('✅ 正常終了 - AIがタスクを完了しました');
          } else if (finishReason === 'length') {
            console.warn('⚠️ トークン制限に達しました');
          } else if (finishReason === 'content-filter') {
            console.warn('⚠️ コンテンツフィルターによりブロックされました');
          } else {
            console.log(`終了理由の詳細: ${finishReason}`);
          }
        }
      },
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
      // maxSteps: 10, // 複数のツールを連続実行できるようにする
      onStepFinish: async ({ toolCalls, toolResults, finishReason, text, usage }) => {
        const timestamp = new Date().toISOString();
        
        // ツール呼び出しがある場合
        if (toolCalls && toolCalls.length > 0) {
          const toolCall = toolCalls[0] as any;
          const toolName = toolCall.toolName;
          const args = toolCall.input || toolCall.args;
          
          console.log('\n========================================');
          console.log(`🛠️  ツール呼び出し (Frames): ${toolName}`);
          console.log('========================================');
          console.log('📥 入力引数:');
          console.log(JSON.stringify(args, null, 2));
          
          // ツール実行結果
          if (toolResults && toolResults.length > 0) {
            const result = toolResults[0] as any;
            if (result.output) {
              console.log('✅ 実行結果:');
              console.log(JSON.stringify(result.output, null, 2));
            }
          }
          
          // フェーズ表示
          if (toolName === 'setPlan') {
            console.log('\n📍 PHASE 1: 分析と計画設定 - 完了 (Frames)');
          } else if (toolName === 'searchProductHunt') {
            console.log('\n📍 PHASE 2: 製品検索 - 完了 (Frames)');
          }
          
        } else if (text) {
          // AIの思考出力
          console.log('\n💭 AI思考中 (Frames)...');
          if (text.length > 200) {
            console.log(text.substring(0, 200) + '...');
          } else {
            console.log(text);
          }
        }
        
        // エラーの場合
        if (finishReason === 'error') {
          console.error('\n❌❌❌ エラー発生 (Frames) ❌❌❌');
          if (toolCalls && toolCalls.length > 0) {
            const toolCall = toolCalls[0] as any;
            console.error(`失敗したツール: ${toolCall.toolName}`);
            console.error('失敗時の引数:');
            console.error(JSON.stringify(toolCall.input || toolCall.args, null, 2));
          } else {
            console.error('エラータイプ: ツール呼び出し以外のエラー');
            console.error('可能性のある原因:');
            console.error('  - モデルの処理エラー');
            console.error('  - トークン制限超過');
            console.error('  - API接続エラー');
            console.error('  - 不正な入力データ');
          }
          console.error('エラー詳細:', text || '(エラーメッセージなし)');
          console.error('トークン使用量:', JSON.stringify(usage, null, 2));
          console.error('タイムスタンプ:', timestamp);
          console.error('終了理由:', finishReason);
        }
        
        // その他の終了理由をログ出力
        if (finishReason && finishReason !== 'tool-calls' && finishReason !== 'error') {
          console.log(`\n📌 ステップ終了 (Frames) - 理由: ${finishReason}`);
          if (finishReason === 'stop') {
            console.log('✅ 正常終了 - AIがタスクを完了しました');
          } else if (finishReason === 'length') {
            console.warn('⚠️ トークン制限に達しました');
          } else if (finishReason === 'content-filter') {
            console.warn('⚠️ コンテンツフィルターによりブロックされました');
          } else {
            console.log(`終了理由の詳細: ${finishReason}`);
          }
        }
      },
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