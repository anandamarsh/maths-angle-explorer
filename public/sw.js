const CACHE = 'angle-explorer-v2';

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

  const isNavigation =
    e.request.mode === 'navigate' ||
    e.request.destination === 'document' ||
    url.pathname === '/maths-angle-explorer/' ||
    url.pathname === '/maths-angle-explorer/index.html';

  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      if (isNavigation) {
        try {
          const fresh = await fetch(e.request);
          if (fresh.ok) cache.put(e.request, fresh.clone());
          return fresh;
        } catch {
          const cached = await cache.match(e.request);
          if (cached) return cached;
          return caches.match('/maths-angle-explorer/index.html');
        }
      }

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
