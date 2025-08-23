import OpenAI from 'openai';

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

    // Analyze image using OpenAI Vision API
    const response = await openai.chat.completions.create({
      model: "gpt-4-vision-preview",
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
      max_tokens: 500,
      temperature: 0.7
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
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

/**
 * Quick analysis function for hackathon
 * Faster processing with simpler prompt
 */
export async function quickAnalyze(input: AnalysisInput): Promise<AnalysisResult> {
  const timestamp = input.timestamp || Date.now();
  console.log('⚡ quickAnalyze started:', { hasImage: !!input.image, timestamp });
  
  try {
    if (!input.image) {
      return {
        success: true,
        timestamp,
        analysis: {
          description: 'Waiting...',
          insights: ['Waiting for image'],
        }
      };
    }

    const openai = getOpenAIClient();
    console.log('🔑 OpenAI client initialized');
    
    let imageUrl: string;
    if (input.image instanceof Buffer) {
      imageUrl = encodeImageToBase64(input.image);
      console.log('🖼️ Image encoded to Base64:', { size: input.image.length });
    } else {
      imageUrl = input.image as string;
      console.log('🔗 Using image URL:', { url: imageUrl.substring(0, 50) + '...' });
    }

    console.log('📡 Starting OpenAI API call...');
    const response = await openai.chat.completions.create({
      model: "gpt-4-vision-preview",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Please describe what is happening on this screen in one line, concisely."
            },
            {
              type: "image_url",
              image_url: {
                url: imageUrl,
                detail: "low"
              }
            }
          ]
        }
      ],
      max_tokens: 100,
      temperature: 0.5
    });

    const content = response.choices[0]?.message?.content || 'Screen analysis completed';
    console.log('✨ OpenAI API response received:', { 
      content: content.substring(0, 100) + '...',
      length: content.length 
    });

    return {
      success: true,
      timestamp,
      analysis: {
        description: content,
        insights: [content]
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
