import { NextRequest, NextResponse } from 'next/server';

// WARNING: Demo-only in-memory store. Replace with DB in production.
const subscriptions: unknown[] = [];

export async function POST(req: NextRequest) {
	const subscription = await req.json();
	subscriptions.push(subscription);
	return NextResponse.json({ message: 'Subscription saved' });
}

export function getSubscriptions(): unknown[] {
	return subscriptions;
}
