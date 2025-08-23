import OpenAI from 'openai';
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
    actionSuggestions?: string[];
  };
  error?: string;
}

// Initialize OpenAI client
function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured');
  }
  return new OpenAI({ apiKey });
}

// Encode image to Base64 format
function encodeImageToBase64(imageData: Buffer): string {
  return `data:image/png;base64,${imageData.toString('base64')}`;
}

/**
 * Main AI analysis function
 * Analyzes screen capture using OpenAI API with image, audio, and timestamp
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

    const openai = getOpenAIClient();
    
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

    // Analyze image using OpenAI Vision API
    const response = await openai.chat.completions.create({
      model: modelId,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Analyze this screen capture and provide information from the following perspectives:

1. Main content or applications displayed on the screen
2. What the user appears to be doing
3. Suggestions for efficiency or improvements if any
4. Notable elements or changes if any

Please respond concisely in Japanese.`
            },
            {
              type: "image_url",
              image_url: {
                url: imageUrl,
                detail: "low" // Use low resolution for cost optimization
              }
            }
          ]
        }
      ],
      max_completion_tokens: Math.min(modelConfig?.maxTokens || 4096, 2000), // Increased for GPT-5 reasoning tokens
      // temperature: GPT-5 only supports default temperature (1)
    });

    console.log('🔍 OpenAI API response structure:', JSON.stringify(response, null, 2));
    
    const content = response.choices[0]?.message?.content;
    if (!content) {
      console.log('❌ Response choices:', response.choices);
      console.log('❌ First choice:', response.choices[0]);
      throw new Error('Empty response from OpenAI API');
    }

    // Parse and structure the response
    const lines = content.split('\n').filter(line => line.trim());
    const description = lines[0] || 'Screen analysis completed';
    const insights = lines.slice(1).filter(line => line.length > 10);

    return {
      success: true,
      timestamp,
      analysis: {
        description,
        insights,
        actionSuggestions: insights.filter(insight => 
          insight.includes('提案') || insight.includes('改善') || insight.includes('おすすめ')
        )
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
