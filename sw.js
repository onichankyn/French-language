const CACHE = 'french-v2';
const PRECACHE = ['./', './index.html', './manifest.webmanifest'];
const STATIC_PREFIX = ['/audio/', '/images/', '/french-banner'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || !url.origin.includes('github')) return;

  const isNavigate = req.mode === 'navigate';
  const isStatic = STATIC_PREFIX.some((p) => url.pathname.includes(p));

  // HTML / навигация — всегда сеть (свежая версия), офлайн-fallback на кэш
  if (isNavigate) {
    e.respondWith(
      fetch(req)
        .then((resp) => {
          const copy = resp.clone();
          caches.open(CACHE).then((c) => c.put('./index.html', copy));
          return resp;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Статика (аудио, картинки) — cache-first, потом сеть
  if (isStatic) {
    e.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req).then((resp) => {
          const copy = resp.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return resp;
        });
      }).catch(() => caches.match(req))
    );
    return;
  }

  // Прочее — просто сеть с офлайн-fallback
  e.respondWith(
    fetch(req).catch(() => caches.match(req))
  );
});