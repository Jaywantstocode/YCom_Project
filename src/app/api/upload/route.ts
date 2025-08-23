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

		const fileExt = file.name.split('.').pop() || 'bin';
		const path = `captures/${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;

		const { data: uploadData, error: uploadError } = await supabase.storage
			.from('captures')
			.upload(path, buffer, {
				contentType: file.type || 'application/octet-stream',
				upsert: false,
			});

		if (uploadError) {
			return NextResponse.json({ error: uploadError.message }, { status: 500 });
		}

		const { data: publicUrlData } = supabase.storage.from('captures').getPublicUrl(uploadData.path);

		return NextResponse.json({ path: uploadData.path, url: publicUrlData.publicUrl });
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : 'Unknown error';
		return NextResponse.json({ error: message }, { status: 500 });
	}
}
