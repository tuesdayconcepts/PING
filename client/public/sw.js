// Service Worker for PWA and Push Notifications
const CACHE_NAME = 'ping-app-v1';
const API_URL = self.location.origin.includes('localhost') 
  ? 'http://localhost:8080' 
  : 'https://ping-production-0deb.up.railway.app';

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Service Worker installing...');
  self.skipWaiting(); // Activate immediately
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Service Worker activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  return self.clients.claim(); // Take control of all pages
});

// Push event - handle incoming push notifications
self.addEventListener('push', (event) => {
  console.log('[SW] Push notification received:', event);
  
  let notificationData = {
    title: 'PING',
    body: 'You have a new notification',
    icon: '/logo/ping-logo.svg',
    badge: '/logo/ping-logo.svg',
    data: {},
  };

  if (event.data) {
    try {
      const payload = event.data.json();
      notificationData = {
        title: payload.title || notificationData.title,
        body: payload.body || notificationData.body,
        icon: payload.icon || notificationData.icon,
        badge: payload.badge || notificationData.badge,
        data: payload.data || {},
        tag: payload.tag, // Group notifications
        requireInteraction: payload.requireInteraction || false,
      };
    } catch (e) {
      console.error('[SW] Error parsing push payload:', e);
      notificationData.body = event.data.text() || notificationData.body;
    }
  }

  event.waitUntil(
    self.registration.showNotification(notificationData.title, {
      body: notificationData.body,
      icon: notificationData.icon,
      badge: notificationData.badge,
      data: notificationData.data,
      tag: notificationData.tag,
      requireInteraction: notificationData.requireInteraction,
    })
  );
});

// Notification click event - handle user clicking on notification
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event);
  
  event.notification.close();

  const notificationData = event.notification.data || {};
  let urlToOpen = '/';

  // Determine URL based on notification data
  // Priority: explicit URL (admin) > shareToken (user) > default root
  if (notificationData.url) {
    // Admin notifications (claim requests, etc.) - always use explicit URL
    urlToOpen = notificationData.url;
  } else if (notificationData.shareToken) {
    // User notifications (new ping available) - link to share URL
    urlToOpen = `/share/${notificationData.shareToken}`;
  }
  // No fallback for hotspotId - if neither url nor shareToken, default to '/'

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Check if app is already open
      for (const client of clientList) {
        if (client.url === self.location.origin + urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      // Open new window/focus existing
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

// Fetch event - handle network requests (optional caching)
self.addEventListener('fetch', (event) => {
  // Optional: Add caching logic here for offline support
  // For now, we'll just pass through to network
  event.respondWith(fetch(event.request));
});

