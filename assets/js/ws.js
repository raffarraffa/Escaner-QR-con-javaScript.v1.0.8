const CACHE_NAME = 'qr-scanner-v8';
const PRECACHE_URLS = [
  '/', 
  '/index.html',
  '/assets/js/index.js',
  '/assets/plugins/qrCode.min.js',
  '/assets/sonido.mp3',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.0.2/dist/css/bootstrap.min.css',
  'https://cdn.jsdelivr.net/npm/sweetalert2@11'
  // agregá aquí otros assets estáticos que quieras precachear
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) return caches.delete(key);
        })
      )
    )
  );
  self.clients.claim();
});

// Estrategia: cache-first para archivos precacheados, network-first para API
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Si es navegación (document), intentar red a network-first luego fallback a cache
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).then((res) => {
        // actualiza cache con nueva página
        const copy = res.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        return res;
      }).catch(() =>
        caches.match('/index.html')
      )
    );
    return;
  }

  // Recursos locales: cache-first
  if (PRECACHE_URLS.includes(url.pathname) || url.origin === location.origin) {
    event.respondWith(
      caches.match(event.request).then((cached) => cached || fetch(event.request).then((res) => {
        // guardar en cache runtime
        const r = res.clone();
        caches.open(CACHE_NAME).then(c => c.put(event.request, r));
        return res;
      }))
    );
    return;
  }

  // Para terceros o APIs: network-first con fallback a cache
  event.respondWith(
    fetch(event.request).then((res) => {
      const copy = res.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
      return res;
    }).catch(() => caches.match(event.request))
  );
});
