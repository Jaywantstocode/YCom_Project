import { openai } from '@ai-sdk/openai';
import { embed } from 'ai';

/**
 * Generate embedding for general text content
 */
export async function generateEmbedding(text: string): Promise<string> {
  try {
    if (!text.trim()) {
      throw new Error('Text content is required for embedding generation');
    }

    const { embedding } = await embed({
      model: openai.embedding('text-embedding-3-small'),
      value: text.trim(),
    });

    // Convert to string format for pgvector compatibility
    return `[${embedding.join(',')}]`;
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw new Error('Failed to generate embedding');
  }
}

/**
 * Generate embedding for tool knowledge
 */
export async function generateKnowledgeEmbedding(
  title: string,
  content: string,
  tags: string[] = []
): Promise<string> {
  try {
    // Combine title, content, and tags for comprehensive embedding
    const combinedText = [
      title,
      content,
      tags.length > 0 ? `Tags: ${tags.join(', ')}` : '',
    ]
      .filter(Boolean)
      .join('\n\n');

    return await generateEmbedding(combinedText);
  } catch (error) {
    console.error('Error generating knowledge embedding:', error);
    throw new Error('Failed to generate knowledge embedding');
  }
}

/**
 * Generate embedding for log summary with structured data
 */
export async function generateLogSummaryEmbedding(
  summaryText: string,
  structured?: Record<string, any>,
  tags: string[] = []
): Promise<string> {
  try {
    const parts: string[] = [summaryText];

    // Include structured data if available
    if (structured && Object.keys(structured).length > 0) {
      const structuredText = Object.entries(structured)
        .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
        .join(', ');
      parts.push(`Structured: ${structuredText}`);
    }

    // Include tags
    if (tags.length > 0) {
      parts.push(`Tags: ${tags.join(', ')}`);
    }

    const combinedText = parts.join('\n\n');
    return await generateEmbedding(combinedText);
  } catch (error) {
    console.error('Error generating log summary embedding:', error);
    throw new Error('Failed to generate log summary embedding');
  }
}

/**
 * Generate search query embedding
 */
export async function generateSearchEmbedding(query: string): Promise<string> {
  try {
    if (!query.trim()) {
      throw new Error('Search query is required');
    }

    return await generateEmbedding(query.trim());
  } catch (error) {
    console.error('Error generating search embedding:', error);
    throw new Error('Failed to generate search embedding');
  }
}

/**
 * Batch generate embeddings for multiple texts
 */
export async function generateBatchEmbeddings(
  texts: string[]
): Promise<string[]> {
  try {
    const embeddings = await Promise.all(
      texts.map(text => generateEmbedding(text))
    );
    return embeddings;
  } catch (error) {
    console.error('Error generating batch embeddings:', error);
    throw new Error('Failed to generate batch embeddings');
  }
}
