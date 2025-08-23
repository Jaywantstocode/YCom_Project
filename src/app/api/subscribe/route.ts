import { NextRequest, NextResponse } from 'next/server';
import { addSubscription } from '@/lib/notifications/subscriptions';

export async function POST(req: NextRequest) {
	const subscription = await req.json();
	addSubscription(subscription);
	return NextResponse.json({ message: 'Subscription saved' });
}
