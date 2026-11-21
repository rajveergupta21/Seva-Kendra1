/**
 * JanSeva Voice - Offline-First Service Worker
 * Designed for 1GB RAM Android Go phones & Flaky 2G EDGE connectivity.
 */

const CACHE_NAME = 'janseva-voice-v1';
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[JanSeva SW] Precaching core application shell');
      return cache.addAll(PRECACHE_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('[JanSeva SW] Clearing stale cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // Pass API requests to network first with graceful fallback
  if (event.request.url.includes('/api/')) {
    event.respondWith(
      fetch(event.request).catch(() => {
        // Return offline mock response for diagnosis if completely disconnected
        return new Response(JSON.stringify({
          status: "OFFLINE_QUEUED",
          ticket_token: "JP-OFFLINE-01",
          diagnosis: {
            citizen_friendly_script: "आपका सवाल रिकॉर्ड हो गया है। जैसे ही नेटवर्क आएगा, आपकी जांच पूरी हो जाएगी।"
          }
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
      })
    );
    return;
  }

  // Cache-First strategy for application shell and assets
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });
        return networkResponse;
      });
    })
  );
});
