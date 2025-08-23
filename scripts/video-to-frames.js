#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// 設定
const OUTPUT_DIR = path.join(__dirname, '..', 'captured-frames');
const FRAME_INTERVAL = 5; // 5秒間隔

/**
 * コマンドライン引数から動画ファイルパスを取得
 */
function getVideoFilePath() {
    const args = process.argv.slice(2);
    if (args.length === 0) {
        console.error('使用方法: node video-to-frames.js <動画ファイルパス>');
        console.error('例: node video-to-frames.js ~/Desktop/screen-recording.mov');
        process.exit(1);
    }
    return args[0];
}

/**
 * 出力ディレクトリを作成
 */
function createOutputDirectory() {
    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
        console.log(`出力ディレクトリを作成しました: ${OUTPUT_DIR}`);
    }
}

/**
 * 動画ファイルの存在確認
 */
function validateVideoFile(videoPath) {
    if (!fs.existsSync(videoPath)) {
        console.error(`エラー: 動画ファイルが見つかりません: ${videoPath}`);
        process.exit(1);
    }
    
    const ext = path.extname(videoPath).toLowerCase();
    const supportedFormats = ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v'];
    
    if (!supportedFormats.includes(ext)) {
        console.error(`エラー: サポートされていない動画形式です: ${ext}`);
        console.error(`サポートされている形式: ${supportedFormats.join(', ')}`);
        process.exit(1);
    }
}

/**
 * FFmpegを使用して動画を画像に変換
 */
function convertVideoToFrames(videoPath) {
    return new Promise((resolve, reject) => {
        const videoName = path.basename(videoPath, path.extname(videoPath));
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
        const outputPattern = path.join(OUTPUT_DIR, `${videoName}_${timestamp}_frame_%04d.png`);
        
        // FFmpegコマンドを構築（5秒間隔でフレームを抽出）
        const ffmpegArgs = [
            '-i', videoPath,
            '-vf', `fps=1/${FRAME_INTERVAL}`, // 5秒間隔 = 1/5 fps
            '-y', // 既存ファイルを上書き
            outputPattern
        ];
        
        console.log(`動画を変換中: ${videoPath}`);
        console.log(`出力先: ${OUTPUT_DIR}`);
        console.log(`フレーム間隔: ${FRAME_INTERVAL}秒`);
        
        const ffmpeg = spawn('ffmpeg', ffmpegArgs);
        
        ffmpeg.stdout.on('data', (data) => {
            // FFmpegの標準出力（通常は使用されない）
        });
        
        ffmpeg.stderr.on('data', (data) => {
            // FFmpegの進行状況は標準エラー出力に出力される
            const output = data.toString();
            if (output.includes('frame=')) {
                process.stdout.write('\r' + output.trim().split('\n').pop());
            }
        });
        
        ffmpeg.on('close', (code) => {
            console.log('\n');
            if (code === 0) {
                console.log('✅ 変換が完了しました！');
                
                // 生成された画像ファイル数を数える
                const files = fs.readdirSync(OUTPUT_DIR)
                    .filter(file => file.includes(videoName) && file.endsWith('.png'));
                console.log(`📸 生成された画像: ${files.length}枚`);
                
                resolve();
            } else {
                reject(new Error(`FFmpegがエラーコード ${code} で終了しました`));
            }
        });
        
        ffmpeg.on('error', (error) => {
            reject(new Error(`FFmpegの実行に失敗しました: ${error.message}`));
        });
    });
}

/**
 * FFmpegの存在確認
 */
function checkFFmpeg() {
    return new Promise((resolve, reject) => {
        const ffmpeg = spawn('ffmpeg', ['-version']);
        
        ffmpeg.on('close', (code) => {
            if (code === 0) {
                resolve();
            } else {
                reject(new Error('FFmpegが見つかりません'));
            }
        });
        
        ffmpeg.on('error', () => {
            reject(new Error('FFmpegが見つかりません'));
        });
    });
}

/**
 * メイン関数
 */
async function main() {
    try {
        console.log('🎬 動画フレーム抽出ツール');
        console.log('========================');
        
        // FFmpegの存在確認
        await checkFFmpeg();
        
        // 動画ファイルパスを取得
        const videoPath = getVideoFilePath();
        
        // 動画ファイルの存在確認
        validateVideoFile(videoPath);
        
        // 出力ディレクトリを作成
        createOutputDirectory();
        
        // 動画を画像に変換
        await convertVideoToFrames(videoPath);
        
        console.log(`\n📁 画像は以下のディレクトリに保存されました:`);
        console.log(`   ${OUTPUT_DIR}`);
        
    } catch (error) {
        console.error(`❌ エラー: ${error.message}`);
        
        if (error.message.includes('FFmpegが見つかりません')) {
            console.error('\n💡 FFmpegをインストールしてください:');
            console.error('   macOS: brew install ffmpeg');
            console.error('   Ubuntu: sudo apt install ffmpeg');
            console.error('   Windows: https://ffmpeg.org/download.html');
        }
        
        process.exit(1);
    }
}

// スクリプトが直接実行された場合のみメイン関数を実行
if (require.main === module) {
    main();
}
