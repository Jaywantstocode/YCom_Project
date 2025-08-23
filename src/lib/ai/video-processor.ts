/**
 * Video processing utilities for handling large video files
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { readFileSync, existsSync, unlinkSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const execAsync = promisify(exec);

export interface VideoProcessingOptions {
  maxSizeMB?: number;        // 最大ファイルサイズ（MB）
  maxDurationSeconds?: number; // 最大動画長（秒）
  resolution?: string;        // 解像度（例: "1280x720"）
  crf?: number;              // 圧縮品質（18-28、大きいほど高圧縮）
  extractFrames?: boolean;   // フレーム抽出モード
  frameInterval?: number;     // フレーム抽出間隔（秒）
}

const DEFAULT_OPTIONS: VideoProcessingOptions = {
  maxSizeMB: 50,             // 50MBまで
  maxDurationSeconds: 180,    // 3分まで
  resolution: '1280x720',     // 720p
  crf: 28,                   // 高圧縮
  extractFrames: false,
  frameInterval: 30,         // 30秒ごと
};

/**
 * Check if ffmpeg is installed
 */
async function checkFFmpeg(): Promise<boolean> {
  try {
    await execAsync('ffmpeg -version');
    return true;
  } catch {
    console.warn('⚠️ FFmpegがインストールされていません。brew install ffmpeg でインストールしてください。');
    return false;
  }
}

/**
 * Get video info using ffprobe
 */
async function getVideoInfo(inputPath: string): Promise<{
  duration: number;
  fileSize: number;
  width: number;
  height: number;
}> {
  try {
    const { stdout } = await execAsync(
      `ffprobe -v quiet -print_format json -show_format -show_streams "${inputPath}"`
    );
    const info = JSON.parse(stdout);
    const videoStream = info.streams.find((s: { codec_type: string }) => s.codec_type === 'video');
    
    return {
      duration: parseFloat(info.format.duration),
      fileSize: parseInt(info.format.size),
      width: videoStream?.width || 1920,
      height: videoStream?.height || 1080,
    };
  } catch (error) {
    console.error('動画情報の取得に失敗:', error);
    throw error;
  }
}

/**
 * Compress video to manageable size
 */
export async function compressVideo(
  inputPath: string,
  options: VideoProcessingOptions = {}
): Promise<string> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  // FFmpegの確認
  if (!await checkFFmpeg()) {
    throw new Error('FFmpegがインストールされていません');
  }
  
  // 動画情報を取得
  const info = await getVideoInfo(inputPath);
  const fileSizeMB = info.fileSize / (1024 * 1024);
  
  console.log(`📹 動画情報: ${info.duration.toFixed(1)}秒, ${fileSizeMB.toFixed(1)}MB, ${info.width}x${info.height}`);
  
  // 一時ファイルパス
  const tempDir = join(tmpdir(), 'video-processor');
  if (!existsSync(tempDir)) {
    mkdirSync(tempDir, { recursive: true });
  }
  const outputPath = join(tempDir, `compressed-${Date.now()}.mp4`);
  
  // FFmpegコマンドを構築
  const commands: string[] = [];
  
  // 入力ファイル
  commands.push(`ffmpeg -i "${inputPath}"`);
  
  // 時間制限
  if (opts.maxDurationSeconds && info.duration > opts.maxDurationSeconds) {
    commands.push(`-t ${opts.maxDurationSeconds}`);
    console.log(`⏱️ 動画を${opts.maxDurationSeconds}秒に制限`);
  }
  
  // 解像度変更
  if (opts.resolution) {
    commands.push(`-vf "scale=${opts.resolution}:force_original_aspect_ratio=decrease,pad=${opts.resolution}:(ow-iw)/2:(oh-ih)/2"`);
    console.log(`📐 解像度を${opts.resolution}に変更`);
  }
  
  // エンコード設定
  commands.push(`-c:v libx264 -preset fast -crf ${opts.crf}`);
  commands.push('-c:a aac -b:a 128k');  // 音声も圧縮
  commands.push('-movflags +faststart'); // Web配信用最適化
  
  // ビットレート制限（ファイルサイズ制御）
  if (opts.maxSizeMB) {
    const targetBitrate = (opts.maxSizeMB * 8 * 1024) / Math.min(info.duration, opts.maxDurationSeconds || info.duration);
    commands.push(`-maxrate ${targetBitrate.toFixed(0)}k -bufsize ${(targetBitrate * 2).toFixed(0)}k`);
  }
  
  // 出力ファイル
  commands.push(`-y "${outputPath}"`);
  
  const ffmpegCommand = commands.join(' ');
  console.log('🔄 動画を圧縮中...');
  
  try {
    await execAsync(ffmpegCommand);
    
    // 圧縮後のファイルサイズを確認
    const compressedSize = readFileSync(outputPath).length;
    const compressedSizeMB = compressedSize / (1024 * 1024);
    console.log(`✅ 圧縮完了: ${fileSizeMB.toFixed(1)}MB → ${compressedSizeMB.toFixed(1)}MB`);
    
    // Base64に変換
    const buffer = readFileSync(outputPath);
    const base64 = buffer.toString('base64');
    
    // 一時ファイルを削除
    unlinkSync(outputPath);
    
    return base64;
    
  } catch (error) {
    console.error('❌ 動画圧縮エラー:', error);
    throw error;
  }
}

