#!/usr/bin/env npx tsx
/**
 * Debug script for analyzing recordings from public URLs
 * Usage: npx tsx scripts/debug-agent.ts <URL>
 * Example: npx tsx scripts/debug-agent.ts https://ooeziwqlhmevflojdfhu.supabase.co/storage/v1/object/public/captures/recordings/1755987999895-vdofda45mj.webm
 */

import { analyzeVideoFromPath } from '../src/lib/ai/productivity-analyzer';
import dotenv from 'dotenv';
import { existsSync } from 'fs';
import path from 'path';

// 環境変数を読み込み
const envPath = path.join(process.cwd(), '.env.local');
if (existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  dotenv.config();
}

// 色付きコンソール出力のヘルパー
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
};

function printHeader(message: string) {
  console.log(`\n${colors.bright}${colors.cyan}${'='.repeat(60)}${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}${message}${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}${'='.repeat(60)}${colors.reset}\n`);
}

function printInfo(label: string, value: string) {
  console.log(`${colors.yellow}${label}:${colors.reset} ${value}`);
}

function printSuccess(message: string) {
  console.log(`${colors.green}✅ ${message}${colors.reset}`);
}

function printError(message: string) {
  console.error(`${colors.red}❌ ${message}${colors.reset}`);
}


async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    printHeader('📹 Recording Debug Tool');
    console.log('Usage: npx tsx scripts/debug-agent.ts <URL or Path>');
    console.log('\nExamples:');
    console.log('  - Public URL:  npx tsx scripts/debug-agent.ts https://example.com/video.webm');
    console.log('  - Local file:  npx tsx scripts/debug-agent.ts ./recordings/session.mp4');
    console.log('  - Supabase:    npx tsx scripts/debug-agent.ts supabase://captures/recordings/video.webm');
    process.exit(1);
  }

  const inputPath = args[0];
  
  printHeader('🔍 Recording Analysis Debug Tool');
  printInfo('Input', inputPath);
  printInfo('Timestamp', new Date().toISOString());
  
  // 環境変数の確認
  console.log('\n' + colors.dim + '📋 Environment Check:' + colors.reset);
  const requiredEnvVars = [
    'GOOGLE_AI_API_KEY',
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY'
  ];
  
  let missingEnvVars = [];
  for (const envVar of requiredEnvVars) {
    if (process.env[envVar]) {
      console.log(`  ${colors.green}✓${colors.reset} ${envVar}: ${colors.dim}${process.env[envVar]?.substring(0, 10)}...${colors.reset}`);
    } else {
      console.log(`  ${colors.red}✗${colors.reset} ${envVar}: ${colors.red}Missing${colors.reset}`);
      missingEnvVars.push(envVar);
    }
  }
  
  if (missingEnvVars.length > 0 && !missingEnvVars.every(v => v.includes('SUPABASE'))) {
    printError(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
    console.log('\nPlease set up your .env.local file with the required API keys.');
    process.exit(1);
  }
  
  // パスの種類を判定
  let pathType: string;
  if (inputPath.startsWith('https://') || inputPath.startsWith('http://')) {
    pathType = 'Public URL';
    printInfo('Type', '🌐 ' + pathType);
  } else if (inputPath.startsWith('supabase://') || inputPath.startsWith('storage://')) {
    pathType = 'Supabase Storage';
    printInfo('Type', '☁️ ' + pathType);
  } else {
    pathType = 'Local File';
    printInfo('Type', '📁 ' + pathType);
    if (!existsSync(inputPath)) {
      printError(`File not found: ${inputPath}`);
      process.exit(1);
    }
  }
  
  console.log('\n' + colors.dim + '─'.repeat(60) + colors.reset);
  
  try {
    printHeader('🚀 Starting Analysis');
    console.log('This may take a few minutes depending on the video size...\n');
    
    const startTime = Date.now();
    
    // 解析を実行
    const result = await analyzeVideoFromPath(inputPath);
    
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    
    console.log('\n' + colors.dim + '─'.repeat(60) + colors.reset);
    
    if (result.success) {
      printHeader('✨ Analysis Complete');
      printSuccess(`Analysis completed in ${duration} seconds`);
      
      // JSON解析結果を表示
      if (result.analysis) {
        console.log('\n' + colors.bright + '📊 Analysis Result:' + colors.reset);
        console.log(colors.cyan + '─'.repeat(60) + colors.reset);
        console.log(JSON.stringify(result.analysis, null, 2));
        console.log(colors.cyan + '─'.repeat(60) + colors.reset);
        
        // 主要な情報を見やすく表示
        const analysis = result.analysis;
        if (analysis.workSummary) {
          console.log('\n' + colors.bright + '📝 Work Summary:' + colors.reset);
          console.log(analysis.workSummary);
        }
        
        if (analysis.productivityScore) {
          console.log('\n' + colors.bright + '📈 Productivity Score:' + colors.reset);
          console.log(`${analysis.productivityScore}/100`);
        }
        
        if (analysis.topRecommendation) {
          console.log('\n' + colors.bright + '⭐ Top Recommendation:' + colors.reset);
          console.log(`Title: ${analysis.topRecommendation.title}`);
          console.log(`Action: ${analysis.topRecommendation.action}`);
          console.log(`Expected Benefit: ${analysis.topRecommendation.expectedBenefit}`);
        }
        
        if (analysis.userAdvice) {
          console.log('\n' + colors.bright + '💡 User Advice:' + colors.reset);
          console.log(analysis.userAdvice);
        }
        
        // 統計情報を表示
        console.log('\n' + colors.bright + '⏱️ Statistics:' + colors.reset);
        printInfo('Duration', `${duration} seconds`);
        printInfo('Status', 'Success');
        if (analysis.totalTimeMinutes) {
          printInfo('Analyzed Time', `${analysis.totalTimeMinutes} minutes`);
        }
      } else {
        console.log('\n' + colors.yellow + '⚠️ No analysis returned' + colors.reset);
      }
      
    } else {
      printHeader('⚠️ Analysis Failed');
      printError('Analysis failed');
      if (result.error) {
        console.log('\n' + colors.red + 'Error Details:' + colors.reset);
        console.error(result.error);
      }
      process.exit(1);
    }
    
  } catch (error) {
    printHeader('💥 Unexpected Error');
    printError('An unexpected error occurred during analysis');
    console.error('\n' + colors.red + 'Error Details:' + colors.reset);
    console.error(error);
    
    if (error instanceof Error) {
      console.log('\n' + colors.yellow + 'Stack Trace:' + colors.reset);
      console.log(colors.dim + error.stack + colors.reset);
    }
    
    process.exit(1);
  }
}

// エラーハンドリング
process.on('unhandledRejection', (reason, promise) => {
  printError('Unhandled Rejection at:');
  console.error(promise);
  console.error('Reason:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  printError('Uncaught Exception:');
  console.error(error);
  process.exit(1);
});

// メイン関数を実行
main().catch(error => {
  printError('Fatal error in main function:');
  console.error(error);
  process.exit(1);
});