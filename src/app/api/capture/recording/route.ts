import { NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase/server';

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
		return NextResponse.json({ path: data.path, url: publicUrlData.publicUrl });
	} catch (e) {
		const message = e instanceof Error ? e.message : 'Unknown error';
		return NextResponse.json({ error: message }, { status: 500 });
	}
}
