const CACHE_NAME = 'edux-v1';

const CORE_ASSETS = [
  './index.html',
  './manifest.json',
  './logo official.png',
  './favicon-32.png',
  './raazim%20logo.png',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .then(() => self.clients.matchAll({ includeUncontrolled: true, type: 'window' }))
      .then((clients) => {
        clients.forEach((client) => client.postMessage({ type: 'EDUX_CORE_CACHED', cacheName: CACHE_NAME }));
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).catch(() => caches.match('./index.html')));
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;

      return fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          if (response.ok && response.type === 'basic') {
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)).catch(() => {});
          }
          return response;
        })
        .catch(() => caches.match('./index.html'));
    })
  );
});

self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type !== 'EDUX_CORE_STATUS') return;

  const reply = (cached) => {
    try {
      event.source?.postMessage({ type: 'EDUX_CORE_STATUS', cached: !!cached, cacheName: CACHE_NAME });
    } catch (_) {
      // ignore
    }
  };

  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.keys())
      .then((requests) => {
        const urls = new Set(requests.map((r) => r.url));
        const missing = CORE_ASSETS.filter((asset) => {
          try {
            const url = new URL(asset, self.location.origin).toString();
            return !urls.has(url);
          } catch (_) {
            return true;
          }
        });
        reply(missing.length === 0);
      })
      .catch(() => reply(false))
  );
});
