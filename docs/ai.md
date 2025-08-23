# AI Analysis Documentation

This document provides comprehensive documentation for the AI analysis modules in the YCom project.

## Overview

The AI analysis system consists of three main components:

1. **Screen Capture Analysis** - Analyzes screenshots using computer vision models
2. **Work Efficiency Analysis** - Identifies inefficient work patterns and suggests improvements
3. **Language Model Management** - Manages different AI models and their configurations

## Screen Capture Analysis

### Module: `screen-capture-interpreter.ts`

Provides AI-powered analysis of screen captures using vision-capable language models.

#### Main Function

```typescript
analyzeScreenCapture(input: AnalysisInput): Promise<AnalysisResult>
```

**Parameters:**
- `image?: Buffer | string` - Image data (Buffer) or URL
- `audio?: Buffer | string` - Audio data (Buffer) or URL  
- `timestamp?: number` - Timestamp when captured (Unix timestamp)

**Returns:**
```typescript
interface AnalysisResult {
  success: boolean;
  timestamp: number;
  analysis?: {
    description: string;
    insights: string[];
  };
  error?: string;
}
```

#### Usage Examples

**Basic Screen Analysis:**
```typescript
const result = await analyzeScreenCapture({
  image: screenshotBuffer
});

if (result.success) {
  console.log('Description:', result.analysis?.description);
  console.log('Insights:', result.analysis?.insights);
}
```

**Custom Model with Error Handling:**
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
  
  console.log('Analysis completed:', result.analysis);
} catch (error) {
  console.error('Unexpected error:', error);
}
```

## Work Efficiency Analysis

### Module: `agent.ts`

Provides pure functions for analyzing work patterns and generating efficiency recommendations.

#### Core Functions

##### `analyzeWorkPatterns(sessions: SessionRecord[]): Promise<WorkPattern[]>`

Analyzes multiple sessions to identify inefficient work patterns.

**Parameters:**
- `sessions` - Array of completed session records

**Returns:**
```typescript
interface WorkPattern {
  pattern: string;
  frequency: number;
  timeSpent: number;
  inefficiencyScore: number; // 0-100 (100 = most inefficient)
  category: 'repetitive' | 'inefficient' | 'productive' | 'unknown';
}
```

##### `generateEfficiencyTips(patterns: WorkPattern[]): Promise<EfficiencyTip[]>`

Generates personalized efficiency recommendations based on identified patterns.

**Returns:**
```typescript
interface EfficiencyTip {
  type: 'shortcut' | 'tool' | 'workflow' | 'product';
  title: string;
  description: string;
  impact: 'low' | 'medium' | 'high';
  timesSaved?: string;
  productInfo?: ProductInfo;
}
```

##### `generateAnalysisReport(sessions: SessionRecord[]): Promise<AnalysisReport>`

Creates a comprehensive analysis report with insights and recommendations.

**Returns:**
```typescript
interface AnalysisReport {
  totalSessions: number;
  totalTimeSpent: number;
  inefficiencyScore: number;
  topPatterns: WorkPattern[];
  recommendations: EfficiencyTip[];
  summary: string;
}
```

##### `searchRelevantProducts(query: string): Promise<ProductSearchResult>`

Searches for relevant productivity tools and products.

**Returns:**
```typescript
interface ProductSearchResult {
  products: ProductInfo[];
  searchQuery: string;
}

interface ProductInfo {
  name: string;
  description: string;
  category: string;
  url?: string;
  relevanceScore: number; // 0-100
}
```

##### `analyzeSingleSession(session: SessionRecord): Promise<SessionAnalysis>`

Provides quick efficiency analysis for individual sessions.

**Returns:**
```typescript
interface SessionAnalysis {
  efficiencyScore: number;
  suggestions: string[];
  timeSpent: number;
}
```

#### Usage Examples

**Complete Workflow:**
```typescript
import { 
  analyzeWorkPatterns, 
  generateEfficiencyTips, 
  generateAnalysisReport,
  searchRelevantProducts,
  analyzeSingleSession
} from './agent';

// Analyze work patterns from multiple sessions
const patterns = await analyzeWorkPatterns(sessions);

// Generate efficiency tips based on patterns
const tips = await generateEfficiencyTips(patterns);

// Create a comprehensive analysis report
const report = await generateAnalysisReport(sessions);

// Search for productivity tools
const products = await searchRelevantProducts('automation tools');

