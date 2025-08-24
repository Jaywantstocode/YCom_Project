"use client";

import { useNotifications } from '@/hooks/useNotifications';
import { useEffect, useRef, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';

function urlBase64ToUint8Array(base64String: string) {
	const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
	const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
	const rawData = typeof window !== 'undefined' ? window.atob(base64) : '';
	const outputArray = new Uint8Array(rawData.length);
	for (let i = 0; i < rawData.length; ++i) {
		outputArray[i] = rawData.charCodeAt(i);
	}
	return outputArray;
}

const VAPID_STORAGE_KEY = 'push.vapidPublicKey';

export default function AccountWidget() {
	const { permission, request, isSupported } = useNotifications();
	const granted = permission === 'granted';
	const [pushMessage, setPushMessage] = useState<string>('');
	const [subscribed, setSubscribed] = useState<boolean>(false);
	const [busy, setBusy] = useState<boolean>(false);
	const [autoTest, setAutoTest] = useState<boolean>(false);
	const autoTimerRef = useRef<number | null>(null);

	useEffect(() => {
		if (!autoTest) {
			if (autoTimerRef.current) window.clearInterval(autoTimerRef.current);
			autoTimerRef.current = null;
			return;
		}
		autoTimerRef.current = window.setInterval(async () => {
			try {
				if (granted) {
					new Notification('Auto Test', { body: 'Local notification every 10 seconds' });
				}
				if ('serviceWorker' in navigator) {
					const reg = await navigator.serviceWorker.ready;
					const sub = await reg.pushManager.getSubscription();
					if (sub) {
						await fetch('/api/send-notification', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subscription: sub, title: 'Auto Push', body: 'Server push every 10 seconds' }) });
					}
				}
			} catch {}
		}, 10000);
		return () => {
			if (autoTimerRef.current) window.clearInterval(autoTimerRef.current);
			autoTimerRef.current = null;
		};
	}, [autoTest, granted]);

	const subscribeToPush = async () => {
		try {
			setBusy(true);
			if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
				setPushMessage('Push not supported');
				return;
			}
			const reg = await navigator.serviceWorker.register('/sw.js');
			await navigator.serviceWorker.ready;
			const perm = await Notification.requestPermission();
			if (perm !== 'granted') {
				setPushMessage('Permission denied');
				return;
			}
			const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY as string | undefined;
			if (!vapidKey) {
				setPushMessage('Missing VAPID public key');
				return;
			}
			const storedKey = typeof window !== 'undefined' ? window.localStorage.getItem(VAPID_STORAGE_KEY) : null;
			const existing = await reg.pushManager.getSubscription();
			if (existing) {
				if (storedKey === vapidKey) {
					setSubscribed(true);
					setPushMessage('Already subscribed');
					return;
				}
				await existing.unsubscribe();
			}
			const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(vapidKey) });
			await fetch('/api/subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subscription: sub }) });
			try { window.localStorage.setItem('push.subscription', JSON.stringify(sub)); } catch {}
			if (typeof window !== 'undefined') window.localStorage.setItem(VAPID_STORAGE_KEY, vapidKey);
			setSubscribed(true);
			setPushMessage('Subscribed to push');
		} catch (e) {
			const msg = e instanceof Error ? e.message : 'Error';
			if (msg.includes('applicationServerKey')) {
				try {
					const reg = await navigator.serviceWorker.ready;
					const sub = await reg.pushManager.getSubscription();
					if (sub) await sub.unsubscribe();
					const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY as string | undefined;
					if (vapidKey) {
						const newSub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(vapidKey) });
						await fetch('/api/subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subscription: newSub }) });
						try { window.localStorage.setItem('push.subscription', JSON.stringify(newSub)); } catch {}
						if (typeof window !== 'undefined') window.localStorage.setItem(VAPID_STORAGE_KEY, vapidKey);
						setSubscribed(true);
						setPushMessage('Resubscribed with new key');
						return;
					}
				} catch {}
			}
			setPushMessage(msg);
		} finally {
			setBusy(false);
		}
	};

	const sendTestPush = async () => {
		try {
			setBusy(true);
			if (!('serviceWorker' in navigator)) return;
			const reg = await navigator.serviceWorker.ready;
			const sub = await reg.pushManager.getSubscription();
			if (!sub) {
				setPushMessage('Not subscribed');
				return;
			}
			await fetch('/api/send-notification', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subscription: sub }) });
			setPushMessage('Push sent!');
		} catch (e) {
			setPushMessage(e instanceof Error ? e.message : 'Error');
		} finally {
			setBusy(false);
		}
	};

	return (
		<div className="fixed right-4 bottom-4 z-20">
			<Card className="px-3 py-2">
				<div className="flex items-center gap-3">
					<div className={`h-2.5 w-2.5 rounded-full ${granted ? 'bg-emerald-500' : 'bg-gray-400'}`} />
					<div className="text-sm">{granted ? 'Notifications on' : 'Notifications off'}</div>
					<Button variant="outline" size="sm" onClick={() => request()} disabled={!isSupported || granted || busy}>Enable notif</Button>
					<Button variant="outline" size="sm" onClick={subscribeToPush} disabled={busy}>Subscribe Push</Button>
					<Button variant="outline" size="sm" onClick={sendTestPush} disabled={!subscribed || busy}>Test Push</Button>
					<div className="inline-flex items-center gap-2 text-xs">
						<Switch id="autoTest" checked={autoTest} onCheckedChange={(v) => setAutoTest(Boolean(v))} />
						<label htmlFor="autoTest">Auto 10s Test</label>
					</div>
				</div>
				{pushMessage ? <div className="mt-2 text-xs text-gray-700">{pushMessage}</div> : null}
			</Card>
		</div>
	);
}
