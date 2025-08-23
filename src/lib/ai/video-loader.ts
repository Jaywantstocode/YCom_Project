/**
 * Video loader utility for loading video data from various sources
 */

import { readFileSync, existsSync, statSync } from 'fs';
import { createClient } from '@supabase/supabase-js';
import { processVideoForAnalysis } from './video-processor';

/**
 * Load video data from either local file system or Supabase storage
 * @param path - File path (local) or storage path (e.g., "supabase://bucket/path/to/video.mp4")
 * @param autoCompress - 自動圧縮を有効にするか（デフォルト: true）
 * @returns Video data as Base64 string or array of Base64 frames
 */
export async function loadVideoData(
  path: string, 
  autoCompress: boolean = true
): Promise<{ type: 'video' | 'frames'; data: string | string[] }> {
  // Supabaseストレージのパスかどうかを判定
  if (path.startsWith('supabase://') || path.startsWith('storage://')) {
    const base64 = await loadFromSupabase(path);
    return { type: 'video', data: base64 };
  }
  
  // HTTPSやHTTPのURLの場合
  if (path.startsWith('https://') || path.startsWith('http://')) {
    const base64 = await loadFromUrl(path);
    return { type: 'video', data: base64 };
  }
  
  // ローカルファイルの場合、サイズをチェックして必要なら圧縮
  if (autoCompress) {
    const stats = statSync(path);
    const fileSizeMB = stats.size / (1024 * 1024);
    
    // 100MB以上なら自動的に圧縮またはフレーム抽出
    if (fileSizeMB > 100) {
      console.log(`⚠️ ファイルサイズが大きい (${fileSizeMB.toFixed(1)}MB) ため、処理します...`);
      return await processVideoForAnalysis(path);
    }
  }
  
  // 小さいファイルはそのまま読み込み
  const base64 = loadFromLocal(path);
  return { type: 'video', data: base64 };
}

/**
 * Load video from local file system
 */
function loadFromLocal(filePath: string): string {
  console.log('📁 ローカルファイルから読み込み:', filePath);
  
  if (!existsSync(filePath)) {
    throw new Error(`ファイルが見つかりません: ${filePath}`);
  }
  
  const buffer = readFileSync(filePath);
  const base64 = buffer.toString('base64');
  console.log('✅ ローカルファイル読み込み完了:', (buffer.length / 1024 / 1024).toFixed(2), 'MB');
  
  return base64;
}

/**
 * Load video from Supabase storage
 */
async function loadFromSupabase(path: string): Promise<string> {
  console.log('☁️ Supabaseストレージから読み込み:', path);
  
  // URLをパース (例: "supabase://videos/session-123.mp4")
  const match = path.match(/^(?:supabase|storage):\/\/([^\/]+)\/(.+)$/);
  if (!match) {
    throw new Error(`Invalid Supabase storage path: ${path}`);
  }
  
  const [, bucket, filePath] = match;
  
  // Supabaseクライアントを初期化
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase環境変数が設定されていません');
  }
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  // ストレージからダウンロード
  const { data, error } = await supabase.storage
    .from(bucket)
    .download(filePath);
  
  if (error) {
    throw new Error(`Supabaseダウンロードエラー: ${error.message}`);
  }
  
  if (!data) {
    throw new Error('データが取得できませんでした');
  }
  
  // BlobをBase64に変換
  const arrayBuffer = await data.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const base64 = buffer.toString('base64');
  
  console.log('✅ Supabaseから読み込み完了:', (buffer.length / 1024 / 1024).toFixed(2), 'MB');
  
  return base64;
}

/**
 * Load video from URL
 */
async function loadFromUrl(url: string): Promise<string> {
  console.log('🌐 URLから読み込み:', url);
  
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`HTTPエラー: ${response.status} ${response.statusText}`);
  }
  
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const base64 = buffer.toString('base64');
  
  console.log('✅ URL読み込み完了:', (buffer.length / 1024 / 1024).toFixed(2), 'MB');
  
  return base64;
}

/**
 * Determine the source type of a path
 */
export function getSourceType(path: string): 'local' | 'supabase' | 'url' {
  if (path.startsWith('supabase://') || path.startsWith('storage://')) {
    return 'supabase';
  }
  if (path.startsWith('https://') || path.startsWith('http://')) {
    return 'url';
  }
  return 'local';
}