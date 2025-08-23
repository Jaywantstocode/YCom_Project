#!/usr/bin/env tsx

require('dotenv').config();

import { join } from 'path';
import { analyzeVideoFromPath } from '../src/lib/ai/productivity-analyzer';

async function main() {
    try {
        console.log('🚀 Productivity Analyzer Video Debug');
        console.log('=====================================\n');
        
        // コマンドライン引数から動画パスを取得
        const videoPath = process.argv[2];
        
        if (!videoPath) {
            console.log('使用方法:');
            console.log('  pnpm tsx scripts/debug-productivity-analyzer.ts <パス>\n');
            console.log('パスの例:');
            console.log('  - ローカル: videos/sample.mp4');
            console.log('  - ローカル絶対パス: /Users/name/videos/sample.mp4');
            console.log('  - Supabase: supabase://videos/session-123.mp4');
            console.log('  - URL: https://example.com/video.mp4\n');
            
            // デフォルトパスで試す
            const defaultPath = 'videos/sample.mp4';
            console.log(`📁 デフォルトパスで実行: ${defaultPath}\n`);
            
            const result = await analyzeVideoFromPath(defaultPath);
            displayResult(result);
        } else {
            // 相対パスの場合は絶対パスに変換（Supabase/URL以外）
            let fullPath = videoPath;
            if (!videoPath.startsWith('supabase://') && 
                !videoPath.startsWith('storage://') && 
                !videoPath.startsWith('http://') && 
                !videoPath.startsWith('https://') &&
                !videoPath.startsWith('/')) {
                fullPath = join(process.cwd(), videoPath);
            }
            
            console.log('📍 解析対象:', fullPath, '\n');
            const result = await analyzeVideoFromPath(fullPath);
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
            console.log('- Gemini 2.0 Flash使用');
            console.log('- 環境変数:');
            console.log('  - NEXT_PUBLIC_SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL ? '✓' : '✗');
            console.log('  - NEXT_PUBLIC_SUPABASE_ANON_KEY:', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '✓' : '✗');
            console.log('  - SUPABASE_SERVICE_KEY:', process.env.SUPABASE_SERVICE_KEY ? '✓' : '✗');
        }
    } else {
        console.log('❌ 解析失敗');
        console.log('エラー:', result.error);
    }
}

// メイン処理を実行
main();