import { NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase/server';
import { randomUUID } from 'crypto';
import { analyzeAndSaveScreenCapture } from '@/lib/ai/screen-capture-interpreter';

export const runtime = 'nodejs';

export async function POST(request: Request) {
	try {
		const contentType = request.headers.get('content-type') || '';
		if (!contentType.includes('multipart/form-data')) {
			return NextResponse.json({ error: 'Invalid content-type' }, { status: 400 });
		}
		const formData = await request.formData();
		const file = formData.get('file');
		if (!(file instanceof File)) {
			return NextResponse.json({ error: 'Missing file' }, { status: 400 });
		}
		const userId = (formData.get('user_id') as string) || '';
		const supabase = getSupabaseServiceClient();
		const arrayBuffer = await file.arrayBuffer();
		const buffer = Buffer.from(arrayBuffer);
		const ext = (file.name.split('.').pop() || 'png').toLowerCase();
		const path = `screenshots/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
		const { data, error } = await supabase.storage
			.from('captures')
			.upload(path, buffer, { contentType: file.type || 'image/png', upsert: false });
		if (error) return NextResponse.json({ error: error.message }, { status: 500 });
		const { data: publicUrlData } = supabase.storage.from('captures').getPublicUrl(data.path);

		// Create or link action log, insert images row, and analyze in background
		try {
			if (userId) {
				const actionLogId = randomUUID();
				// Create a placeholder action_log row to link image, will be updated by analyzer
				await supabase.from('action_logs').upsert({
					id: actionLogId,
					user_id: userId,
					type: 'screen_capture_screenshot',
					started_at: new Date().toISOString(),
					details: { storage_path: data.path },
				});
				// Link image to action_log
				await supabase.from('images').insert({
					user_id: userId,
					storage_path: data.path,
					mime_type: file.type || 'image/png',
					size_bytes: buffer.length,
					captured_at: new Date().toISOString(),
					action_log_id: actionLogId,
				});
				// Run analysis + embedding save without blocking response
				void analyzeAndSaveScreenCapture({
					image: Buffer.from(buffer),
					timestamp: Date.now(),
					userId,
					actionLogId,
				});
			}
		} catch {}

		return NextResponse.json({ path: data.path, url: publicUrlData.publicUrl });
	} catch (e) {
		const message = e instanceof Error ? e.message : 'Unknown error';
		return NextResponse.json({ error: message }, { status: 500 });
	}
}
