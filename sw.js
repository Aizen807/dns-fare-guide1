const CACHE_NAME = "fare-matrix-v31";
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png"
];

// Install event - cache assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Caching assets');
        return cache.addAll(ASSETS);
      })
      .catch((err) => {
        console.warn('[SW] Failed to cache assets:', err);
      })
  );
  // Force the waiting service worker to become the active service worker
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => {
        return Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => {
              console.log('[SW] Removing old cache:', key);
              return caches.delete(key);
            })
        );
      })
      .then(() => {
        console.log('[SW] Claiming clients');
        // Take control of all clients immediately
        return self.clients.claim();
      })
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener("fetch", (event) => {
  // Skip non-GET requests and cross-origin requests
  if (event.request.method !== 'GET') {
    return;
  }

  // Only handle requests for our own origin
  const url = new URL(event.request.url);
  if (url.origin !== location.origin) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((cached) => {
        if (cached) {
          // Return cached response, but update in background
          const fetchPromise = fetch(event.request)
            .then((networkResponse) => {
              // Update cache with fresh response
              if (networkResponse && networkResponse.status === 200) {
                caches.open(CACHE_NAME)
                  .then((cache) => {
                    cache.put(event.request, networkResponse.clone());
                  })
                  .catch(() => {});
              }
              return networkResponse;
            })
            .catch(() => {
              // If network fails, cached response is still returned
            });
          
          // Return cached response immediately
          return cached;
        }
        
        // No cache, go to network
        return fetch(event.request)
          .then((response) => {
            // Cache successful responses for future
            if (response && response.status === 200) {
              const responseClone = response.clone();
              caches.open(CACHE_NAME)
                .then((cache) => {
                  cache.put(event.request, responseClone);
                })
                .catch(() => {});
            }
            return response;
          })
          .catch(() => {
            // Return a fallback offline page for HTML requests
            if (event.request.headers.get('accept')?.includes('text/html')) {
              return caches.match('./index.html');
            }
            // For other requests, just reject
            return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
          });
      })
  );
});
