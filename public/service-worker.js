self.addEventListener('install', (event) => {
  self.skipWaiting(); // Instantly install the new SW
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      // Delete all existing caches
      return Promise.all(
        cacheNames.map((cacheName) => caches.delete(cacheName))
      );
    }).then(() => self.clients.claim()) // Immediately take control of the page
  );
});

self.addEventListener('fetch', (event) => {
  // Do nothing. The browser will handle the network request naturally, bypassing the cache.
});
