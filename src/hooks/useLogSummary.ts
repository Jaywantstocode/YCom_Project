"use client";

import useSWR, { mutate } from 'swr';
import { getBrowserSupabaseClient } from '@/lib/supabase/client';
import { generateLogSummaryEmbedding, generateSearchEmbedding } from '@/lib/ai/embedding';
import { useAuth } from '@/context/AuthContext';
import { type Json } from '@/lib/supabase/database.types';
import { 
  type LogSummary, 
  type LogSummaryInsert, 
  type LogSummaryUpdate,
  type LogSummarySearchResult,
  type LogSearchParams,
  type ApiResponse,
  SEARCH_DEFAULTS 
} from '@/types/knowledge';

const supabase = getBrowserSupabaseClient();

// Cache keys
const CACHE_KEYS = {
  LOG_SUMMARY: 'log_summary',
  LOG_SUMMARY_SEARCH: 'log_summary:search',
  LOG_SUMMARY_ITEM: 'log_summary:item',
} as const;

// Fetcher for log summary search
const logSummarySearchFetcher = async (
  params?: LogSearchParams, 
  userId?: string
): Promise<LogSummarySearchResult[]> => {
  if (!userId) {
    throw new Error('User ID is required for log summary search');
  }

  try {
    // If there's a search query, try semantic search first
    if (params?.query && params.query.trim().length >= SEARCH_DEFAULTS.MIN_QUERY_LENGTH) {
      try {
        // Generate embedding for search query
        const searchEmbedding = await generateSearchEmbedding(params.query);

        // Use semantic search function
        const { data: semanticData, error: semanticError } = await supabase.rpc(
          'search_log_summary_semantic',
          {
            query_embedding: searchEmbedding,
            user_id_filter: userId,
            match_threshold: params.threshold || SEARCH_DEFAULTS.SIMILARITY_THRESHOLD,
            match_count: params.limit || SEARCH_DEFAULTS.MAX_RESULTS,
          }
        );

        if (!semanticError && semanticData && Array.isArray(semanticData) && semanticData.length > 0) {
          return semanticData.map((item) => ({
            ...item,
            structured: item.structured as Json, // Type cast for compatibility
            embedding: null, // SQL function doesn't return embedding for performance
          }));
        }
      } catch (embeddingError) {
        console.warn('Semantic search failed, falling back to text search:', embeddingError);
      }

      // Fallback to text search
      let query = supabase
        .from('log_summary')
        .select('*')
        .eq('user_id', userId)
        .ilike('summary_text', `%${params.query}%`)
        .order('created_at', { ascending: false });

      if (params.tags && params.tags.length > 0) {
        query = query.overlaps('tags', params.tags);
      }

      if (params.dateFrom) {
        query = query.gte('created_at', params.dateFrom.toISOString());
      }

      if (params.dateTo) {
        query = query.lte('created_at', params.dateTo.toISOString());
      }

      if (params.limit) {
        query = query.limit(params.limit);
      }

      const { data, error } = await query;

      if (error) throw error;

      return (data || []).map((item: LogSummary) => ({
        ...item,
        similarity: 0.5, // Default similarity for text search
      }));
    }

    // No search query - return all user's log summaries
    let query = supabase
      .from('log_summary')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (params?.tags && params.tags.length > 0) {
      query = query.overlaps('tags', params.tags);
    }

    if (params?.dateFrom) {
      query = query.gte('created_at', params.dateFrom.toISOString());
    }

    if (params?.dateTo) {
      query = query.lte('created_at', params.dateTo.toISOString());
    }

    if (params?.limit) {
      query = query.limit(params.limit);
    }

    const { data, error } = await query;

    if (error) throw error;

    return (data || []).map((item: LogSummary) => ({
      ...item,
      similarity: 0,
    }));
  } catch (searchError) {
    console.error('Error in log summary search:', searchError);
    throw searchError;
  }
};

// Fetcher for single log summary item
const logSummaryItemFetcher = async (key: string): Promise<LogSummary> => {
  const [, logId] = key.split(':');

  const { data, error } = await supabase
    .from('log_summary')
    .select('*')
    .eq('id', logId)
    .single();

  if (error) throw error;
  return data;
};

