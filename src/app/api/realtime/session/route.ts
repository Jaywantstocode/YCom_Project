import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST() {
  try {
    const res = await fetch('https://api.openai.com/v1/realtime/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-realtime-preview-2024-12-17',
        modalities: ['text', 'audio'],
        voice: 'alloy',
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json({ error: `Realtime session failed: ${errText}` }, { status: 500 });
    }

    const data = await res.json();
    return NextResponse.json({
      sessionId: data.id,
      clientSecret: data.client_secret?.value ?? null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}


