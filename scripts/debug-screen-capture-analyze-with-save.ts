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
 * ランダムなaction_log IDを生成
 */
function generateActionLogId(): string {
    return randomUUID();
}



/**
 * 範囲指定で複数画像を処理
 */
async function processImageRange(startIndex: number, endIndex: number, userId: string) {
    const images = getAvailableImages();
    const totalImages = images.length;
    
    // 範囲のバリデーション
    if (startIndex < 0) startIndex = 0;
    if (endIndex >= totalImages) endIndex = totalImages - 1;
    if (startIndex > endIndex) {
        console.error('❌ エラー: 開始インデックスが終了インデックスより大きいです');
        return;
    }
    
    const imageCount = endIndex - startIndex + 1;
    console.log(`📊 範囲処理: ${startIndex}-${endIndex} (${imageCount}枚の画像)`);
    console.log('='.repeat(50));
    
    const results = [];
    let successCount = 0;
    let failCount = 0;
    
    for (let i = startIndex; i <= endIndex; i++) {
        console.log(`\n🖼️  画像 ${i}/${endIndex} (${images[i]})`);
        console.log('-'.repeat(30));
        
        try {
            const imagePath = path.join(CAPTURED_FRAMES_DIR, images[i]);
            const imageBuffer = fs.readFileSync(imagePath);
            
            // action_log IDを生成
            const hasValidUser = await checkIfUserExists(userId);
            let actionLogId: string | null = null;
            
            if (hasValidUser) {
                actionLogId = generateActionLogId();
                console.log(`🆔 Action Log ID生成: ${actionLogId}`);
            }
            
            // AI分析を実行
            let result;
            if (hasValidUser && actionLogId) {
                result = await analyzeAndSaveScreenCapture({
                    image: imageBuffer,
                    timestamp: Date.now(),
                    userId: userId,
                    actionLogId: actionLogId
                });
            } else {
                result = await analyzeScreenCapture({
                    image: imageBuffer,
                    timestamp: Date.now()
                });
            }
            
            if (result.success) {
                console.log(`✅ 成功: ${result.analysis?.description || 'No description'}`);
                if (result.actionLogId) {
                    console.log(`💾 Action Log ID: ${result.actionLogId}`);
                }
                successCount++;
            } else {
                console.log(`❌ 失敗: ${result.error}`);
                failCount++;
            }
            
            results.push({
                index: i,
                image: images[i],
                result
            });
            
            // 次の処理前に少し待機（API制限対策）
            if (i < endIndex) {
                console.log('⏳ 待機中... (2秒)');
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
            
        } catch (error) {
            console.error(`❌ 画像 ${i} 処理エラー:`, error);
            failCount++;
        }
    }
    
    // 結果サマリー
    console.log('\n📈 範囲処理完了');
    console.log('='.repeat(30));
    console.log(`📊 統計:`);
    console.log(`   ✅ 成功: ${successCount}`);
    console.log(`   ❌ 失敗: ${failCount}`);
    console.log(`   📊 合計: ${imageCount}`);
    console.log(`   📈 成功率: ${Math.round((successCount / imageCount) * 100)}%`);
    
    return results;
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
        console.log('  npm run analyze-and-save --range [開始] [終了]');
        console.log('');
        console.log('例:');
        console.log('  npm run analyze-and-save           # デフォルト画像（インデックス10）を分析&保存');
        console.log('  npm run analyze-and-save 25        # インデックス25の画像を分析&保存');
        console.log('  npm run analyze-and-save 0         # 最初の画像を分析&保存');
        console.log('  npm run analyze-and-save --range 5 15    # インデックス5-15の画像を順次処理');
        console.log('  npm run analyze-and-save --range 0 50    # インデックス0-50の画像を順次処理');
        console.log('');
        console.log('機能:');
        console.log('  - AI分析実行');
        console.log('  - テスト用profileレコード作成（必要に応じて）');
        console.log('  - テスト用action_logsレコード作成');
        console.log('  - action_logsテーブルへの保存');
        console.log('  - データベース保存結果の確認');
        console.log('  - 範囲指定での連続処理（--rangeオプション）');
        console.log('');
        console.log('注意:');
        console.log('  - OPENAI_API_KEY環境変数が必要です');
        console.log('  - SUPABASE_SERVICE_ROLE_KEY環境変数が必要です');
        console.log('  - 先に npm run extract-frames で画像を生成してください');
        console.log('  - 範囲処理では各画像間に2秒の待機時間があります');
        return;
    }
    
    try {
        console.log('🔬 画像分析&保存デバッグツール');
        console.log('================================');
        
        // 既存ユーザーIDを取得
        console.log('🗄️  テスト用ユーザーID取得中...');
        TEST_USER_ID = await getOrCreateTestUserId();
        console.log(`🆔 使用するUser ID: ${TEST_USER_ID}`);
        
        // 範囲処理かどうかをチェック
        if (args[0] === '--range') {
            if (args.length < 3) {
                console.error('❌ エラー: --rangeオプションには開始と終了インデックスが必要です');
                console.error('例: npm run analyze-and-save --range 5 15');
                process.exit(1);
            }
            
            const startIndex = parseInt(args[1]);
            const endIndex = parseInt(args[2]);
            
            if (isNaN(startIndex) || isNaN(endIndex)) {
                console.error('❌ エラー: インデックスは数字で指定してください');
                console.error('例: npm run analyze-and-save --range 5 15');
                process.exit(1);
            }
            
            if (startIndex > endIndex) {
                console.error('❌ エラー: 開始インデックスは終了インデックス以下である必要があります');
                process.exit(1);
            }
            
            // 範囲処理を実行
            await processImageRange(startIndex, endIndex, TEST_USER_ID);
            
        } else {
            // 単一画像処理（従来の処理）
            const imageIndex = args[0] ? parseInt(args[0]) : DEFAULT_IMAGE_INDEX;
            
            if (isNaN(imageIndex)) {
                console.error('❌ エラー: 画像インデックスは数字で指定してください');
                console.error('例: npm run analyze-and-save 10');
                process.exit(1);
            }
            
            // 画像パスを取得
            const imagePath = getImagePath(imageIndex);
            
            // 既存ユーザーがいる場合のみデータベース操作を実行
            let actionLogId: string | null = null;
            const hasValidUser = await checkIfUserExists(TEST_USER_ID);
            
            if (hasValidUser) {
                actionLogId = generateActionLogId();
                console.log(`🆔 Action Log ID生成: ${actionLogId}`);
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