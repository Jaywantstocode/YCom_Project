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

		// Create action log, insert images row, then analyze
		try {
			if (userId) {
				const actionLogId = randomUUID();
				const startedAt = new Date().toISOString();
				const { data: insertedLog, error: logErr } = await supabase
					.from('action_logs')
					.insert({
						id: actionLogId,
						user_id: userId,
						type: 'screen_capture_analyze',
						started_at: startedAt,
						details: { storage_path: data.path },
						tags: ['capture','screenshot'],
					})
					.select('id')
					.single();
				if (logErr || !insertedLog) {
					console.error('action_logs insert failed', logErr);
					return NextResponse.json({ error: 'Failed to create action log' }, { status: 500 });
				}
				// Link image to action_log
				const { error: imgErr } = await supabase.from('images').insert({
					user_id: userId,
					storage_path: data.path,
					mime_type: file.type || 'image/png',
					size_bytes: buffer.length,
					captured_at: startedAt,
					action_log_id: actionLogId,
				});
				if (imgErr) {
					console.error('images insert failed', imgErr);
					return NextResponse.json({ error: 'Failed to save image row' }, { status: 500 });
				}
				// Run analysis + embedding save synchronously to ensure DB update before returning
				const analysisResult = await analyzeAndSaveScreenCapture({
					image: Buffer.from(buffer),
					timestamp: Date.now(),
					userId,
					actionLogId,
				});
				return NextResponse.json({
					path: data.path,
					url: publicUrlData.publicUrl,
					action_log_id: actionLogId,
					summary: analysisResult.analysis?.description ?? null,
				});
			}
		} catch (e) {
			console.error('screenshot handler error', e);
			return NextResponse.json({ error: 'Failed during DB linkage' }, { status: 500 });
		}

		return NextResponse.json({ path: data.path, url: publicUrlData.publicUrl });
	} catch (e) {
		const message = e instanceof Error ? e.message : 'Unknown error';
		return NextResponse.json({ error: message }, { status: 500 });
	}
}
