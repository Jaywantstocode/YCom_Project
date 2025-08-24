import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';
import { getDefaultModel, getModelConfig } from './lm-models';
import { getSupabaseServiceClient } from '../supabase/server';
import { generateActionLogEmbedding } from './embedding';
import { Database } from '../supabase/database.types';

/**
 * Send a server push notification with absolute URL when on server
 */
async function sendProductivityNotification(body: string, title = '💡 Screen Summary'): Promise<void> {
  try {
    const isBrowser = typeof window !== 'undefined';
    const base = isBrowser
      ? ''
      : (process.env.NOTIFICATION_BASE_URL
          || process.env.NEXT_PUBLIC_APP_URL
          || `http://localhost:${process.env.PORT || 3000}`);
    const url = `${base}/api/send-productivity-advice`;

    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, body })
    });
  } catch (err) {
    console.warn('Failed to send productivity notification:', err);
  }
}

// AI analysis input parameters (all optional)
export interface AnalysisInput {
  image?: Buffer | string; // Image data (Buffer) or URL
  audio?: Buffer | string; // Audio data (Buffer) or URL  
  timestamp?: number; // Timestamp when captured (Unix timestamp)
  userId?: string; // User ID for database storage
  actionLogId?: string; // Action log ID to associate with analysis
}

// AI analysis result - サマリのみに特化
export interface AnalysisResult {
  success: boolean;
  timestamp: number;
  analysis?: {
    description: string;
  };
  error?: string;
  actionLogId?: string; // ID of the created or updated action log record
}

// Zod schema for structured output - サマリのみ
const AnalysisSchema = z.object({
  description: z.string().describe("Concise summary of what is displayed on the screen")
});


// Check if API key is configured
function checkAPIKey(): void {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured');
  }
}

// Encode image to Base64 format
function encodeImageToBase64(imageData: Buffer): string {
  return `data:image/png;base64,${imageData.toString('base64')}`;
}

// Type definition for action_logs table
type ActionLogInsert = Database['public']['Tables']['action_logs']['Insert'];

/**
 * Save screen capture summary to action_logs table
 * サマリのみをsummary fieldに保存
 */
async function saveAnalysisResultToDatabase(
  analysisData: { description: string },
  userId: string,
  actionLogId: string,
  timestamp: number
): Promise<string> {
  try {
    const supabase = getSupabaseServiceClient();
    
    // サマリから簡単なタグを生成
    const words = analysisData.description.toLowerCase().split(/\s+/);
    const tags = words
      .filter(word => word.length > 3)
      .slice(0, 5); // 最大5個のタグ

    // 埋め込みを生成（summary + details + tags）
    let embedding: string | null = null;
    try {
      const detailsForEmbedding = { capture_type: 'screen_summary' } as Record<string, unknown>;
      embedding = await generateActionLogEmbedding(
        analysisData.description,
        detailsForEmbedding,
        tags,
      );
    } catch (embedErr) {
      console.warn('Embedding generation failed, proceeding without it:', embedErr);
    }

    // Action log data structure: サマリのみ、detailsは空白
    const actionLogData: ActionLogInsert = {
      id: actionLogId,
      user_id: userId,
      type: 'screen_capture_analyze',
      summary: analysisData.description,
      details: null,
      tags: tags.length > 0 ? tags : null,
      started_at: new Date(timestamp).toISOString(),
      ended_at: new Date().toISOString(),
      embedding: embedding ?? null,
    };

    const { data, error } = await supabase
      .from('action_logs')
      .upsert(actionLogData)
      .select('id')
      .single();

    if (error) {
      console.error('❌ Failed to save summary to database:', error);
      throw new Error(`Database save failed: ${error.message}`);
    }

    console.log('✅ Summary saved to database with ID:', data.id);
    return data.id;

  } catch (error) {
    console.error('❌ Database save error:', error);
    throw error;
  }
}

/**
 * スクリーンキャプチャのサマリ生成関数
 * 画面に表示されている内容の簡潔な要約のみを生成
 */
