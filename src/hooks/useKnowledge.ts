"use client";

import useSWR, { mutate } from 'swr';
import { getBrowserSupabaseClient } from '@/lib/supabase/client';
import { generateKnowledgeEmbedding } from '@/lib/ai/embedding';
import { 
  type ToolKnowledge, 
  type ToolKnowledgeInsert, 
  type ToolKnowledgeUpdate,
  type ToolKnowledgeSearchResult,
  type KnowledgeSearchParams,
  type ApiResponse,
  SEARCH_DEFAULTS 
} from '@/types/knowledge';

const supabase = getBrowserSupabaseClient();

// Cache keys
const CACHE_KEYS = {
  KNOWLEDGE: 'knowledge',
  KNOWLEDGE_SEARCH: 'knowledge:search',
  KNOWLEDGE_ITEM: 'knowledge:item',
  KNOWLEDGE_SIMILAR: 'knowledge:similar',
} as const;

// Fetcher for knowledge search
const knowledgeSearchFetcher = async (params?: KnowledgeSearchParams): Promise<ToolKnowledgeSearchResult[]> => {
  try {
    const res = await fetch('/api/knowledge/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: params?.query,
        tags: params?.tags,
        limit: params?.limit || SEARCH_DEFAULTS.MAX_RESULTS,
        threshold: params?.threshold || SEARCH_DEFAULTS.SIMILARITY_THRESHOLD,
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || 'Search failed');
    }
    const json = await res.json();
    const data = (json?.data || []) as ToolKnowledge[];
    return data as unknown as ToolKnowledgeSearchResult[];
  } catch (searchError) {
    console.error('Error in knowledge search:', searchError);
    throw searchError;
  }
};

// Fetcher for single knowledge item
const knowledgeItemFetcher = async (key: string): Promise<ToolKnowledge> => {
  const [, knowledgeId] = key.split(':');

  const { data, error } = await supabase
    .from('tool_knowledge')
    .select('*')
    .eq('id', knowledgeId)
    .single();

  if (error) throw error;
  return data;
};

// Fetcher for similar knowledge items
const similarKnowledgeFetcher = async (key: string): Promise<ToolKnowledgeSearchResult[]> => {
  const [, , sourceId] = key.split(':');

  const { data, error } = await supabase.rpc('get_similar_tool_knowledge', {
    source_id: sourceId,
    match_threshold: 0.8,
    match_count: 5,
  });

  if (error) throw error;

  return Array.isArray(data) ? data.map((item) => ({
    ...item,
    embedding: null, // SQL function doesn't return embedding for performance
    search_type: 'semantic' as const,
  })) : [];
};

