import { NextRequest, NextResponse } from 'next/server';
import webPush from 'web-push';

// Ensure Node.js runtime for web-push
export const runtime = 'nodejs';

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:example@example.com';

if (VAPID_PUBLIC && VAPID_PRIVATE) {
	webPush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
}

export async function POST(req: NextRequest) {
	try {
		const { subscription, title = 'Test Notification', body = 'Hello from Web Push' } = await req.json();
		if (!subscription) {
			return NextResponse.json({ error: 'Missing subscription' }, { status: 400 });
		}
		if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
			return NextResponse.json({ error: 'Server VAPID keys not configured' }, { status: 500 });
		}
		// Some browsers require TTL and content-encoding hints for reliability
		await webPush.sendNotification(subscription, JSON.stringify({ title, body }), {
			TTL: 60,
		});
		return NextResponse.json({ ok: true });
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : 'Unknown error';
		return NextResponse.json({ error: message }, { status: 500 });
	}
}