export async function analyzeScreenCapture(input: AnalysisInput): Promise<AnalysisResult> {
  const timestamp = input.timestamp || Date.now();
  console.log('🔬 analyzeScreenCapture started:', { hasImage: !!input.image, hasAudio: !!input.audio, timestamp });
  
  try {
    // Return simple response if no image is provided
    if (!input.image) {
      return {
        success: true,
        timestamp,
        analysis: {
          description: 'No image data provided - waiting for screen capture',
        }
      };
    }

    checkAPIKey();
    
    // Prepare image data
    let imageUrl: string;
    if (input.image instanceof Buffer) {
      imageUrl = encodeImageToBase64(input.image);
    } else {
      imageUrl = input.image as string; // Use URL directly if provided
    }

    // Get the default vision model for analysis (use FAST_ANALYSIS for better response)
    const modelId = getDefaultModel('FAST_ANALYSIS');
    const modelConfig = getModelConfig(modelId);
    console.log('🤖 Using model:', { modelId, name: modelConfig?.name });

    // Use generateObject for structured output
    const result = await generateObject({
      model: openai(modelId),
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Create a concise summary of what is currently displayed on this screen.

Focus on:
- Main application or content visible
- Primary activity or task being performed
- Key elements or information shown

Provide only a brief, factual description in English without analysis or suggestions.`
            },
            {
              type: "image",
              image: imageUrl
            }
          ]
        }
      ],
      schema: AnalysisSchema,
      temperature: 0.7,
    });

    console.log('🔍 AI response:', {
      object: result.object,
      usage: result.usage
    });

    return {
      success: true,
      timestamp,
      analysis: {
        description: result.object.description || 'Screen summary completed'
      }
    };

  } catch (error) {
    console.error('AI analysis error:', error);
    return {
      success: false,
      timestamp,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * スクリーンキャプチャサマリ生成とデータベース保存
 * サマリを生成してSupabaseデータベースに保存
 */
export async function analyzeAndSaveScreenCapture(input: AnalysisInput): Promise<AnalysisResult> {
  const timestamp = input.timestamp || Date.now();
  console.log('🔬 analyzeAndSaveScreenCapture started:', { 
    hasImage: !!input.image, 
    hasAudio: !!input.audio, 
    hasUserId: !!input.userId,
    hasActionLogId: !!input.actionLogId,
    timestamp 
  });

  try {
    // First, perform the AI analysis
    const analysisResult = await analyzeScreenCapture(input);
    
    if (!analysisResult.success || !analysisResult.analysis) {
      console.log('❌ Analysis failed, skipping database save');
      return analysisResult;
    }

    // Save to database if userId and actionLogId are provided
    if (input.userId && input.actionLogId) {
      try {
        const actionLogId = await saveAnalysisResultToDatabase(
          analysisResult.analysis,
          input.userId,
          input.actionLogId,
          timestamp
        );
        // Send server push with the summary after successful analysis
        if (analysisResult.analysis?.description) {
          await sendProductivityNotification(analysisResult.analysis.description);
        }
        
        return {
          ...analysisResult,
          actionLogId
        };
      } catch (dbError) {
        console.error('❌ Database save failed, returning analysis without saving:', dbError);
        // Still attempt to send push to inform user of analysis completion
        if (analysisResult.analysis?.description) {
          await sendProductivityNotification(analysisResult.analysis.description);
        }
        // Return analysis result even if database save fails
        return {
          ...analysisResult,
          error: `Analysis completed but database save failed: ${dbError instanceof Error ? dbError.message : 'Unknown error'}`
        };
      }
    } else {
      console.log('⚠️ Missing userId or actionLogId, skipping database save');
      // Still send push if we have a summary
      if (analysisResult.analysis?.description) {
        await sendProductivityNotification(analysisResult.analysis.description);
      }
      return analysisResult;
    }

  } catch (error) {
    console.error('❌ Complete analysis and save failed:', error);
    return {
      success: false,
      timestamp,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// Export model-related utilities for convenience
export { OpenAIModel, getDefaultModel, getModelConfig, getVisionCapableModels } from './lm-models';
