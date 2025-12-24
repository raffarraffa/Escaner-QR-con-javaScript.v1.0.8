const CACHE_NAME = 'validador-qr-v2.3.0';
const ASSETS = [
  './',
  'index.html',
  'manifest.json',
  'assets/plugins/qrCode.min.js',
  'assets/icons/qr.png',
  'assets/icons/pwa-192x192.png',
  'assets/icons/pwa-515x512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
});
