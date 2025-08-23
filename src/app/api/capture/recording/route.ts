import { NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase/server';
import { randomUUID } from 'crypto';
import { analyzeVideoFromPath } from '@/lib/ai/productivity-analyzer';

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

		// Create action_log and link video (no analysis for now)
		try {
			if (userId) {
				const actionLogId = randomUUID();
				await supabase.from('action_logs').upsert({
					id: actionLogId,
					user_id: userId,
					type: 'screen_capture_recording',
					started_at: new Date().toISOString(),
					details: { storage_path: data.path },
				});
				await supabase.from('videos').insert({
					user_id: userId,
					storage_path: data.path,
					mime_type: file.type || 'video/webm',
					size_bytes: buffer.length,
					captured_at: new Date().toISOString(),
					action_log_id: actionLogId,
				});
			}
		} catch {}

		// 動画解析を実行（非同期で実行、レスポンスを待たない）
		let analysisResult = null;
		try {
			console.log('🎬 動画解析を開始:', publicUrlData.publicUrl);
			analysisResult = await analyzeVideoFromPath(publicUrlData.publicUrl);
			
			if (analysisResult.success && userId) {
				// 解析結果をデータベースに保存
				await supabase.from('productivity_analyses').insert({
					user_id: userId,
					video_path: data.path,
					analysis: analysisResult.analysis,
					created_at: new Date().toISOString(),
				});
				console.log('✅ 解析結果を保存しました');
			}
		} catch (error) {
			console.error('❌ 動画解析エラー:', error);
			// 解析エラーがあってもアップロード自体は成功とする
		}

		return NextResponse.json({ 
			path: data.path, 
			url: publicUrlData.publicUrl,
			analysis: analysisResult?.success ? analysisResult.analysis : null,
			analysisError: analysisResult?.error || null
		});
	} catch (e) {
		const message = e instanceof Error ? e.message : 'Unknown error';
		return NextResponse.json({ error: message }, { status: 500 });
	}
}
