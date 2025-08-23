self.addEventListener('push', (event) => {
	try {
		const data = event.data ? event.data.json() : { title: 'Notification', body: '' };
		const options = {
			body: data.body,
			icon: '/icon.png',
		};
		event.waitUntil(self.registration.showNotification(data.title || 'Message', options));
	} catch (e) {
		event.waitUntil(self.registration.showNotification('Message', { body: 'You have a new notification' }));
	}
});

self.addEventListener('notificationclick', (event) => {
	event.notification.close();
	event.waitUntil(clients.openWindow('/'));
});