// Quick analysis of a single session
const sessionAnalysis = await analyzeSingleSession(session);
```

#### Data Types

**SessionRecord:**
```typescript
interface SessionRecord {
  id: string;
  startedAt: number;
  stoppedAt?: number;
  log: AgentLogItem[];
  tips: AgentTip[];
}
```

**AgentLogItem:**
```typescript
interface AgentLogItem {
  id: string;
  ts: number;
  level: 'info' | 'warn' | 'error';
  message: string;
}
```

**AgentTip:**
```typescript
interface AgentTip {
  id: string;
  ts: number;
  title: string;
  detail?: string;
}
```

## Language Model Management

### Module: `lm-models.ts`

Manages different AI models and their configurations for optimal performance and cost.

#### Available Models

**OpenAI Models:**
- `GPT_5` - The best model for coding and agentic tasks across domains
- `GPT_5_MINI` - A faster, cost-efficient version of GPT-5 for well-defined tasks
- `GPT_5_NANO` - Fastest, most cost-efficient version of GPT-5

**Anthropic Models:**
- `CLAUDE_3_5_SONNET` - Latest Claude model with enhanced capabilities
- `CLAUDE_3_OPUS` - Most capable Claude model
- `CLAUDE_3_HAIKU` - Fastest and most cost-effective Claude model

#### Core Functions

##### `getDefaultModel(useCase: string): string`

Returns the optimal model for specific use cases:
- `VISION_ANALYSIS` - GPT-5 (best for coding and agentic tasks)
- `FAST_ANALYSIS` - GPT-5 Mini (faster, cost-efficient)
- `FASTEST_ANALYSIS` - GPT-5 Nano (fastest, most cost-efficient)
- `COST_EFFECTIVE` - Claude 3 Haiku (cheapest option)

##### `getModelConfig(modelId: string): ModelConfig`

Returns detailed configuration for a specific model:

```typescript
interface ModelConfig {
  id: string;
  provider: ModelProvider;
  name: string;
  description: string;
  supportsVision: boolean;
  maxTokens: number;
  costPerToken?: number;
}
```

##### `getVisionCapableModels(): ModelConfig[]`

Returns all models that support vision/image analysis.

##### `getModelsByProvider(provider: ModelProvider): ModelConfig[]`

Returns all models from a specific provider (OpenAI or Anthropic).

#### Usage Examples

**Using Different Models:**
```typescript
import { analyzeScreenCapture, OpenAIModel } from './screen-capture-interpreter';

// Use default model (GPT-5 for vision analysis)
const result1 = await analyzeScreenCapture({
  image: imageBuffer,
  timestamp: Date.now()
});

// Use specific model
const result2 = await analyzeScreenCapture({
  image: imageBuffer,
  timestamp: Date.now(),
  modelId: OpenAIModel.GPT_5_MINI
});
```

**Model Selection Strategy:**
```typescript
import { getDefaultModel } from './lm-models';

const visionModel = getDefaultModel('VISION_ANALYSIS');    // GPT-5
const fastModel = getDefaultModel('FAST_ANALYSIS');        // GPT-5 Mini
const cheapModel = getDefaultModel('COST_EFFECTIVE');      // Claude 3 Haiku
```

**Model Information:**
```typescript
import { getModelConfig } from './lm-models';

const config = getModelConfig(OpenAIModel.GPT_5);
console.log(config);
// {
//   id: "gpt-5",
//   provider: "openai",
//   name: "GPT-5", 
//   description: "The best model for coding and agentic tasks across domains",
//   supportsVision: true,
//   maxTokens: 8192,
//   costPerToken: 0.005
// }
```

## Configuration

### Environment Variables

Required environment variables:

```bash
OPENAI_API_KEY=your_openai_api_key_here
```

### Console Logging

The modules provide detailed logging for debugging:

```
🔬 analyzeScreenCapture started: { hasImage: true, hasAudio: false, timestamp: 1234567890 }
🤖 Using model: { modelId: "gpt-5", name: "GPT-5", isCustom: false }
🖼️ Image encoded to Base64: { size: 52341 }
📡 Starting OpenAI API call...
✨ OpenAI API response received: { content: "The screen shows...", length: 245 }
```

## Performance Considerations

### Model Selection

- **Vision Analysis**: Use GPT-5 for highest quality analysis
- **Fast Analysis**: Use GPT-5 Mini for balanced speed/quality
- **Cost-Effective**: Use Claude 3 Haiku for budget-conscious scenarios
- **Fastest**: Use GPT-5 Nano for real-time requirements

### Optimization Tips

1. **Relevance Filtering**: Products are only shown if relevance score ≥ 85%
2. **Session Batching**: Analyze multiple sessions together for better pattern detection
3. **Caching**: Consider caching analysis results for frequently accessed sessions
4. **Rate Limiting**: Implement appropriate rate limiting for API calls

## Error Handling

All functions include comprehensive error handling:

```typescript
try {
  const result = await analyzeWorkPatterns(sessions);
  // Handle success
} catch (error) {
  console.error('Analysis failed:', error);
  // Handle gracefully
}
```

Common error scenarios:
- Missing API keys
- Network connectivity issues
- Invalid session data
- API rate limits
- Model-specific limitations
