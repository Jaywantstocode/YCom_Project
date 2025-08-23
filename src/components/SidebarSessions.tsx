"use client";

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { UserProfile } from '@/components/UserProfile';
import Link from 'next/link';

export default function SidebarSessions() {
	return (
		<aside className="w-72 shrink-0 h-[calc(100vh-4rem)]">
			<Card className="h-full flex flex-col">
				<CardHeader className="space-y-1">
					<CardTitle className="text-base">Account</CardTitle>
				</CardHeader>
				<CardContent className="flex flex-col gap-4 h-[calc(100%-3.5rem)]">
					<UserProfile />
					<div className="pt-2 border-t" />
					<div className="space-y-2">
						<div className="text-xs font-medium text-gray-700">Apps</div>
						<Link className="text-sm underline block" href="/chat">Chat</Link>
						<Link className="text-sm underline block" href="/feedback">Feedback</Link>
					</div>
				</CardContent>
			</Card>
		</aside>
	);
}
