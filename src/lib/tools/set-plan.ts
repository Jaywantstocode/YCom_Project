/**
 * Tool for setting productivity improvement plan
 */

import { z } from 'zod';

// Plan schema based on the system prompt
const setPlanParams = z.object({
  summary: z.object({
    totalTime: z.string().describe('分析した時間（分）'),
    productivityScore: z.number().min(1).max(100).describe('生産性スコア'),
    mainActivity: z.string().describe('主な作業内容'),
    keyInsights: z.array(z.string()).describe('重要な発見')
  }),
  patterns: z.object({
    repetitiveTasks: z.array(z.object({
      task: z.string().describe('繰り返し作業の内容'),
      frequency: z.string().describe('頻度'),
      timeLost: z.string().describe('失われた時間'),
      solution: z.string().describe('具体的な解決策')
    })),
    inefficiencies: z.array(z.object({
      issue: z.string().describe('非効率な点'),
      impact: z.string().describe('影響度'),
      recommendation: z.string().describe('改善提案')
    })),
    strengths: z.array(z.string()).describe('既に効率的な点')
  }),
  recommendations: z.array(z.object({
    category: z.enum(['shortcut', 'tool', 'workflow', 'automation', 'habit']),
    priority: z.enum(['critical', 'high', 'medium', 'low']),
    title: z.string(),
    description: z.string(),
    expectedBenefit: z.string(),
    implementation: z.object({
      difficulty: z.enum(['easy', 'medium', 'hard']),
      timeRequired: z.string(),
      steps: z.array(z.string())
    }),
    tools: z.array(z.object({
      name: z.string(),
      category: z.string(),
      purpose: z.string(),
      features: z.array(z.string()),
      pricing: z.enum(['Free', 'Freemium', 'Paid']),
      alternativeSearch: z.string()
    })).optional()
  })),
  shortcuts: z.array(z.object({
    action: z.string(),
    currentMethod: z.string(),
    shortcut: z.string(),
    timeSaved: z.string(),
    platform: z.string()
  })),
  actionPlan: z.object({
    immediate: z.array(z.string()),
    thisWeek: z.array(z.string()),
    thisMonth: z.array(z.string())
  }),
  productHuntSearch: z.object({
    suggestedSearches: z.array(z.string()).describe('Product Huntで検索すべきクエリのリスト')
  })
});

// Core function
const setPlanCore = async (plan: z.infer<typeof setPlanParams>) => {
  console.log('📋 Plan set successfully');
  console.log('🔍 Suggested searches:', plan.productHuntSearch.suggestedSearches);
  console.log('📊 Productivity score:', plan.summary.productivityScore);
  console.log('🎯 Priority recommendations:', plan.recommendations.filter(r => r.priority === 'critical' || r.priority === 'high').length);
  
  return {
    success: true,
    message: 'Productivity improvement plan has been set',
    searchQueries: plan.productHuntSearch.suggestedSearches,
    plan: plan
  };
};

// Export as tool for AI SDK
export const setPlan = {
  description: 'Set a comprehensive productivity improvement plan based on video analysis. This should be called first to establish the analysis results and determine what tools to search for.',
  inputSchema: setPlanParams,
  execute: setPlanCore,
};