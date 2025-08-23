"use client";

import { useMemo } from 'react';
import { useSessionContext } from '@/context/SessionContext';
import type { AgentLogItem, AgentTip } from '@/context/SessionContext';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

type GroupedItem = { type: 'log'; item: AgentLogItem } | { type: 'tip'; item: AgentTip };

export default function AgentLog() {
	const { activeSession } = useSessionContext();

	const grouped: GroupedItem[] = useMemo(() => {
		const logs: GroupedItem[] = (activeSession?.log ?? [])
			.slice()
			.sort((a, b) => a.ts - b.ts)
			.map((l) => ({ type: 'log', item: l }));
		const tips: GroupedItem[] = (activeSession?.tips ?? [])
			.slice()
			.sort((a, b) => a.ts - b.ts)
			.map((t) => ({ type: 'tip', item: t }));
		return [...logs, ...tips].sort((a, b) => a.item.ts - b.item.ts);
	}, [activeSession]);

	if (!activeSession) {
		return <div className="text-sm text-gray-500">Start a session to see AI logs and tips...</div>;
	}

	return (
		<ScrollArea className="h-full">
			<div className="flex flex-col gap-2 pr-2">
				{grouped.map((g) => (
					<Card key={g.item.id}>
						<CardContent className="pt-4">
							{g.type === 'log' ? (
								<div className="flex items-start gap-2">
									<Badge variant="secondary" className="uppercase">{g.item.level}</Badge>
									<div className="text-sm">{g.item.message}</div>
								</div>
							) : (
								<div>
									<Badge className="mb-1">Tip</Badge>
									<div className="text-sm font-medium">{g.item.title}</div>
									{g.item.detail ? <div className="text-sm text-gray-600">{g.item.detail}</div> : null}
								</div>
							)}
						</CardContent>
					</Card>
				))}
			</div>
		</ScrollArea>
	);
}