// Hook for knowledge search
export function useKnowledgeSearch(params?: KnowledgeSearchParams) {
  const key = params 
    ? `${CACHE_KEYS.KNOWLEDGE_SEARCH}:${JSON.stringify(params)}` 
    : CACHE_KEYS.KNOWLEDGE;

  const { data, error, isLoading, mutate: mutateCurrent } = useSWR<ToolKnowledgeSearchResult[]>(
    typeof window !== 'undefined' ? key : null, // Only run on client-side
    () => knowledgeSearchFetcher(params),
    {
      revalidateOnFocus: false,
      dedupingInterval: 5000, // Cache for 5 seconds
    }
  );

  const mutateKnowledge = () => {
    mutate((key) => typeof key === 'string' && key.startsWith(CACHE_KEYS.KNOWLEDGE));
  };

  // Create knowledge
  const createKnowledge = async (knowledgeData: ToolKnowledgeInsert): Promise<ApiResponse<ToolKnowledge>> => {
    try {
      // Generate embedding if content exists
      let embedding: string | null = null;
      if (knowledgeData.title || knowledgeData.content) {
        try {
          embedding = await generateKnowledgeEmbedding(
            knowledgeData.title || '',
            knowledgeData.content || '',
            knowledgeData.tags || []
          );
        } catch (embeddingError) {
          console.warn('Failed to generate embedding, proceeding without it:', embeddingError);
        }
      }

      const { data: newKnowledge, error: insertError } = await supabase
        .from('tool_knowledge')
        .insert([{
          ...knowledgeData,
          embedding: embedding,
        }])
        .select()
        .single();

      if (insertError) throw insertError;

      // Mutate to refresh all knowledge-related caches
      mutateKnowledge();

      return { data: newKnowledge, error: null };
    } catch (err) {
      console.error('Error creating knowledge:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to create knowledge';
      return { data: null, error: errorMessage };
    }
  };

  // Update knowledge
  const updateKnowledge = async (
    id: string,
    updates: ToolKnowledgeUpdate
  ): Promise<ApiResponse<ToolKnowledge>> => {
    try {
      // Generate new embedding if title, content, or tags changed
      let embedding: string | null = null;
      if (updates.title || updates.content || updates.tags) {
        try {
          // Get current knowledge data to combine with updates
          const { data: currentKnowledge } = await supabase
            .from('tool_knowledge')
            .select('title, content, tags')
            .eq('id', id)
            .single();

          if (currentKnowledge) {
            const title = updates.title ?? currentKnowledge.title ?? '';
            const content = updates.content ?? currentKnowledge.content ?? '';
            const tags = updates.tags ?? currentKnowledge.tags ?? [];
            embedding = await generateKnowledgeEmbedding(title, content, tags);
          }
        } catch (embeddingError) {
          console.warn('Failed to generate embedding, proceeding without it:', embeddingError);
        }
      }

      const updateData = embedding ? { ...updates, embedding } : updates;

      const { data: updatedKnowledge, error: updateError } = await supabase
        .from('tool_knowledge')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (updateError) throw updateError;

      // Mutate to refresh all knowledge-related caches
      mutateKnowledge();
      mutate(`${CACHE_KEYS.KNOWLEDGE_ITEM}:${id}`, updatedKnowledge, false);

      return { data: updatedKnowledge, error: null };
    } catch (err) {
      console.error('Error updating knowledge:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to update knowledge';
      return { data: null, error: errorMessage };
    }
  };

  // Delete knowledge
  const deleteKnowledge = async (id: string): Promise<{ error: string | null }> => {
    try {
      const { error: deleteError } = await supabase
        .from('tool_knowledge')
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;

      // Mutate to refresh all knowledge-related caches
      mutateKnowledge();
      mutate(`${CACHE_KEYS.KNOWLEDGE_ITEM}:${id}`, undefined, false);

      return { error: null };
    } catch (err) {
      console.error('Error deleting knowledge:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete knowledge';
      return { error: errorMessage };
    }
  };

  return {
    data,
    loading: isLoading,
    error: error?.message || null,
    mutate: mutateCurrent,
    mutateKnowledge,
    createKnowledge,
    updateKnowledge,
    deleteKnowledge,
  };
}

// Hook for single knowledge item
export function useKnowledge(knowledgeId: string) {
  const key = `${CACHE_KEYS.KNOWLEDGE_ITEM}:${knowledgeId}`;

  const { data, error, isLoading } = useSWR<ToolKnowledge>(
    typeof window !== 'undefined' ? key : null, // Only run on client-side
    knowledgeItemFetcher,
    {
      revalidateOnFocus: false,
    }
  );

  const mutateKnowledge = () => {
    mutate(key);
  };

  return {
    data,
    loading: isLoading,
    error: error?.message || null,
    mutate: mutateKnowledge,
  };
}

// Hook for similar knowledge items
export function useSimilarKnowledge(sourceId: string) {
  const key = `${CACHE_KEYS.KNOWLEDGE_SIMILAR}:${sourceId}`;

  const { data, error, isLoading } = useSWR<ToolKnowledgeSearchResult[]>(
    sourceId && typeof window !== 'undefined' ? key : null, // Only run on client-side
    similarKnowledgeFetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 30000, // Cache for 30 seconds
    }
  );

  return {
    data,
    loading: isLoading,
    error: error?.message || null,
  };
}
