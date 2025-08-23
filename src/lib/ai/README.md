# AI Analysis Module

This module provides AI-powered screen capture analysis using various language models.

## Model Management

### Using Different Models

```typescript
import { analyzeScreenCapture, OpenAIModel } from './screen-capture-interpreter';

// Use default model (GPT-4O for vision analysis)
const result1 = await analyzeScreenCapture({
  image: imageBuffer,
  timestamp: Date.now()
});

// Use specific model
const result2 = await analyzeScreenCapture({
  image: imageBuffer,
  timestamp: Date.now(),
  modelId: OpenAIModel.GPT_4_TURBO
});
```

### Available Models

```typescript
import { OpenAIModel, AnthropicModel, getVisionCapableModels } from './lm-models';

// OpenAI Models
OpenAIModel.GPT_4O                    // Latest GPT-4 with vision
OpenAIModel.GPT_4_TURBO              // High-performance GPT-4
OpenAIModel.GPT_4_VISION_PREVIEW     // GPT-4 vision preview
OpenAIModel.GPT_3_5_TURBO            // Cost-effective option

// Anthropic Models
AnthropicModel.CLAUDE_3_5_SONNET     // Latest Claude with vision
AnthropicModel.CLAUDE_3_OPUS         // Most capable Claude
AnthropicModel.CLAUDE_3_HAIKU        // Fastest/cheapest Claude

// Get all vision-capable models
const visionModels = getVisionCapableModels();
```

### Default Models for Use Cases

```typescript
import { getDefaultModel } from './lm-models';

const visionModel = getDefaultModel('VISION_ANALYSIS');    // GPT-4O
const textModel = getDefaultModel('TEXT_ANALYSIS');        // GPT-4 Turbo
const quickModel = getDefaultModel('QUICK_ANALYSIS');      // GPT-3.5 Turbo
const cheapModel = getDefaultModel('COST_EFFECTIVE');      // Claude 3 Haiku
```

### Model Information

```typescript
import { getModelConfig } from './lm-models';

const config = getModelConfig(OpenAIModel.GPT_4O);
console.log(config);
// {
//   id: "gpt-4o",
//   provider: "openai",
//   name: "GPT-4O", 
//   description: "Latest GPT-4 model with vision capabilities",
//   supportsVision: true,
//   maxTokens: 4096,
//   costPerToken: 0.03
// }
```

## Analysis Functions

### Main Analysis Function

```typescript
import { analyzeScreenCapture } from './screen-capture-interpreter';

const result = await analyzeScreenCapture({
  image: imageBuffer,           // Buffer or URL (optional)
  audio: audioBuffer,           // Buffer or URL (optional)
  timestamp: Date.now(),        // Unix timestamp (optional)
  modelId: OpenAIModel.GPT_4O   // Custom model (optional)
});
```

### Response Format

```typescript
interface AnalysisResult {
  success: boolean;
  timestamp: number;
  analysis?: {
    description: string;
    insights: string[];
    actionSuggestions?: string[];
  };
  error?: string;
}
```

## Usage Examples

### Basic Screen Analysis

```typescript
const result = await analyzeScreenCapture({
  image: screenshotBuffer
});

if (result.success) {
  console.log('Description:', result.analysis?.description);
  console.log('Insights:', result.analysis?.insights);
}
```

### Custom Model with Error Handling

```typescript
try {
  const result = await analyzeScreenCapture({
    image: imageUrl,
    modelId: OpenAIModel.GPT_4_TURBO,
    timestamp: Date.now()
  });
  
  if (!result.success) {
    console.error('Analysis failed:', result.error);
    return;
  }
  
  // Process successful result
  console.log('Analysis completed:', result.analysis);
} catch (error) {
  console.error('Unexpected error:', error);
}
```

## Console Logging

The module provides detailed logging for debugging:

```
🔬 analyzeScreenCapture started: { hasImage: true, hasAudio: false, timestamp: 1234567890 }
🤖 Using model: { modelId: "gpt-4o", name: "GPT-4O", isCustom: false }
🖼️ Image encoded to Base64: { size: 52341 }
📡 Starting OpenAI API call...
✨ OpenAI API response received: { content: "The screen shows...", length: 245 }
```
