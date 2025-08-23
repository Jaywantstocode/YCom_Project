import { NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase/server';
import { randomUUID } from 'crypto';

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
		const ext = (file.name.split('.').pop() || 'webm').toLowerCase();
		const path = `recordings/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
		const { data, error } = await supabase.storage
			.from('captures')
			.upload(path, buffer, { contentType: file.type || 'video/webm', upsert: false });
		if (error) return NextResponse.json({ error: error.message }, { status: 500 });
		const { data: publicUrlData } = supabase.storage.from('captures').getPublicUrl(data.path);

		// Create action_log and link video (using custom type for recordings)
		try {
			if (userId) {
				const actionLogId = randomUUID();
				const startedAt = new Date().toISOString();
				const { data: insertedLog, error: logErr } = await supabase
					.from('action_logs')
					.insert({
						id: actionLogId,
						user_id: userId,
						type: 'custom',
						started_at: startedAt,
						summary: 'Screen recording captured',
						details: { storage_path: data.path, recording: true },
						tags: ['capture','recording'],
					})
					.select('id')
					.single();
				if (logErr || !insertedLog) {
					console.error('action_logs insert failed for recording', logErr);
					return NextResponse.json({ error: 'Failed to create action log for recording' }, { status: 500 });
				}
				const { error: videoErr } = await supabase.from('videos').insert({
					user_id: userId,
					storage_path: data.path,
					mime_type: file.type || 'video/webm',
					size_bytes: buffer.length,
					captured_at: startedAt,
					action_log_id: actionLogId,
				});
				if (videoErr) {
					console.error('videos insert failed', videoErr);
					return NextResponse.json({ error: 'Failed to save video row' }, { status: 500 });
				}
				return NextResponse.json({ path: data.path, url: publicUrlData.publicUrl, action_log_id: actionLogId });
			}
		} catch (e) {
			console.error('recording handler error', e);
			return NextResponse.json({ error: 'Failed during DB linkage' }, { status: 500 });
		}

		return NextResponse.json({ path: data.path, url: publicUrlData.publicUrl });
	} catch (e) {
		const message = e instanceof Error ? e.message : 'Unknown error';
		return NextResponse.json({ error: message }, { status: 500 });
	}
}
