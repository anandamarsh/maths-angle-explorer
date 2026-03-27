const CACHE = 'angle-explorer-v1';

// On install: cache the app shell immediately
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((cache) =>
      cache.addAll([
        '/maths-angle-explorer/',
        '/maths-angle-explorer/index.html',
      ])
    ).then(() => self.skipWaiting())
  );
});

// On activate: drop old caches
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch: stale-while-revalidate for everything
self.addEventListener('fetch', (e) => {
  // Only handle GET requests on our own origin
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;

  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(e.request);
      const fetchPromise = fetch(e.request)
        .then((res) => {
          if (res.ok) cache.put(e.request, res.clone());
          return res;
        })
        .catch(() => cached); // offline fallback
      return cached ?? fetchPromise;
    })
  );
});
