import { NextRequest } from 'next/server';
import OpenAI from 'openai';

export const runtime = 'nodejs';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

type CacheEntry = { text: string; createdAt: number };
const imageAnalysisCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 1000 * 60 * 10; // 10 minutes

function hashBufferToKey(buffer: ArrayBuffer): string {
  // Fast non-cryptographic hash for cache key
  let hash = 2166136261;
  const view = new Uint8Array(buffer);
  for (let i = 0; i < view.length; i += Math.ceil(view.length / 1024) || 1) {
    hash ^= view[i];
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return `img_${(hash >>> 0).toString(16)}`;
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('image') as unknown as File | null;
    const prompt = (formData.get('prompt') as string) || 'この画像の内容を実況風に、重要な要素から順に説明してください。';

    if (!file) {
      return new Response(JSON.stringify({ error: 'No image provided' }), { status: 400 });
    }

    const buffer = await file.arrayBuffer();
    const cacheKey = hashBufferToKey(buffer);
    const now = Date.now();
    const cached = imageAnalysisCache.get(cacheKey);
    if (cached && now - cached.createdAt < CACHE_TTL_MS) {
      return new Response(cached.text, {
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }

    const base64 = Buffer.from(buffer).toString('base64');
    const mimeType = (file as File).type || 'image/jpeg';

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } },
          ],
        },
      ],
      temperature: 0.4,
    });

    const text = completion.choices?.[0]?.message?.content ?? '';
    imageAnalysisCache.set(cacheKey, { text, createdAt: Date.now() });
    return new Response(text, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
}


