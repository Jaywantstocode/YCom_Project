import { SessionContextValue } from '@/context/SessionContext';

export type OrchestratorHandle = {
	stop: () => void;
};

export function startOrchestrator(ctx: SessionContextValue): OrchestratorHandle {
	let stopped = false;

	function loop() {
		if (stopped || !ctx.activeSessionId) return;
		ctx.appendLog({ level: 'info', message: 'Analyzing screen...' });
		setTimeout(() => {
			if (stopped || !ctx.activeSessionId) return;
			ctx.appendTip({ title: 'Try keyboard shortcuts', detail: 'Press ⌘K to open the command palette.' });
		}, 1200);
	}

	const interval = setInterval(loop, 3000);
	loop();

	return {
		stop() {
			stopped = true;
			clearInterval(interval);
		},
	};
}