// Hook for log summary search
export function useLogSummarySearch(params?: LogSearchParams) {
  const { user } = useAuth();
  const userId = user?.id;

  const key = params && userId
    ? `${CACHE_KEYS.LOG_SUMMARY_SEARCH}:${userId}:${JSON.stringify(params)}` 
    : userId ? `${CACHE_KEYS.LOG_SUMMARY}:${userId}` : null;

  const { data, error, isLoading, mutate: mutateCurrent } = useSWR<LogSummarySearchResult[]>(
    key && typeof window !== 'undefined' ? key : null, // Only run on client-side
    () => logSummarySearchFetcher(params, userId),
    {
      revalidateOnFocus: false,
      dedupingInterval: 5000, // Cache for 5 seconds
    }
  );

  const mutateLogSummary = () => {
    if (userId) {
      mutate((key) => typeof key === 'string' && key.includes(`${CACHE_KEYS.LOG_SUMMARY}:${userId}`));
    }
  };

  // Create log summary
  const createLogSummary = async (logData: LogSummaryInsert): Promise<ApiResponse<LogSummary>> => {
    if (!userId) {
      return { data: null, error: 'User not authenticated' };
    }

    try {
      // Generate embedding if summary text exists
      let embedding: string | null = null;
      if (logData.summary_text) {
        try {
          embedding = await generateLogSummaryEmbedding(
            logData.summary_text,
            logData.structured as Record<string, unknown> | undefined,
            logData.tags || []
          );
        } catch (embeddingError) {
          console.warn('Failed to generate embedding, proceeding without it:', embeddingError);
        }
      }

      const { data: newLogSummary, error: insertError } = await supabase
        .from('log_summary')
        .insert([{
          ...logData,
          user_id: userId,
          embedding: embedding,
        }])
        .select()
        .single();

      if (insertError) throw insertError;

      // Mutate to refresh all log summary-related caches
      mutateLogSummary();

      return { data: newLogSummary, error: null };
    } catch (err) {
      console.error('Error creating log summary:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to create log summary';
      return { data: null, error: errorMessage };
    }
  };

  // Update log summary
  const updateLogSummary = async (
    id: string,
    updates: LogSummaryUpdate
  ): Promise<ApiResponse<LogSummary>> => {
    if (!userId) {
      return { data: null, error: 'User not authenticated' };
    }

    try {
      // Generate new embedding if summary text, structured data, or tags changed
      let embedding: string | null = null;
      if (updates.summary_text || updates.structured || updates.tags) {
        try {
          // Get current log summary data to combine with updates
          const { data: currentLogSummary } = await supabase
            .from('log_summary')
            .select('summary_text, structured, tags')
            .eq('id', id)
            .eq('user_id', userId)
            .single();

          if (currentLogSummary) {
            const summaryText = updates.summary_text ?? currentLogSummary.summary_text ?? '';
            const structured = updates.structured ?? currentLogSummary.structured;
            const tags = updates.tags ?? currentLogSummary.tags ?? [];
            embedding = await generateLogSummaryEmbedding(
              summaryText,
              structured as Record<string, unknown> | undefined,
              tags
            );
          }
        } catch (embeddingError) {
          console.warn('Failed to generate embedding, proceeding without it:', embeddingError);
        }
      }

      const updateData = embedding ? { ...updates, embedding } : updates;

      const { data: updatedLogSummary, error: updateError } = await supabase
        .from('log_summary')
        .update(updateData)
        .eq('id', id)
        .eq('user_id', userId)
        .select()
        .single();

      if (updateError) throw updateError;

      // Mutate to refresh all log summary-related caches
      mutateLogSummary();
      mutate(`${CACHE_KEYS.LOG_SUMMARY_ITEM}:${id}`, updatedLogSummary, false);

      return { data: updatedLogSummary, error: null };
    } catch (err) {
      console.error('Error updating log summary:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to update log summary';
      return { data: null, error: errorMessage };
    }
  };

  // Delete log summary
  const deleteLogSummary = async (id: string): Promise<{ error: string | null }> => {
    if (!userId) {
      return { error: 'User not authenticated' };
    }

    try {
      const { error: deleteError } = await supabase
        .from('log_summary')
        .delete()
        .eq('id', id)
        .eq('user_id', userId);

      if (deleteError) throw deleteError;

      // Mutate to refresh all log summary-related caches
      mutateLogSummary();
      mutate(`${CACHE_KEYS.LOG_SUMMARY_ITEM}:${id}`, undefined, false);

      return { error: null };
    } catch (err) {
      console.error('Error deleting log summary:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete log summary';
      return { error: errorMessage };
    }
  };

  return {
    data,
    loading: isLoading,
    error: error?.message || null,
    mutate: mutateCurrent,
    mutateLogSummary,
    createLogSummary,
    updateLogSummary,
    deleteLogSummary,
  };
}

// Hook for single log summary item
export function useLogSummary(logId: string) {
  const { user } = useAuth();
  const key = user ? `${CACHE_KEYS.LOG_SUMMARY_ITEM}:${logId}` : null;

  const { data, error, isLoading } = useSWR<LogSummary>(
    key && typeof window !== 'undefined' ? key : null, // Only run on client-side
    logSummaryItemFetcher,
    {
      revalidateOnFocus: false,
    }
  );

  const mutateLogSummary = () => {
    if (key) {
      mutate(key);
    }
  };

  return {
    data,
    loading: isLoading,
    error: error?.message || null,
    mutate: mutateLogSummary,
  };
}
