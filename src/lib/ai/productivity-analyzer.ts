/**
 * Simple AI productivity analyzer
 */

import { generateObject } from 'ai';
import { google } from '@ai-sdk/google';
import { z } from 'zod';
import { GoogleModel } from './lm-models';
import { loadVideoData } from './video-loader';
import { PRODUCTIVITY_AGENT_PROMPT } from './prompts';
import { saveUserAdviceRecommendation } from '@/lib/supabase/recommendations';

// Structured schema for productivity analysis (English)
const ProductivityAnalysisSchema = z.object({
  summary: z.object({
    totalTime: z.string().describe('Total analyzed time (minutes)'),
    productivityScore: z.number().min(1).max(100).describe('Productivity score (1-100)'),
    mainActivity: z.string().describe('Primary activity'),
    keyInsights: z.array(z.string()).describe('Key findings, improvement areas, strengths')
  }),
  patterns: z.object({
    repetitiveTasks: z.array(z.object({
      task: z.string().describe('Repeated task'),
      frequency: z.string().describe('Frequency'),
      timeLost: z.string().describe('Time lost'),
      solution: z.string().describe('Concrete solution')
    })).describe('List of repeated tasks'),
    inefficiencies: z.array(z.object({
      issue: z.string().describe('Inefficiency'),
      impact: z.string().describe('Impact'),
      recommendation: z.string().describe('Recommendation')
    })).describe('List of inefficiencies'),
    strengths: z.array(z.string()).describe('Efficient areas / habits to keep')
  }),
  recommendations: z.array(z.object({
    category: z.enum(['shortcut', 'tool', 'workflow', 'automation', 'habit']).describe('Category'),
    priority: z.enum(['critical', 'high', 'medium', 'low']).describe('Priority'),
    title: z.string().describe('Action title'),
    description: z.string().describe('Detailed description and implementation'),
    expectedBenefit: z.string().describe('Expected benefit (time saved, fewer errors, etc.)'),
    implementation: z.object({
      difficulty: z.enum(['easy', 'medium', 'hard']).describe('Implementation difficulty'),
      timeRequired: z.string().describe('Time required'),
      steps: z.array(z.string()).describe('Implementation steps')
    }),
    tools: z.array(z.object({
      name: z.string().describe('Recommended tool name'),
      category: z.enum(['ProductHunt', 'Chrome Extension', 'VSCode Extension', 'Desktop App', 'Web Service']).describe('Tool category'),
      purpose: z.string().describe('What this tool solves'),
      features: z.array(z.string()).describe('Key features'),
      pricing: z.enum(['Free', 'Freemium', 'Paid']).describe('Pricing'),
      alternativeSearch: z.string().describe('Keywords to search on Product Hunt')
    })).optional()
  })).describe('List of improvement recommendations'),
  shortcuts: z.array(z.object({
    action: z.string().describe('Frequent action'),
    currentMethod: z.string().describe('Current method'),
    shortcut: z.string().describe('Recommended shortcut'),
    timeSaved: z.string().describe('Time saved per action'),
    platform: z.string().describe('Mac|Windows|VSCode|Chrome|App name')
  })).describe('Shortcut suggestions'),
  actionPlan: z.object({
    immediate: z.array(z.string()).describe('Do now (within 5 minutes) / today'),
    thisWeek: z.array(z.string()).describe('Adopt this week / habits to establish'),
    thisMonth: z.array(z.string()).describe('Goals for this month / skills to learn')
  }),
  productHuntSearch: z.object({
    suggestedSearches: z.array(z.object({
      query: z.string().describe('Search query'),
      purpose: z.string().describe('What problem it solves'),
      expectedTools: z.array(z.string()).describe('Expected tool types')
    })).describe('Recommended search queries'),
    recommendedCategories: z.array(z.string()).describe('Recommended categories')
  }),
  userAdvice: z.string().describe('Simple plain text advice (NOT JSON): one specific actionable improvement within 3 lines. Example: "Press Cmd+Tab to switch between apps instead of using the mouse. This saves 2-3 seconds per switch and keeps your hands on the keyboard."')
});

/**
 * Save user advice to Supabase recommendations table
 */
export async function saveProductivityRecommendation(userAdvice: string, userId: string): Promise<void> {
  try {
    const saveResult = await saveUserAdviceRecommendation({
      userAdvice,
      userId,
    });
    
    if (saveResult.success) {
      console.log('✅ Recommendation saved to database:', saveResult.id);
    } else {
      console.warn('⚠️ Failed to save recommendation:', saveResult.error);
    }
  } catch (error) {
    console.warn('⚠️ Error saving recommendation:', error);
  }
}

