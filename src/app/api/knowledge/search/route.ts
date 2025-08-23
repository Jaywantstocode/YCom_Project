import { NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase/server';
import { generateSearchEmbedding } from '@/lib/ai/embedding';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const query: string | undefined = body.query?.trim() || undefined;
    const tags: string[] | undefined = Array.isArray(body.tags) ? body.tags : undefined;
    const limit: number | undefined = typeof body.limit === 'number' ? body.limit : undefined;
    const threshold: number | undefined = typeof body.threshold === 'number' ? body.threshold : undefined;
    const minQueryLength = 3;

    const supabase = getSupabaseServiceClient();

    if (query && query.length >= minQueryLength) {
      try {
        const queryEmbedding = await generateSearchEmbedding(query);
        const { data: semanticData, error: semanticError } = await supabase.rpc(
          'search_tool_knowledge_semantic',
          {
            query_embedding: queryEmbedding,
            match_threshold: threshold ?? 0.8,
            match_count: limit ?? 20,
          },
        );

        if (!semanticError && Array.isArray(semanticData) && semanticData.length > 0) {
          const results = semanticData.map((item: Record<string, unknown>) => ({
            ...(item as object),
            embedding: null,
            search_type: 'semantic' as const,
          }));
          return NextResponse.json({ data: results });
        }
      } catch {
        // fall through to text search
      }

      // Fallback text search
      let queryBuilder = supabase
        .from('tool_knowledge')
        .select('*')
        .or(`title.ilike.%${query}%,content.ilike.%${query}%,tags.cs.{${query}}`)
        .order('created_at', { ascending: false });

      if (tags && tags.length > 0) {
        queryBuilder = queryBuilder.overlaps('tags', tags);
      }
      if (limit) {
        queryBuilder = queryBuilder.limit(limit);
      }

      const { data, error } = await queryBuilder;
      if (error) throw error;
      const results = (data || []).map((item: Record<string, unknown>) => ({
        ...(item as object),
        similarity: 0.5,
        search_type: 'text' as const,
      }));
      return NextResponse.json({ data: results });
    }

    // No query: list latest with optional tag filter
    let queryBuilder = supabase
      .from('tool_knowledge')
      .select('*')
      .order('created_at', { ascending: false });
    if (tags && tags.length > 0) {
      queryBuilder = queryBuilder.overlaps('tags', tags);
    }
    if (limit) {
      queryBuilder = queryBuilder.limit(limit);
    }
    const { data, error } = await queryBuilder;
    if (error) throw error;
    return NextResponse.json({
      data: (data || []).map((item: Record<string, unknown>) => ({
        ...(item as object),
        similarity: 0,
        search_type: undefined as unknown,
      })),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}


