"use client";

import { useCallback, useState } from 'react';
import { useSessionContext } from '@/context/SessionContext';
import AgentLog from './AgentLog';
import CaptureClient from './CaptureClient';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function CapturePanel() {
	const sessionCtx = useSessionContext();
	const [started, setStarted] = useState(false);

	const handleStart = useCallback(() => {
		sessionCtx.startSession();
		setStarted(true);
		setTimeout(() => {
			sessionCtx.appendLog({ level: 'info', message: 'Analyzing screen...' });
			setTimeout(() => {
				sessionCtx.appendTip({ title: 'Try keyboard shortcuts', detail: 'Press ⌘K to open the command palette.' });
			}, 1200);
		}, 0);
	}, [sessionCtx]);

	const handleStop = useCallback(() => {
		sessionCtx.stopSession();
		setStarted(false);
	}, [sessionCtx]);

	return (
		<div className="flex-1 h-[calc(100vh-2rem)] overflow-hidden p-4">
			<div className="max-w-3xl mx-auto h-full flex flex-col gap-4">
				<div className="flex items-center gap-3">
					{!started ? (
						<Button onClick={handleStart}>Start Session</Button>
					) : (
						<Button onClick={handleStop} variant="destructive">Stop Session</Button>
					)}
				</div>
				{started ? (
					<Card className="flex-1 overflow-hidden">
						<CardHeader>
							<CardTitle>AI Logs</CardTitle>
							<CardDescription>Real-time assistant output and tips</CardDescription>
						</CardHeader>
						<CardContent className="h-full overflow-auto">
							<AgentLog />
						</CardContent>
					</Card>
				) : (
					<div className="">
						<CaptureClient />
					</div>
				)}
			</div>
		</div>
	);
}
