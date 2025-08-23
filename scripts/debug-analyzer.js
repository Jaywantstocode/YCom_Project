#!/usr/bin/env node

// .envファイルを読み込み
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// 設定
const CAPTURED_FRAMES_DIR = path.join(__dirname, '..', 'captured-frames');
const DEFAULT_IMAGE_INDEX = 10; // デフォルトで使用する画像のインデックス

/**
 * 利用可能な画像ファイルを取得
 */
function getAvailableImages() {
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
function getImagePath(imageIndex) {
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
 * TypeScript analyzer を実行
 */
function runAnalyzer(imagePath) {
    return new Promise((resolve, reject) => {
        // TypeScriptファイルを実行するスクリプト
        const analyzerScript = `
const fs = require('fs');
const path = require('path');

async function runAnalysis() {
    try {
        const ts = require('typescript');
        const analyzerPath = path.join(__dirname, '..', 'src', 'lib', 'ai', 'analyzer.ts');
        const tsCode = fs.readFileSync(analyzerPath, 'utf8');
        
        const compiledCode = ts.transpile(tsCode, {
            module: ts.ModuleKind.CommonJS,
            target: ts.ScriptTarget.ES2018,
            esModuleInterop: true,
            allowSyntheticDefaultImports: true
        });
        
        const module = { exports: {} };
        const func = new Function('module', 'exports', 'require', '__dirname', '__filename', compiledCode);
        func(module, module.exports, require, __dirname, __filename);
        
        const imageBuffer = fs.readFileSync('${imagePath}');
        const analyzeFunction = module.exports.analyzeScreenCapture;
        
        if (!analyzeFunction) {
            throw new Error('analyzeScreenCapture 関数が見つかりません');
        }
        
        const analysisResult = await analyzeFunction({
            image: imageBuffer,
            timestamp: Date.now()
        });
        
        console.log('✨ 分析結果:');
        console.log(JSON.stringify(analysisResult, null, 2));
        
    } catch (error) {
        console.error('❌ エラー:', error.message);
        process.exit(1);
    }
}

runAnalysis();
`;
        
        const tempFile = path.join(__dirname, 'temp-analyzer.js');
        fs.writeFileSync(tempFile, analyzerScript);
        
        const node = spawn('node', [tempFile], {
            stdio: ['pipe', 'pipe', 'pipe'],
            env: { ...process.env }
        });
        
        let output = '';
        let errorOutput = '';
        
        node.stdout.on('data', (data) => {
            const text = data.toString();
            output += text;
            process.stdout.write(text);
        });
        
        node.stderr.on('data', (data) => {
            const text = data.toString();
            errorOutput += text;
            process.stderr.write(text);
        });
        
        node.on('close', (code) => {
            try {
                fs.unlinkSync(tempFile);
            } catch (e) {
                // ファイル削除エラーは無視
            }
            
            if (code === 0) {
                resolve(output);
            } else {
                reject(new Error(`分析スクリプトがエラーコード ${code} で終了`));
            }
        });
        
        node.on('error', (error) => {
            reject(new Error(`分析スクリプトの実行に失敗: ${error.message}`));
        });
    });
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
        await runAnalyzer(imagePath);
        
    } catch (error) {
        console.error(`❌ エラー: ${error.message}`);
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