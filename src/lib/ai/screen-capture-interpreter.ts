import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';
import { getDefaultModel, getModelConfig } from './lm-models';
import { getSupabaseServiceClient } from '../supabase/server';
import { Database } from '../supabase/database.types';

// AI analysis input parameters (all optional)
export interface AnalysisInput {
  image?: Buffer | string; // Image data (Buffer) or URL
  audio?: Buffer | string; // Audio data (Buffer) or URL  
  timestamp?: number; // Timestamp when captured (Unix timestamp)
  userId?: string; // User ID for database storage
  actionLogId?: string; // Action log ID to associate with analysis
}

// AI analysis result
export interface AnalysisResult {
  success: boolean;
  timestamp: number;
  analysis?: {
    description: string;
    insights: string[];
  };
  error?: string;
  summaryId?: string; // ID of the created log summary record
}

// Zod schema for structured output
const AnalysisSchema = z.object({
  description: z.string().describe("Concise summary of what is displayed on the screen"),
  insights: z.array(z.string()).describe("List of specific findings and observations from the screen analysis")
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

// Type definition for the log summary record
type LogSummaryInsert = Database['public']['Tables']['log_summary']['Insert'];

/**
 * Save analysis result to Supabase database
 * Stores the analysis data in the log_summary table
 */
async function saveAnalysisResultToDatabase(
  analysisData: { description: string; insights: string[] },
  userId: string,
  actionLogId: string,
  timestamp: number
): Promise<string> {
  try {
    const supabase = getSupabaseServiceClient();
    
    // Generate tags from insights for better searchability
    const tags = analysisData.insights
      .map(insight => insight.toLowerCase())
      .filter(insight => insight.length > 0)
      .slice(0, 10); // Limit to 10 tags

    const logSummaryData: LogSummaryInsert = {
      action_log_id: actionLogId,
      user_id: userId,
      summary_text: analysisData.description,
      structured: {
        description: analysisData.description,
        insights: analysisData.insights,
        timestamp: timestamp,
        type: 'screen_capture_analysis'
      },
      tags: tags.length > 0 ? tags : null
    };

    const { data, error } = await supabase
      .from('log_summary')
      .insert(logSummaryData)
      .select('id')
      .single();

    if (error) {
      console.error('❌ Failed to save analysis to database:', error);
      throw new Error(`Database save failed: ${error.message}`);
    }

    console.log('✅ Analysis saved to database with ID:', data.id);
    return data.id;

  } catch (error) {
    console.error('❌ Database save error:', error);
    throw error;
  }
}

/**
 * Main AI analysis function
 * Analyzes screen capture using Vercel AI SDK with image, audio, and timestamp
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
          description: 'No image data provided',
          insights: ['Waiting for screen capture...'],
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
              text: `Analyze this screen capture and provide information from the following perspectives:

1. Main content or applications displayed on the screen
2. What the user appears to be doing
3. Notable elements or changes if any
4. Suggestions for efficiency or improvements if any

Please respond concisely in English.`
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
        description: result.object.description || 'Screen analysis completed',
        insights: result.object.insights || []
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
 * Comprehensive screen capture analysis with database storage
 * Performs AI analysis and saves results to Supabase database
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
        const summaryId = await saveAnalysisResultToDatabase(
          analysisResult.analysis,
          input.userId,
          input.actionLogId,
          timestamp
        );
        
        return {
          ...analysisResult,
          summaryId
        };
      } catch (dbError) {
        console.error('❌ Database save failed, returning analysis without saving:', dbError);
        // Return analysis result even if database save fails
        return {
          ...analysisResult,
          error: `Analysis completed but database save failed: ${dbError instanceof Error ? dbError.message : 'Unknown error'}`
        };
      }
    } else {
      console.log('⚠️ Missing userId or actionLogId, skipping database save');
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
