/**
 * Tool for searching Product Hunt products from Supabase using vector search
 */

import { z } from 'zod';
import { getSupabaseServiceClient } from '../supabase/server';
import { generateSearchEmbedding } from '../ai/embedding';

// Parameters schema
const searchProductHuntParams = z.object({
  queries: z.array(z.string()).describe('List of natural language search queries (like Google search). Each query will be searched separately using semantic search and results will be returned for all queries.'),
  limit: z.number().optional().default(5).describe('Number of products to return per query (default: 5)'),
  useSemanticSearch: z.boolean().optional().default(true).describe('Use semantic search (true) or text search (false)'),
});

// Core function - searches for each query and returns combined results
const searchProductHuntCore = async ({ 
  queries, 
  limit = 5,
  useSemanticSearch = true 
}: z.infer<typeof searchProductHuntParams>) => {
    try {
      console.log('Searching Product Hunt in database for queries:', queries);
      
      const supabase = getSupabaseServiceClient();
      const allResults = [];
      
      // Search for each query
      for (const query of queries) {
        console.log(`Searching for: ${query}`);
        
        let products: any[] = [];
        
        if (useSemanticSearch) {
          // Use vector/semantic search with embeddings
          try {
            // Generate embedding for the search query
            const queryEmbedding = await generateSearchEmbedding(query);
            
            // Use hybrid search (combines semantic and text search)
            const { data, error } = await supabase.rpc('search_tool_knowledge_hybrid', {
              query_text: query,
              query_embedding: queryEmbedding,
              match_count: limit * 2, // Get more results for filtering
              match_threshold: 0.5, // Adjust threshold as needed
            });
            
            if (error) {
              console.error(`Hybrid search error for query "${query}":`, error);
              // Fall back to semantic search only
              const { data: semanticData, error: semanticError } = await supabase.rpc('search_tool_knowledge_semantic', {
                query_embedding: queryEmbedding,
                match_count: limit * 2,
                match_threshold: 0.5,
              });
              
              if (semanticError) {
                throw semanticError;
              }
              products = semanticData || [];
            } else {
              products = data || [];
            }
          } catch (embeddingError) {
            console.error('Embedding generation failed, falling back to text search:', embeddingError);
            // Fall back to text search if embedding fails
            useSemanticSearch = false;
          }
        }
        
        // Fallback to text search
        if (!useSemanticSearch || products.length === 0) {
          const { data, error } = await supabase
            .from('tool_knowledge')
            .select('*')
            .or(`title.ilike.%${query}%,content.ilike.%${query}%`)
            .limit(limit * 2)
            .order('created_at', { ascending: false });
          
          if (error) {
            console.error(`Text search error for query "${query}":`, error);
            continue;
          }
          
          products = (data || []).map(product => ({
            ...product,
            similarity: 0, // Add similarity score for consistency
            search_type: 'text'
          }));
        }
        
        // Sort by similarity score if available
        products.sort((a, b) => {
          if (a.similarity !== undefined && b.similarity !== undefined) {
            return b.similarity - a.similarity;
          }
          return 0;
        });
        
        // Transform and limit results
        const transformedProducts = products.slice(0, limit).map((product, index) => ({
          id: product.id,
          name: product.title || 'Untitled Product',
          tagline: product.content ? 
            product.content.substring(0, 100) + (product.content.length > 100 ? '...' : '') : 
            'No description available',
          description: product.content,
          url: product.url || '',
          tags: product.tags || [],
          score: product.similarity || (1 - index / limit), // Use similarity score or position-based score
          searchType: product.search_type || 'semantic',
        }));
        
        allResults.push({
          query,
          products: transformedProducts,
          searchMethod: useSemanticSearch ? 'semantic' : 'text'
        });
      }
      
      return {
        success: true,
        results: allResults,
        message: `Searched ${queries.length} queries in Product Hunt database`,
        totalQueries: queries.length,
        searchMethod: useSemanticSearch ? 'semantic' : 'text',
      };
    } catch (error) {
      console.error('Error searching Product Hunt in database:', error);
      return {
        success: false,
        results: [],
        message: `Failed to search products: ${error}`,
        totalQueries: queries.length,
        searchMethod: 'failed',
      };
    }
};

// Export as tool for AI SDK
export const searchProductHunt = {
  description: 'Search for Product Hunt products from Supabase database using semantic/vector search. Accepts a list of natural language search queries (similar to Google search). Each query will be searched independently using AI embeddings for semantic similarity, and results will be returned for all queries. Perfect for finding productivity tools, automation solutions, AI assistants, and other software products stored in the knowledge base.',
  inputSchema: searchProductHuntParams,
  execute: searchProductHuntCore,
};