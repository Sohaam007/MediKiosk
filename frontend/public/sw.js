/**
 * MediKiosk PWA Service Worker (Offline Support & Asset Caching)
 *
 * Implements Cache-First / Stale-While-Revalidate caching strategy for application
 * assets and provides resilient offline fallback for kiosk touch screens.
 */

const CACHE_NAME = 'medikiosk-cache-v1';

const STATIC_PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.svg',
  '/icons.svg',
  '/icon-192.png',
  '/icon-512.png',
];

// Install Event: Pre-cache core shell resources
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(STATIC_PRECACHE_URLS).catch((err) => {
          console.warn('Some precache assets could not be cached immediately:', err);
        });
      })
      .then(() => self.skipWaiting())
  );
});

// Activate Event: Clean up legacy caches and claim clients immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((name) => {
            if (name !== CACHE_NAME) {
              return caches.delete(name);
            }
            return null;
          })
        );
      })
      .then(() => self.clients.claim())
  );
});

// Fetch Event: Handle requests with appropriate caching strategies
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // 1. Bypass non-GET requests (e.g. POST, PUT, DELETE for clinical intakes)
  if (request.method !== 'GET') {
    return;
  }

  // 2. Bypass SSE live streams and WebSockets
  if (
    url.pathname.includes('/api/clinician/queue/live') ||
    request.headers.get('accept')?.includes('text/event-stream')
  ) {
    return;
  }

  // 3. API Requests: Network-first strategy (avoid stale medical state in offline mode)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request).catch(() => {
        return caches.match(request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          return new Response(
            JSON.stringify({
              error: 'Offline',
              message:
                'MediKiosk is currently running in offline mode. Live network is unavailable.',
            }),
            {
              status: 503,
              statusText: 'Service Unavailable',
              headers: { 'Content-Type': 'application/json' },
            }
          );
        });
      })
    );
    return;
  }

  // 4. HTML Navigation Requests: Network-first with cached index.html fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
          }
          return response;
        })
        .catch(() => {
          return caches.match('/index.html').then((fallback) => {
            return fallback || caches.match('/');
          });
        })
    );
    return;
  }

  // 5. Static Assets (JS, CSS, Images, Fonts): Stale-While-Revalidate
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});
