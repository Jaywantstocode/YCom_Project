import { NextRequest, NextResponse } from 'next/server';
import { addSubscription } from '@/lib/notifications/subscriptions';
import { getSubscriptionCount } from '@/lib/notifications/subscriptions';
import { getSupabaseServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
	try {
		const body = await req.json();
		const subscription = body?.endpoint ? body : body?.subscription;
		const userId = body?.userId || null;
		if (!subscription || !subscription.endpoint) {
			return NextResponse.json({ error: 'Invalid subscription payload' }, { status: 400 });
		}
		// Persist to Supabase if table exists
		try {
			const supabase = getSupabaseServiceClient();
			const { error } = await supabase
				.from('push_subscriptions')
				.upsert(
					{
						user_id: userId,
						endpoint: subscription.endpoint,
						keys: subscription.keys ?? null,
						created_at: new Date().toISOString(),
						updated_at: new Date().toISOString(),
					},
					{ onConflict: 'endpoint' }
				);
			if (error) {
				console.warn('push_subscriptions upsert failed (fallback to memory only):', error.message);
			}
		} catch (dbErr) {
			console.warn('Supabase not available for subscriptions, using memory only:', dbErr);
		}
		// Always keep in memory too (dev fallback)
		addSubscription(subscription);
		return NextResponse.json({ message: 'Subscription saved' });
	} catch {
		return NextResponse.json({ error: 'Invalid subscription payload' }, { status: 400 });
	}
}

export async function GET() {
	try {
		const supabase = getSupabaseServiceClient();
		const { count, error } = await supabase
			.from('push_subscriptions')
			.select('*', { count: 'exact', head: true });
		if (error) {
			console.warn('push_subscriptions count failed:', error.message);
			return NextResponse.json({ count: getSubscriptionCount() });
		}
		return NextResponse.json({ count: typeof count === 'number' ? count : getSubscriptionCount() });
	} catch (e) {
		console.warn('Supabase not available for subscription count:', e);
		return NextResponse.json({ count: getSubscriptionCount() });
	}
}
