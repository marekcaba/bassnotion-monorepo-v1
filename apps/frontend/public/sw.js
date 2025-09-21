/**
 * Service Worker for BassNotion
 * 
 * Enhanced caching for audio samples and performance optimization
 */

const CACHE_VERSION = 'v2';
const CACHE_NAME = `bassnotion-audio-${CACHE_VERSION}`;
const SAMPLE_CACHE = `bassnotion-samples-${CACHE_VERSION}`;
const STATIC_CACHE = `bassnotion-static-${CACHE_VERSION}`;

// Critical resources to cache immediately
const CRITICAL_RESOURCES = [
  '/',
  '/manifest.json',
];

// Audio sample patterns to cache
const SAMPLE_PATTERNS = [
  /\.mp3$/,
  /\.wav$/,
  /\.ogg$/,
  /supabase.*\/storage\/v1\/object\/public\/samples/,
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      console.log('[SW] Caching static assets');
      return cache.addAll(CRITICAL_RESOURCES);
    })
  );
  
  // Force immediate activation
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((cacheName) => {
            return cacheName.startsWith('bassnotion-') && 
                   !cacheName.includes(CACHE_VERSION);
          })
          .map((cacheName) => {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          })
      );
    })
  );
  
  // Take control of all clients immediately
  self.clients.claim();
});

// Fetch event - serve from cache or network
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests
  if (request.method !== 'GET') return;
  
  // Skip chrome-extension and other non-http(s) requests
  if (!url.protocol.startsWith('http')) return;
  
  // Check if this is an audio sample request
  const isAudioSample = SAMPLE_PATTERNS.some(pattern => pattern.test(url.pathname));
  
  if (isAudioSample) {
    // Cache-first strategy for audio samples
    event.respondWith(
      caches.open(SAMPLE_CACHE).then((cache) => {
        return cache.match(request).then((cachedResponse) => {
          if (cachedResponse) {
            console.log('[SW] Serving audio sample from cache:', url.pathname);
            return cachedResponse;
          }
          
          // Fetch from network and cache
          return fetch(request).then((networkResponse) => {
            // Only cache successful responses
            if (networkResponse && networkResponse.status === 200) {
              const responseToCache = networkResponse.clone();
              cache.put(request, responseToCache);
              console.log('[SW] Cached audio sample:', url.pathname);
            }
            return networkResponse;
          });
        });
      })
    );
  } else if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth/')) {
    // Network-only for API requests
    return;
  } else if (url.pathname.startsWith('/_next/static/')) {
    // Cache-first for Next.js static assets
    event.respondWith(
      caches.match(request).then((response) => {
        return response || fetch(request).then((response) => {
          if (response.status === 200) {
            const responseToCache = response.clone();
            caches.open(STATIC_CACHE).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return response;
        });
      })
    );
  } else {
    // Network-first strategy for other assets
    event.respondWith(
      fetch(request).catch(() => {
        return caches.match(request);
      })
    );
  }
});

// Message handler for cache management
self.addEventListener('message', (event) => {
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data.type === 'CACHE_SAMPLES') {
    // Pre-cache specific samples
    const { urls } = event.data;
    event.waitUntil(
      caches.open(SAMPLE_CACHE).then((cache) => {
        return Promise.all(
          urls.map((url) => {
            return fetch(url).then((response) => {
              if (response.status === 200) {
                return cache.put(url, response);
              }
            }).catch((error) => {
              console.error('[SW] Failed to cache sample:', url, error);
            });
          })
        );
      })
    );
  }
  
  if (event.data.type === 'CLEAR_SAMPLE_CACHE') {
    event.waitUntil(
      caches.delete(SAMPLE_CACHE).then(() => {
        console.log('[SW] Cleared sample cache');
      })
    );
  }
  
  if (event.data.type === 'GET_CACHE_SIZE') {
    event.waitUntil(
      Promise.all([
        caches.open(SAMPLE_CACHE),
        caches.open(STATIC_CACHE),
      ]).then(([sampleCache, staticCache]) => {
        return Promise.all([
          sampleCache.keys(),
          staticCache.keys(),
        ]);
      }).then(([sampleKeys, staticKeys]) => {
        event.ports[0].postMessage({
          sampleCount: sampleKeys.length,
          staticCount: staticKeys.length,
          totalCount: sampleKeys.length + staticKeys.length,
        });
      })
    );
  }
});