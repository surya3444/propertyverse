/* PropertyVerse Web Push service worker (VAPID).
 *
 * Receives pushes sent by our own backend (services/pushService.js via the
 * web-push library) and shows a notification — no Firebase involved. Registered
 * by src/lib/push.web.ts only when web push is configured.
 */

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (e) {
    payload = { title: 'PropertyVerse', body: event.data ? event.data.text() : '' };
  }

  const title = payload.title || 'PropertyVerse';
  const options = {
    body: payload.body || 'You have a new form response.',
    icon: '/favicon-192.png',
    badge: '/favicon-32.png',
    data: payload.data || {},
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Focus an open tab (or open one) when the notification is clicked.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow('/');
      return undefined;
    })
  );
});
