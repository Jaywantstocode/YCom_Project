"use client";

import { useMemo } from 'react';
import { useSessionContext } from '@/context/SessionContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

function formatTime(ts: number) {
	const d = new Date(ts);
	return d.toLocaleString();
}

export default function SidebarSessions() {
	const { sessions, activeSessionId, startSession, stopSession, clearAll } = useSessionContext();
	const hasActive = !!activeSessionId;

	const items = useMemo(() => sessions, [sessions]);

	return (
		<aside className="w-72 shrink-0 h-[calc(100vh-4rem)]">
			<Card className="h-full flex flex-col">
				<CardHeader className="flex-row items-center justify-between space-y-0">
					<CardTitle className="text-base">Sessions</CardTitle>
					<Button variant="ghost" size="sm" onClick={clearAll}>Clear</Button>
				</CardHeader>
				<CardContent className="flex flex-col gap-3">
					<Button onClick={startSession}>New Session</Button>
					<ScrollArea className="h-[calc(100vh-16rem)]">
						<div className="flex flex-col gap-2 pr-2">
							{items.map((s) => (
								<div key={s.id} className={`p-3 rounded-lg border ${s.id === activeSessionId ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}>
									<div className="text-sm font-medium">{formatTime(s.startedAt)}</div>
									<div className="mt-1">
										<Badge variant={s.stoppedAt ? 'secondary' : 'default'}>{s.stoppedAt ? 'Stopped' : 'Active'}</Badge>
									</div>
								</div>
							))}
						</div>
					</ScrollArea>
					{hasActive && (
						<Button variant="secondary" onClick={stopSession}>Stop</Button>
					)}
				</CardContent>
			</Card>
		</aside>
	);
}
