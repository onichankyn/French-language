const CACHE = 'french-v3';
const PRECACHE = ['./', './index.html', './manifest.webmanifest', './content.js'];
// ключевые MP3 для мгновенной озвучки первых уроков офлайн
const AUDIO_PRECACHE = [
  './audio/bonjour.mp3','./audio/merci.mp3','./audio/oui.mp3','./audio/non.mp3',
  './audio/au revoir.mp3','./audio/s\'il vous plaît.mp3','./audio/pain.mp3',
  './audio/eau.mp3','./audio/café.mp3','./audio/thé.mp3','./audio/vin.mp3',
  './audio/maman.mp3','./audio/papa.mp3','./audio/ami.mp3','./audio/ville.mp3'
];
const STATIC_PREFIX = ['/audio/', '/images/', '/french-banner'];
const ASSET_PREFIX = ['/content.js'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => Promise.allSettled([...PRECACHE, ...AUDIO_PRECACHE].map((u) => c.add(u))))
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
  const isAsset = ASSET_PREFIX.some((p) => url.pathname.includes(p));

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

  // JS-контент — stale-while-revalidate: свежий контент, кэш как офлайн-фолбэк
  if (isAsset) {
    e.respondWith(
      caches.match(req).then((cached) => {
        const net = fetch(req).then((resp) => {
          const copy = resp.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return resp;
        }).catch(() => cached);
        return cached || net;
      })
    );
    return;
  }

  // Прочее — просто сеть с офлайн-fallback
  e.respondWith(
    fetch(req).catch(() => caches.match(req))
  );
});