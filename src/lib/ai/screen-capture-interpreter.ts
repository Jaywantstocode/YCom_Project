import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';
import { getDefaultModel, getModelConfig } from './lm-models';

// AI analysis input parameters (all optional)
export interface AnalysisInput {
  image?: Buffer | string; // Image data (Buffer) or URL
  audio?: Buffer | string; // Audio data (Buffer) or URL  
  timestamp?: number; // Timestamp when captured (Unix timestamp)
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

// Export model-related utilities for convenience
export { OpenAIModel, getDefaultModel, getModelConfig, getVisionCapableModels } from './lm-models';
