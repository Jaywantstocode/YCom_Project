"use client";

import { useCallback, useEffect, useState } from 'react';

export function useNotifications() {
	const [permission, setPermission] = useState<NotificationPermission>('default');

	useEffect(() => {
		if (typeof window !== 'undefined' && 'Notification' in window) {
			setPermission(Notification.permission);
		}
	}, []);

	const isSupported = typeof window !== 'undefined' && 'Notification' in window;

	const request = useCallback(async () => {
		if (!isSupported) return 'denied' as NotificationPermission;
		const p = await Notification.requestPermission();
		setPermission(p);
		return p;
	}, [isSupported]);

	const notify = useCallback((title: string, options?: NotificationOptions) => {
		if (!isSupported) return false;
		if (permission !== 'granted') return false;
		new Notification(title, options);
		return true;
	}, [isSupported, permission]);

	return { permission, request, notify, isSupported };
}
