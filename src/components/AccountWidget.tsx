"use client";

import { useNotifications } from '@/hooks/useNotifications';

export default function AccountWidget() {
	const { permission, request, notify, isSupported } = useNotifications();
	const granted = permission === 'granted';

	return (
		<div className="fixed right-4 bottom-4 z-20">
			<div className="flex items-center gap-3 px-3 py-2 rounded-xl border bg-white/90 backdrop-blur border-gray-200 shadow-sm">
				<div className={`h-2.5 w-2.5 rounded-full ${granted ? 'bg-emerald-500' : 'bg-gray-400'}`} />
				<div className="text-sm">{granted ? 'Notifications on' : 'Notifications off'}</div>
				<button className="ml-2 inline-flex items-center rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-800 shadow hover:bg-gray-50 disabled:opacity-50" onClick={() => request()} disabled={!isSupported || granted}>
					Enable notif
				</button>
				<button className="ml-1 inline-flex items-center rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-800 shadow hover:bg-gray-50 disabled:opacity-50" onClick={() => notify('Test notification', { body: 'Hello from YCom' })} disabled={!isSupported || !granted}>
					Test notif
				</button>
			</div>
		</div>
	);
}
