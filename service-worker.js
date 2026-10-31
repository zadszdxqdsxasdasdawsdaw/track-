// language: JavaScript, file: service-worker.js
const CACHE = 'habits-v4';
const SHELL = [
  './manifest.webmanifest',
  './icon.svg'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  const url = new URL(req.url);

  // GitHub API и сторонние CDN — всегда в сеть, без кэша
  if (url.hostname === 'api.github.com') return;
  if (url.hostname !== location.hostname) return;

  // HTML и навигационные запросы — network-first (свежий index.html всегда)
  const isHTML = req.mode === 'navigate'
    || (req.headers.get('accept') || '').includes('text/html')
    || url.pathname.endsWith('/')
    || url.pathname.endsWith('/index.html');

  if (isHTML) {
    e.respondWith(
      fetch(req)
        .then(res => {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(req, clone));
          return res;
        })
        .catch(() => caches.match(req).then(c => c || caches.match('./index.html')))
    );
    return;
  }

  // Остальное (иконки, манифест) — cache-first, с фоновым обновлением
  e.respondWith(
    caches.match(req).then(cached => {
      const fetched = fetch(req).then(res => {
        if (res.ok && req.method === 'GET') {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(req, clone));
        }
        return res;
      }).catch(() => cached);
      return cached || fetched;
    })
  );
});