/**
 * Send productivity advice as notification
 */
export async function sendProductivityNotification(userAdvice: string): Promise<void> {
  try {
    await fetch('/api/send-productivity-advice', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: '💡 Productivity Advice',
        body: userAdvice
      })
    });
    console.log('📱 Productivity advice notification sent');
  } catch (error) {
    console.warn('⚠️ Failed to send notification:', error);
    // Notification errors do not affect analysis results
  }
}

// Session data (from SessionContext)
export interface SessionRecord {
  id: string;
  startedAt: number;
  stoppedAt?: number;
  log: AgentLogItem[];
  tips: AgentTip[];
  videoPath?: string; // Video file path (local or Supabase)
  videoBase64?: string; // Base64 encoded video
}

export interface AgentLogItem {
  id: string;
  ts: number;
  level: 'info' | 'warn' | 'error';
  message: string;
}

export interface AgentTip {
  id: string;
  ts: number;
  title: string;
  detail?: string;
}

// Analysis result interface
export interface ProductivityAnalysis {
  success: boolean;
  analysis: Record<string, unknown> | null; // JSON analysis result
  error?: string;
}

/**
 * Analyze video from path (local file, Supabase storage, or URL)
 */
export async function analyzeVideoFromPath(path: string, userId?: string): Promise<ProductivityAnalysis> {
  try {
    console.log('🎥 Loading video:', path);
    
    // Get video data from path (with automatic compression and frame extraction support)
    const result = await loadVideoData(path);
    
    if (result.type === 'video') {
      // Analyze as video
      return analyzeVideoBase64(result.data as string, userId);
    } else {
      // Analyze as frames
      return analyzeFrames(result.data as string[], userId);
    }
  } catch (error) {
    console.error('❌ Video loading error:', error);
    return {
      success: false,
      analysis: null,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Analyze video from Base64 encoded data
 */
export async function analyzeVideoBase64(videoBase64: string, userId?: string): Promise<ProductivityAnalysis> {
  try {
    const sizeInMB = (videoBase64.length * 0.75 / 1024 / 1024).toFixed(2);
    console.log('📊 Video size (estimated):', sizeInMB, 'MB');
    console.log('🤖 Starting video analysis');
    
    const result = await generateObject({
      model: google(GoogleModel.GEMINI_2_5_FLASH),
      system: PRODUCTIVITY_AGENT_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Please analyze this recorded data.'
            },
            {
              type: 'image',
              image: `data:video/mp4;base64,${videoBase64}`
            }
          ]
        }
      ],
      schema: ProductivityAnalysisSchema,
      temperature: 0.3,
    });
    
    console.log('📝 Analysis complete');
    
    // Use structured result directly
    const analysis = result.object;
    
    // Save and notify user advice when analysis is complete
    if (analysis && analysis.userAdvice) {
      // First save recommendation to Supabase
      if (userId) {
        await saveProductivityRecommendation(analysis.userAdvice, userId);
      } else {
        console.warn('⚠️ User ID unknown, skipping recommendation save');
      }
      
      // Then send notification
      await sendProductivityNotification(analysis.userAdvice);
    }
    
    return {
      success: true,
      analysis,
    };

  } catch (error) {
    console.error('❌ Analysis error:', error);
    return {
      success: false,
      analysis: null,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}


/**
 * Analyze multiple frames extracted from video
 */
export async function analyzeFrames(frames: string[], userId?: string): Promise<ProductivityAnalysis> {
  try {
    console.log(`🖼️ Analyzing ${frames.length} frames`);
    
    const result = await generateObject({
      model: google(GoogleModel.GEMINI_2_5_FLASH),
      system: PRODUCTIVITY_AGENT_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Please analyze the following screenshots.'
            },
            ...frames.map((frame) => ({
              type: 'image' as const,
              image: `data:image/jpeg;base64,${frame}`
            }))
          ]
        }
      ],
      schema: ProductivityAnalysisSchema,
      temperature: 0.3,
    });
    
    console.log('📝 Frame analysis complete');
    
    // Use structured result directly
    const analysis = result.object;
    
    // Save and notify user advice when analysis is complete
    if (analysis && analysis.userAdvice) {
      // First save recommendation to Supabase
      if (userId) {
        await saveProductivityRecommendation(analysis.userAdvice, userId);
      } else {
        console.warn('⚠️ User ID unknown, skipping recommendation save');
      }
      
      // Then send notification
      await sendProductivityNotification(analysis.userAdvice);
    }
    
    return {
      success: true,
      analysis,
    };

  } catch (error) {
    console.error('❌ Frame analysis error:', error);
    return {
      success: false,
      analysis: null,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}