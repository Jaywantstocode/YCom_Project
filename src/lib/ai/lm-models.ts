/**
 * Language Model configurations and enums
 * Centralized model management for AI analysis
 */

// OpenAI model identifiers
export enum OpenAIModel {
  // GPT-5 series (2025) - Only existing models
  GPT_5 = "gpt-5",                             // The best model for coding and agentic tasks across domains
  GPT_5_MINI = "gpt-5-mini",                   // A faster, cost-efficient version of GPT-5 for well-defined tasks
  GPT_5_NANO = "gpt-5-nano",                   // Fastest, most cost-efficient version of GPT-5
}

// Anthropic model identifiers
export enum AnthropicModel {
  CLAUDE_3_5_SONNET = "claude-3-5-sonnet-20241022",
  CLAUDE_3_OPUS = "claude-3-opus-20240229",
  CLAUDE_3_HAIKU = "claude-3-haiku-20240307",
}

// Model provider types
export enum ModelProvider {
  OPENAI = "openai",
  ANTHROPIC = "anthropic",
}

// Model configuration interface
export interface ModelConfig {
  id: string;
  provider: ModelProvider;
  name: string;
  description: string;
  supportsVision: boolean;
  maxTokens: number;
  costPerToken?: number; // Cost per 1K tokens (optional)
}

// Model configurations
export const MODEL_CONFIGS: Record<string, ModelConfig> = {
  // GPT-5 series - Only existing models
  [OpenAIModel.GPT_5]: {
    id: OpenAIModel.GPT_5,
    provider: ModelProvider.OPENAI,
    name: "GPT-5",
    description: "The best model for coding and agentic tasks across domains",
    supportsVision: true,
    maxTokens: 8192,
    costPerToken: 0.005,
  },
  [OpenAIModel.GPT_5_MINI]: {
    id: OpenAIModel.GPT_5_MINI,
    provider: ModelProvider.OPENAI,
    name: "GPT-5 mini",
    description: "A faster, cost-efficient version of GPT-5 for well-defined tasks",
    supportsVision: true,
    maxTokens: 4096,
    costPerToken: 0.001,
  },
  [OpenAIModel.GPT_5_NANO]: {
    id: OpenAIModel.GPT_5_NANO,
    provider: ModelProvider.OPENAI,
    name: "GPT-5 nano",
    description: "Fastest, most cost-efficient version of GPT-5",
    supportsVision: true,
    maxTokens: 4096,
    costPerToken: 0.0005,
  },
  [AnthropicModel.CLAUDE_3_5_SONNET]: {
    id: AnthropicModel.CLAUDE_3_5_SONNET,
    provider: ModelProvider.ANTHROPIC,
    name: "Claude 3.5 Sonnet",
    description: "Latest Claude model with enhanced capabilities",
    supportsVision: true,
    maxTokens: 4096,
    costPerToken: 0.03,
  },
  [AnthropicModel.CLAUDE_3_OPUS]: {
    id: AnthropicModel.CLAUDE_3_OPUS,
    provider: ModelProvider.ANTHROPIC,
    name: "Claude 3 Opus",
    description: "Most capable Claude model",
    supportsVision: true,
    maxTokens: 4096,
    costPerToken: 0.075,
  },
  [AnthropicModel.CLAUDE_3_HAIKU]: {
    id: AnthropicModel.CLAUDE_3_HAIKU,
    provider: ModelProvider.ANTHROPIC,
    name: "Claude 3 Haiku",
    description: "Fastest and most cost-effective Claude model",
    supportsVision: true,
    maxTokens: 4096,
    costPerToken: 0.0125,
  },
};

// Default models for different use cases
export const DEFAULT_MODELS = {
  VISION_ANALYSIS: OpenAIModel.GPT_5,         // Best model for coding and agentic tasks
  FAST_ANALYSIS: OpenAIModel.GPT_5_MINI,      // Faster, cost-efficient version
  FASTEST_ANALYSIS: OpenAIModel.GPT_5_NANO,   // Fastest, most cost-efficient
  COST_EFFECTIVE: AnthropicModel.CLAUDE_3_HAIKU, // Cheapest option (non-OpenAI)
} as const;

// Utility functions
export function getModelConfig(modelId: string): ModelConfig | undefined {
  return MODEL_CONFIGS[modelId];
}

export function getVisionCapableModels(): ModelConfig[] {
  return Object.values(MODEL_CONFIGS).filter(config => config.supportsVision);
}

export function getModelsByProvider(provider: ModelProvider): ModelConfig[] {
  return Object.values(MODEL_CONFIGS).filter(config => config.provider === provider);
}

export function getDefaultModel(useCase: keyof typeof DEFAULT_MODELS): string {
  return DEFAULT_MODELS[useCase];
}
