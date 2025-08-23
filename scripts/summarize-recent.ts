#!/usr/bin/env npx tsx

/**
 * 直近10分以内のサマリー統合スクリプト
 * 
 * 使用方法:
 * npx tsx scripts/summarize-recent.ts
 * 
 * 直近10分以内に作成された全てのscreen_capture_analyzeサマリーを
 * 1つの統合サマリーにまとめます
 */

// .envファイルを読み込み
import 'dotenv/config';
import { generate10MinuteSummary } from '../src/lib/ai/time-interval-summarizer';
import { getSupabaseServiceClient } from '../src/lib/supabase/server';

/**
 * ユーザーIDを取得する
 */
async function getUserId(): Promise<string> {
  const supabase = getSupabaseServiceClient();
  
  // 既存のユーザーIDを取得
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id')
    .limit(1);
  
  if (profiles && profiles.length > 0) {
    return profiles[0].id;
  }
  
  throw new Error('No user found in the database');
}

/**
 * メイン実行関数
 */
async function main() {
  try {
    console.log('🚀 Recent Activity Consolidator (10 Minutes)');
    console.log('==============================================');
    console.log('📅 Generating 10-minute summary using time-interval-summarizer...\n');

    // ユーザーIDを取得
    const userId = await getUserId();
    console.log(`👤 User ID: ${userId}`);

    // time-interval-summarizerを使用して10分間のサマリーを生成
    const result = await generate10MinuteSummary(userId);

    if (!result.success) {
      console.error('❌ Summary generation failed:', result.error);
      if (result.sourceCount === 0) {
        console.log('ℹ️ No recent summaries found. Nothing to consolidate.');
      }
      process.exit(1);
    }

    // 結果を表示
    console.log('\n🎉 Consolidation Complete!');
    console.log('==========================');
    console.log(`💾 Action Log ID: ${result.actionLogId}`);
    console.log(`📊 Source summaries: ${result.sourceCount}`);
    console.log(`⏰ Time range: ${result.timeRange.start.toLocaleString('ja-JP')} - ${result.timeRange.end.toLocaleString('ja-JP')}`);
    
    if (result.summary) {
      console.log('\n📋 Consolidated Summary:');
      console.log(`   ${result.summary}`);
    }

  } catch (error) {
    console.error('❌ Consolidation failed:', error);
    process.exit(1);
  }
}

// スクリプトとして実行された場合のみmainを呼び出し
if (require.main === module) {
  main();
}
