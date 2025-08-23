#!/usr/bin/env tsx

// .envファイルを読み込み
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { analyzeAndSaveScreenCapture, analyzeScreenCapture } from '../src/lib/ai/screen-capture-interpreter';
import { getSupabaseServiceClient } from '../src/lib/supabase/server';

// 設定
const CAPTURED_FRAMES_DIR = path.join(__dirname, '..', 'captured-frames');
const DEFAULT_IMAGE_INDEX = 10;

// テスト用UUIDは動的に取得
let TEST_USER_ID: string;

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
 * 既存のユーザーIDを取得するか、テスト用profileを作成
 */
async function getOrCreateTestUserId(): Promise<string> {
    try {
        const supabase = getSupabaseServiceClient();
        
        // 既存のprofileから1つ取得
        const { data: existingProfiles } = await supabase
            .from('profiles')
            .select('id')
            .limit(1);
            
        if (existingProfiles && existingProfiles.length > 0) {
            const userId = existingProfiles[0].id;
            console.log(`✅ 既存のユーザーIDを使用: ${userId}`);
            return userId;
        }
        
        // 既存のユーザーがいない場合は、foreign key制約をスキップしてテスト
        console.log('⚠️  既存のユーザーが見つかりません。テスト用UUIDを使用します。');
        console.log('⚠️  データベース保存はスキップし、AI分析のみ実行します。');
        return randomUUID(); // ダミーID
        
    } catch (error) {
        console.error('❌ ユーザーID取得エラー:', error);
        throw error;
    }
}

/**
 * ユーザーIDが有効かチェック
 */
async function checkIfUserExists(userId: string): Promise<boolean> {
    try {
        const supabase = getSupabaseServiceClient();
        
        const { data, error } = await supabase
            .from('profiles')
            .select('id')
            .eq('id', userId)
            .single();
            
        return !error && !!data;
    } catch (error) {
        return false;
    }
}

/**
 * テスト用のaction_logsレコードを作成
 */
async function createTestActionLog(userId: string): Promise<string> {
    try {
        const supabase = getSupabaseServiceClient();
        const now = new Date().toISOString();
        
        const { data, error } = await supabase
            .from('action_logs')
            .insert({
                user_id: userId,
                started_at: now,
                type: 'screen_capture_analyze',
                details: {
                    test: true,
                    debug_script: 'debug-screen-capture-analyze-with-save.ts',
                    original_source: 'debug_analyzer'
                }
            })
            .select('id')
            .single();
            
        if (error) {
            throw new Error(`Failed to create test action log: ${error.message}`);
        }
        
        console.log(`✅ テスト用action_logを作成: ${data.id}`);
        return data.id;
        
    } catch (error) {
        console.error('❌ テスト用action_log作成エラー:', error);
        throw error;
    }
}



/**
 * メイン関数
 */
async function main() {
    const args = process.argv.slice(2);
    
    // ヘルプ表示
    if (args.includes('--help') || args.includes('-h')) {
        console.log('🔬 画像分析&保存デバッグツール');
        console.log('================================');
        console.log('');
        console.log('使用方法:');
        console.log('  npm run analyze-and-save [画像インデックス]');
        console.log('');
        console.log('例:');
        console.log('  npm run analyze-and-save           # デフォルト画像（インデックス10）を分析&保存');
        console.log('  npm run analyze-and-save 25        # インデックス25の画像を分析&保存');
        console.log('  npm run analyze-and-save 0         # 最初の画像を分析&保存');
        console.log('');
        console.log('機能:');
        console.log('  - AI分析実行');
        console.log('  - テスト用profileレコード作成（必要に応じて）');
        console.log('  - テスト用action_logsレコード作成');
        console.log('  - action_logsテーブルへの保存');
        console.log('  - データベース保存結果の確認');
        console.log('');
        console.log('注意:');
        console.log('  - OPENAI_API_KEY環境変数が必要です');
        console.log('  - SUPABASE_SERVICE_ROLE_KEY環境変数が必要です');
        console.log('  - 先に npm run extract-frames で画像を生成してください');
        return;
    }
    
    try {
        // 画像インデックスを取得
        const imageIndex = args[0] ? parseInt(args[0]) : DEFAULT_IMAGE_INDEX;
        
        if (isNaN(imageIndex)) {
            console.error('❌ エラー: 画像インデックスは数字で指定してください');
            console.error('例: npm run analyze-and-save 10');
            process.exit(1);
        }
        
        console.log('🔬 画像分析&保存デバッグツール');
        console.log('================================');
        
        // 画像パスを取得
        const imagePath = getImagePath(imageIndex);
        
        console.log('🗄️  テスト用ユーザーID取得中...');
        
        // 既存ユーザーIDを取得
        TEST_USER_ID = await getOrCreateTestUserId();
        console.log(`🆔 使用するUser ID: ${TEST_USER_ID}`);
        
        // 既存ユーザーがいる場合のみデータベース操作を実行
        let actionLogId: string | null = null;
        const hasValidUser = await checkIfUserExists(TEST_USER_ID);
        
        if (hasValidUser) {
            console.log('🗄️  テスト用action_logレコード作成中...');
            actionLogId = await createTestActionLog(TEST_USER_ID);
        } else {
            console.log('⚠️  有効なユーザーがいないため、AI分析のみを実行します');
        }
        
        console.log('🤖 AI分析&データベース保存を実行中...');
        
        // 画像を読み込んでAI分析を実行
        const imageBuffer = fs.readFileSync(imagePath);
        
        let result;
        if (hasValidUser && actionLogId) {
            // データベース保存ありのAI分析
            result = await analyzeAndSaveScreenCapture({
                image: imageBuffer,
                timestamp: Date.now(),
                userId: TEST_USER_ID,
                actionLogId: actionLogId
            });
        } else {
            // AI分析のみ（データベース保存なし）
            result = await analyzeScreenCapture({
                image: imageBuffer,
                timestamp: Date.now()
            });
        }
        
        console.log('✨ 分析&保存結果:');
        console.log('================');
        console.log(JSON.stringify(result, null, 2));
        
        // データベース保存結果を確認
        if (hasValidUser && result.success && result.actionLogId) {
            console.log('');
            console.log('🎉 すべての処理が正常に完了しました！');
            console.log(`🔗 Action Log ID: ${result.actionLogId}`);
        } else if (!hasValidUser && result.success) {
            console.log('');
            console.log('✅ AI分析が正常に完了しました！');
            console.log('ℹ️  データベース保存はスキップされました（有効なユーザーがいないため）');
        } else {
            console.log('');
            console.log('⚠️  処理中に問題が発生しました');
        }
        
    } catch (error) {
        console.error(`❌ エラー: ${error instanceof Error ? error.message : error}`);
        console.error('');
        console.error('💡 トラブルシューティング:');
        console.error('1. OPENAI_API_KEY環境変数が設定されているか確認');
        console.error('2. SUPABASE_SERVICE_ROLE_KEY環境変数が設定されているか確認');
        console.error('3. NEXT_PUBLIC_SUPABASE_URL環境変数が設定されているか確認');
        console.error('4. 画像ファイルが存在するか確認: npm run extract-frames <動画ファイル>');
        console.error('5. 画像インデックスが正しいか確認');
        console.error('6. Supabaseデータベースへの接続が正常か確認');
        process.exit(1);
    }
}

// スクリプトが直接実行された場合のみメイン関数を実行
if (require.main === module) {
    main();
}