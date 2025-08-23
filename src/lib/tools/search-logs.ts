/**
 * Tool for searching logs using Supabase RAG/Vector search
 */

import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Tool definition
export const searchLogs = {
  description: 'Search through session logs using vector/semantic search',
  parameters: z.object({
    query: z.string().describe('Search query for semantic search'),
    timeRange: z.object({
      start: z.number().optional(),
      end: z.number().optional(),
    }).optional().describe('Optional time range filter'),
  }),
  execute: async ({ query, timeRange }: { query: string; timeRange?: { start?: number; end?: number } }) => {
    try {
      console.log('Searching logs with Supabase RAG:', { query, timeRange });
      
      // First, get embedding for the search query
      // This would typically call OpenAI embeddings API
      // For now, we'll use text search as fallback
      
      // Option 1: Vector search (if embeddings are set up)
      // const embedding = await getEmbedding(query); // You'd implement this
      // const { data, error } = await supabase.rpc('search_logs_by_embedding', {
      //   query_embedding: embedding,
      //   match_threshold: 0.75,
      //   match_count: 10
      // });
      
      // Option 2: Full text search (fallback)
      let searchQuery = supabase
        .from('session_logs')
        .select('*')
        .textSearch('message', query)
        .order('created_at', { ascending: false })
        .limit(20);
      
      // Apply time range filter if provided
      if (timeRange?.start) {
        searchQuery = searchQuery.gte('created_at', new Date(timeRange.start).toISOString());
      }
      if (timeRange?.end) {
        searchQuery = searchQuery.lte('created_at', new Date(timeRange.end).toISOString());
      }
      
      const { data, error } = await searchQuery;
      
      if (error) {
        console.error('Error searching logs:', error);
        return {
          success: false,
          results: [],
          count: 0,
          message: `Error searching logs: ${error.message}`
        };
      }
      
      return {
        success: true,
        results: data || [],
        count: data?.length || 0,
        message: `Found ${data?.length || 0} matching logs for: ${query}`
      };
    } catch (error) {
      console.error('Error in searchLogs:', error);
      return {
        success: false,
        results: [],
        count: 0,
        message: `Failed to search logs: ${error}`
      };
    }
  },
};