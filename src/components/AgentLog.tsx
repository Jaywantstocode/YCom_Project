"use client";

import { useMemo } from 'react';
import { useSessionContext } from '@/context/SessionContext';
import type { AgentLogItem, AgentTip } from '@/context/SessionContext';

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
		<div className="flex flex-col gap-2">
			{grouped.map((g) => (
				<div key={g.item.id} className="p-2 rounded border border-gray-200">
					{g.type === 'log' ? (
						<div>
							<div className="text-xs uppercase text-gray-500">{g.item.level}</div>
							<div className="text-sm">{g.item.message}</div>
						</div>
					) : (
						<div>
							<div className="text-xs uppercase text-amber-600">Tip</div>
							<div className="text-sm font-medium">{g.item.title}</div>
							{g.item.detail ? <div className="text-sm text-gray-600">{g.item.detail}</div> : null}
						</div>
					)}
				</div>
			))}
		</div>
	);
}
