"use client";

import { useMemo } from 'react';
import { useSessionContext } from '@/context/SessionContext';

function formatTime(ts: number) {
	const d = new Date(ts);
	return d.toLocaleString();
}

export default function SidebarSessions() {
	const { sessions, activeSessionId, startSession, stopSession, clearAll } = useSessionContext();
	const hasActive = !!activeSessionId;

	const items = useMemo(() => sessions, [sessions]);

	return (
		<aside className="w-72 shrink-0 h-[calc(100vh-4rem)] overflow-y-auto">
			<div className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b border-gray-200 p-3 flex items-center justify-between">
				<h2 className="font-semibold tracking-tight">Sessions</h2>
				<button onClick={clearAll} className="text-xs text-gray-500 hover:text-gray-700">Clear</button>
			</div>
			<div className="p-3">
				<button onClick={startSession} className="w-full px-3 py-2 rounded-lg bg-blue-600 text-white shadow hover:bg-blue-700">
					New Session
				</button>
			</div>
			<ul className="px-3 pb-3 flex flex-col gap-2">
				{items.map((s) => (
					<li key={s.id} className={`group p-3 rounded-lg border transition ${s.id === activeSessionId ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'}`}>
						<div className="text-sm font-medium">{formatTime(s.startedAt)}</div>
						<div className="mt-1 inline-flex items-center gap-2 text-xs">
							<span className={`inline-flex items-center rounded-full px-2 py-0.5 ${s.stoppedAt ? 'bg-gray-100 text-gray-600' : 'bg-emerald-100 text-emerald-700'}`}>{s.stoppedAt ? 'Stopped' : 'Active'}</span>
						</div>
					</li>
				))}
			</ul>
			{hasActive && (
				<div className="p-3">
					<button onClick={stopSession} className="w-full px-3 py-2 rounded-lg bg-gray-800 text-white shadow hover:bg-black">Stop</button>
				</div>
			)}
		</aside>
	);
}
