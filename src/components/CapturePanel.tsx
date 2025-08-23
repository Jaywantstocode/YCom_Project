"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSessionContext } from '@/context/SessionContext';
import AgentLog from './AgentLog';
import CaptureClient from './CaptureClient';
import { startOrchestrator, type OrchestratorHandle } from '@/lib/agent/orchestrator';

export default function CapturePanel() {
	const sessionCtx = useSessionContext();
	const [started, setStarted] = useState(false);
	const orchestratorRef = useRef<OrchestratorHandle | null>(null);

	useEffect(() => {
		if (!started) return;
		return () => {
			orchestratorRef.current?.stop();
			orchestratorRef.current = null;
		};
	}, [started]);

	const handleStart = useCallback(() => {
		sessionCtx.startSession();
		setStarted(true);
		setTimeout(() => {
			orchestratorRef.current?.stop();
			orchestratorRef.current = startOrchestrator(sessionCtx);
		}, 0);
	}, [sessionCtx]);

	const handleStop = useCallback(() => {
		sessionCtx.stopSession();
		setStarted(false);
		orchestratorRef.current?.stop();
		orchestratorRef.current = null;
	}, [sessionCtx]);

	return (
		<div className="flex-1 h-[calc(100vh-2rem)] overflow-hidden p-4">
			<div className="max-w-3xl mx-auto h-full flex flex-col gap-4">
				<div className="flex items-center gap-3">
					{!started ? (
						<button onClick={handleStart} className="px-4 py-2 rounded bg-green-600 text-white hover:bg-green-700">
							Start Session
						</button>
					) : (
						<button onClick={handleStop} className="px-4 py-2 rounded bg-red-600 text-white hover:bg-red-700">
							Stop Session
						</button>
					)}
				</div>
				{started ? (
					<div className="flex-1 overflow-auto border rounded p-3">
						<AgentLog />
					</div>
				) : (
					<div className="">
						<CaptureClient />
					</div>
				)}
			</div>
		</div>
	);
}
