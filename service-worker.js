const CACHE_NAME = 'random-cards-pwa-v2';
const SCOPE_URL = new URL('./', self.location.href).href;
const INDEX_URL = new URL('./index.html', self.location.href).href;
const OPTIONAL_ASSETS = [
  new URL('./manifest.webmanifest', self.location.href).href,
  new URL('./icon-192.png', self.location.href).href,
  new URL('./icon-512.png', self.location.href).href
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    // index.html is the only file required for the app to work offline.
    await cache.add(new Request(INDEX_URL, { cache: 'reload' }));
    // Cache the repository root too, but don't let optional files break installation.
    await Promise.allSettled([
      cache.add(new Request(SCOPE_URL, { cache: 'reload' })),
      ...OPTIONAL_ASSETS.map(url => cache.add(new Request(url, { cache: 'reload' })))
    ]);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const reqUrl = new URL(event.request.url);
  if (reqUrl.origin !== self.location.origin) return;

  if (event.request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(event.request);
        if (fresh && fresh.ok) {
          const cache = await caches.open(CACHE_NAME);
          cache.put(INDEX_URL, fresh.clone()).catch(() => {});
        }
        return fresh;
      } catch (_) {
        return (await caches.match(INDEX_URL)) || (await caches.match(SCOPE_URL));
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cached = await caches.match(event.request);
    if (cached) return cached;
    try {
      const fresh = await fetch(event.request);
      if (fresh && fresh.ok) {
        const cache = await caches.open(CACHE_NAME);
        cache.put(event.request, fresh.clone()).catch(() => {});
      }
      return fresh;
    } catch (_) {
      return Response.error();
    }
  })());
});
