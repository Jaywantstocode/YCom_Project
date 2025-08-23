"use client";

import dynamic from 'next/dynamic';

const LiveActionLogs = dynamic(() => import('./LiveActionLogs'), { ssr: false });
import CaptureClient from './CaptureClient';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import ActionLogViewer from '@/components/ActionLogViewer';

export default function CapturePanel() {
	return (
		<div className="flex-1 h-[calc(100vh-2rem)] overflow-hidden p-4">
			<div className="max-w-3xl mx-auto h-full flex flex-col gap-4">
				<div className="">
					<CaptureClient />
				</div>
				<div className="rounded-xl border border-gray-200 bg-white/70">
					<div className="px-6 pt-4">
						<div className="flex items-center gap-2">
							<h3 className="text-base font-semibold">Live Logs</h3>
							<div className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />
						</div>
						<p className="text-sm text-gray-600">Real-time action logs from captures and analysis</p>
					</div>
					<div className="px-2 pb-2">
						<LiveActionLogs />
					</div>
				</div>
				<div className="rounded-xl border border-gray-200 bg-white/70">
					<div className="px-6 pt-4">
						<h3 className="text-base font-semibold">Summaries (10 min)</h3>
						<p className="text-sm text-gray-600">summary_10min windows with their screen captures</p>
					</div>
					<div className="px-2 pb-2">
						<ActionLogViewer />
					</div>
				</div>
			</div>
		</div>
	);
}
