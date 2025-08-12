/**
 * Service Worker for caching audio resources
 */

const CACHE_NAME = 'bassnotion-audio-v1';
const AUDIO_CACHE = 'bassnotion-audio-samples-v1';

// Critical resources to cache immediately
const CRITICAL_RESOURCES = [
  '/tonejs/core.js',
  '/tonejs/Transport.js',
  '/tonejs/Sampler.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(CRITICAL_RESOURCES);
    })
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Cache strategy for audio files
  if (url.pathname.includes('/samples/') || url.pathname.includes('.mp3') || url.pathname.includes('.wav')) {
    event.respondWith(
      caches.match(request).then((response) => {
        if (response) {
          return response;
        }
        
        return fetch(request).then((response) => {
          // Cache audio files
          if (response.status === 200) {
            const responseToCache = response.clone();
            caches.open(AUDIO_CACHE).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return response;
        });
      })
    );
    return;
  }
  
  // Cache-first strategy for JS bundles
  if (url.pathname.includes('/tonejs/') || url.pathname.endsWith('.js')) {
    event.respondWith(
      caches.match(request).then((response) => {
        return response || fetch(request).then((response) => {
          if (response.status === 200) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return response;
        });
      })
    );
  }
});