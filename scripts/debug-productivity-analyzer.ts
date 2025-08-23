#!/usr/bin/env tsx

require('dotenv').config();

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { generateText } from 'ai';
import { google } from '@ai-sdk/google';
import { GoogleModel } from '../src/lib/ai/lm-models';
import { PRODUCTIVITY_AGENT_PROMPT } from '../src/lib/ai/prompts';

async function analyzeVideoWithGemini(videoPath: string) {
    try {
        console.log('🎥 動画ファイルを読み込み中:', videoPath);
        
        // 動画ファイルの存在確認
        if (!existsSync(videoPath)) {
            throw new Error(`動画ファイルが見つかりません: ${videoPath}`);
        }
        
        // 動画ファイルを読み込み
        const videoBuffer = readFileSync(videoPath);
        const videoBase64 = videoBuffer.toString('base64');
        
        console.log('📊 ファイルサイズ:', (videoBuffer.length / 1024 / 1024).toFixed(2), 'MB');
        console.log('🤖 Gemini 2.0 Flashで解析開始...\n');
        
        // Geminiに動画を送信して解析
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
                            text: '以下の録画データから作業内容を分析し、生産性向上のための具体的な提案を行ってください。特に繰り返し作業、非効率な操作、ショートカットの活用機会、Product Huntで見つかるツールなどを提案してください。'
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
        
        return {
            success: true,
            analysis: result.text,
            rawResponse: result
        };
        
    } catch (error) {
        console.error('❌ 解析エラー:', error);
        return {
            success: false,
            analysis: '',
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}

async function main() {
    try {
        console.log('🚀 Productivity Analyzer Video Debug');
        console.log('=====================================\n');
        
        // コマンドライン引数から動画ファイルパスを取得
        const videoPath = process.argv[2];
        
        if (!videoPath) {
            console.log('使用方法: pnpm tsx scripts/debug-productivity-analyzer.ts <動画ファイルパス>');
            console.log('例: pnpm tsx scripts/debug-productivity-analyzer.ts videos/sample.mp4\n');
            
            // デフォルトの動画ファイルを探す
            const defaultPath = join(process.cwd(), 'videos', 'sample.mp4');
            if (existsSync(defaultPath)) {
                console.log(`📁 デフォルトファイルを使用: ${defaultPath}\n`);
                const result = await analyzeVideoWithGemini(defaultPath);
                displayResult(result);
            } else {
                console.log('ℹ️  videos/sample.mp4 にサンプル動画を配置してください');
                process.exit(1);
            }
        } else {
            // 指定された動画ファイルを解析
            const fullPath = join(process.cwd(), videoPath);
            const result = await analyzeVideoWithGemini(fullPath);
            displayResult(result);
        }
        
    } catch (error) {
        console.error('❌ エラー:', error);
        process.exit(1);
    }
}

function displayResult(result: any) {
    if (result.success) {
        console.log('✨ 解析結果:');
        console.log('=====================================\n');
        
        try {
            // JSONとして解析を試みる
            const parsed = JSON.parse(result.analysis);
            console.log(JSON.stringify(parsed, null, 2));
        } catch {
            // JSONでない場合はそのまま表示
            console.log(result.analysis);
        }
        
        console.log('\n=====================================');
        console.log('✅ 解析完了!');
        
        // デバッグ情報
        if (process.env.DEBUG === 'true') {
            console.log('\n📝 デバッグ情報:');
            console.log('- トークン使用量:', result.rawResponse?.usage);
            console.log('- モデル:', GoogleModel.GEMINI_2_0_FLASH);
        }
    } else {
        console.log('❌ 解析失敗');
        console.log('エラー:', result.error);
    }
}

// メイン処理を実行
main();