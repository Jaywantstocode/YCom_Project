import { type Tables, type TablesInsert, type TablesUpdate } from '@/lib/supabase/database.types';

// Base types from database
export type ToolKnowledge = Tables<'tool_knowledge'>;
export type ToolKnowledgeInsert = TablesInsert<'tool_knowledge'>;
export type ToolKnowledgeUpdate = TablesUpdate<'tool_knowledge'>;

export type ActionLog = Tables<'action_logs'>;
export type ActionLogInsert = TablesInsert<'action_logs'>;
export type ActionLogUpdate = TablesUpdate<'action_logs'>;

// Extended types for search results
export interface ToolKnowledgeSearchResult extends ToolKnowledge {
  similarity?: number;
  search_type?: 'semantic' | 'text';
}

export interface ActionLogSearchResult extends ActionLog {
  similarity?: number;
}

// Search parameters
export interface KnowledgeSearchParams {
  query?: string;
  tags?: string[];
  limit?: number;
  threshold?: number;
}

export interface ActionLogSearchParams {
  query?: string;
  tags?: string[];
  dateFrom?: Date;
  dateTo?: Date;
  limit?: number;
  threshold?: number;
}

// API response types
export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
}

// Constants
export const SEARCH_DEFAULTS = {
  SIMILARITY_THRESHOLD: 0.3,
  MAX_RESULTS: 20,
  MIN_QUERY_LENGTH: 2,
} as const;

export const KNOWLEDGE_TAGS = {
  CATEGORIES: [
    'development',
    'design',
    'product',
    'research',
    'documentation',
    'tools',
    'best-practices',
    'troubleshooting',
    'tutorial',
    'reference',
  ],
  PRIORITIES: [
    'high',
    'medium',
    'low',
  ],
  STATUS: [
    'active',
    'archived',
    'draft',
  ],
} as const;
