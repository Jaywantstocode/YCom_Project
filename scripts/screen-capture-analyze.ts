#!/usr/bin/env tsx

// .envファイルを読み込み
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { analyzeScreenCapture } from '../src/lib/ai/screen-capture-interpreter';

// 設定
const CAPTURED_FRAMES_DIR = path.join(__dirname, '..', 'captured-frames');
const DEFAULT_IMAGE_INDEX = 10;

/**
 * 利用可能な画像ファイルを取得
 */
function getAvailableImages(): string[] {
    if (!fs.existsSync(CAPTURED_FRAMES_DIR)) {
        console.error(`❌ エラー: captured-framesディレクトリが見つかりません: ${CAPTURED_FRAMES_DIR}`);
        process.exit(1);
    }
    
    const files = fs.readdirSync(CAPTURED_FRAMES_DIR)
        .filter(file => file.endsWith('.png'))
        .sort();
    
    if (files.length === 0) {
        console.error('❌ エラー: 画像ファイルが見つかりません。');
        console.error('💡 先に以下のコマンドを実行してください:');
        console.error('   npm run extract-frames <動画ファイル>');
        process.exit(1);
    }
    
    return files;
}

/**
 * 画像ファイルパスを取得
 */
function getImagePath(imageIndex: number): string {
    const images = getAvailableImages();
    
    console.log(`📸 利用可能な画像: ${images.length}枚`);
    
    const index = imageIndex !== undefined ? imageIndex : DEFAULT_IMAGE_INDEX;
    
    if (index >= images.length || index < 0) {
        console.error(`❌ エラー: 画像インデックス ${index} が範囲外です。利用可能な画像: 0-${images.length - 1}`);
        process.exit(1);
    }
    
    const imagePath = path.join(CAPTURED_FRAMES_DIR, images[index]);
    console.log(`🖼️  選択された画像: ${images[index]} (インデックス: ${index})`);
    
    return imagePath;
}

/**
 * メイン関数
 */
async function main() {
    const args = process.argv.slice(2);
    
    // ヘルプ表示
    if (args.includes('--help') || args.includes('-h')) {
        console.log('🔬 画像分析ツール');
        console.log('================');
        console.log('');
        console.log('使用方法:');
        console.log('  npm run analyze [画像インデックス]');
        console.log('');
        console.log('例:');
        console.log('  npm run analyze           # デフォルト画像（インデックス10）を分析');
        console.log('  npm run analyze 25        # インデックス25の画像を分析');
        console.log('  npm run analyze 0         # 最初の画像を分析');
        console.log('');
        console.log('注意:');
        console.log('  - OPENAI_API_KEY環境変数が必要です');
        console.log('  - 先に npm run extract-frames で画像を生成してください');
        return;
    }
    
    try {
        // 画像インデックスを取得
        const imageIndex = args[0] ? parseInt(args[0]) : DEFAULT_IMAGE_INDEX;
        
        if (isNaN(imageIndex)) {
            console.error('❌ エラー: 画像インデックスは数字で指定してください');
            console.error('例: npm run analyze 10');
            process.exit(1);
        }
        
        console.log('🔬 画像分析ツール');
        console.log('================');
        
        // 画像パスを取得
        const imagePath = getImagePath(imageIndex);
        
        console.log('🤖 AI分析を実行中...');
        
        // 画像を読み込んでAI分析を実行
        const imageBuffer = fs.readFileSync(imagePath);
        const result = await analyzeScreenCapture({
            image: imageBuffer,
            timestamp: Date.now()
        });
        
        console.log('✨ 分析結果:');
        console.log(JSON.stringify(result, null, 2));
        
    } catch (error) {
        console.error(`❌ エラー: ${error instanceof Error ? error.message : error}`);
        console.error('');
        console.error('💡 トラブルシューティング:');
        console.error('1. OPENAI_API_KEY環境変数が設定されているか確認');
        console.error('2. 画像ファイルが存在するか確認: npm run extract-frames <動画ファイル>');
        console.error('3. 画像インデックスが正しいか確認');
        process.exit(1);
    }
}

// スクリプトが直接実行された場合のみメイン関数を実行
if (require.main === module) {
    main();
}
