import { NextRequest, NextResponse } from 'next/server';
import webPush from 'web-push';
import { getSubscriptions, getSubscriptionCount } from '@/lib/notifications/subscriptions';

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:example@example.com';

if (VAPID_PUBLIC && VAPID_PRIVATE) {
	webPush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
}

export async function POST(req: NextRequest) {
	try {
		const { title = '💡 生産性アドバイス', body } = await req.json();
		
		if (!body) {
			return NextResponse.json({ error: 'Missing notification body' }, { status: 400 });
		}

		if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
			return NextResponse.json({ error: 'Server VAPID keys not configured' }, { status: 500 });
		}

		const subscriptions = getSubscriptions();
		console.log('📱 生産性アドバイス通知を送信:', { title, body });
		console.log('📊 登録されたサブスクリプション数:', subscriptions.length);

		// すべての登録されたサブスクリプションに送信
		const promises = subscriptions.map(async (subscription) => {
			try {
				await webPush.sendNotification(subscription, JSON.stringify({ title, body }));
			} catch (error) {
				console.error('通知送信エラー:', error);
			}
		});

		await Promise.all(promises);

		return NextResponse.json({ 
			ok: true, 
			message: `${getSubscriptionCount()}個のサブスクリプションに通知を送信しました` 
		});
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : 'Unknown error';
		console.error('生産性アドバイス通知エラー:', message);
		return NextResponse.json({ error: message }, { status: 500 });
	}
}