/**
 * Extract key frames from video for analysis
 */
export async function extractKeyFrames(
  inputPath: string,
  options: VideoProcessingOptions = {}
): Promise<string[]> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  // FFmpegの確認
  if (!await checkFFmpeg()) {
    throw new Error('FFmpegがインストールされていません');
  }
  
  const info = await getVideoInfo(inputPath);
  const frames: string[] = [];
  const tempDir = join(tmpdir(), 'video-processor');
  
  if (!existsSync(tempDir)) {
    mkdirSync(tempDir, { recursive: true });
  }
  
  console.log(`🎬 キーフレームを抽出中（${opts.frameInterval}秒ごと）...`);
  
  // 動画の長さに応じてフレームを抽出
  const maxTime = Math.min(info.duration, opts.maxDurationSeconds || info.duration);
  const interval = opts.frameInterval || 30;
  
  for (let time = 0; time < maxTime; time += interval) {
    const outputPath = join(tempDir, `frame-${time}.jpg`);
    
    try {
      // 特定の時間のフレームを抽出
      await execAsync(
        `ffmpeg -ss ${time} -i "${inputPath}" -vframes 1 -q:v 2 -vf "scale=${opts.resolution}:force_original_aspect_ratio=decrease" -y "${outputPath}"`
      );
      
      const buffer = readFileSync(outputPath);
      frames.push(buffer.toString('base64'));
      unlinkSync(outputPath);
      
    } catch (error) {
      console.warn(`⚠️ ${time}秒のフレーム抽出に失敗:`, error);
    }
  }
  
  console.log(`✅ ${frames.length}個のフレームを抽出`);
  return frames;
}

/**
 * Process video intelligently based on size
 */
export async function processVideoForAnalysis(
  inputPath: string,
  options: VideoProcessingOptions = {}
): Promise<{ type: 'video' | 'frames'; data: string | string[] }> {
  const info = await getVideoInfo(inputPath);
  const fileSizeMB = info.fileSize / (1024 * 1024);
  
  // 100MB以下なら動画として処理
  if (fileSizeMB <= 100) {
    console.log('📹 動画として処理（圧縮）');
    const compressed = await compressVideo(inputPath, {
      ...options,
      maxSizeMB: 50,
    });
    return { type: 'video', data: compressed };
  }
  
  // 100MB以上ならフレーム抽出
  console.log('🖼️ 大きなファイルのため、キーフレームを抽出');
  const frames = await extractKeyFrames(inputPath, {
    ...options,
    frameInterval: 20, // 20秒ごと
    maxDurationSeconds: 600, // 最大10分
  });
  
  return { type: 'frames', data: frames };
}