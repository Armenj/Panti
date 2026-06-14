/* Одиннадцать — service worker.
   Network-first for HTML/JS so an online player ALWAYS gets the latest game code
   (important while the game is under active development). Cache-first only for
   rarely-changing static assets (card images, css, fonts). Never touches /socket.io/. */
const VERSION = 'v9';
const CACHE = 'odin-' + VERSION;
const SHELL = [
  '/', '/index.html',
  '/css/style.css', '/js/client.js', '/js/main.js',
  '/icons/icon-192.png', '/icons/icon-512.png'
];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL).catch(() => {})));
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;                       // realtime POST polling, etc.
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;             // CDN fonts/icons → default handling
  if (url.pathname.startsWith('/socket.io/')) return;     // never intercept realtime transport

  const isStatic = /\.(png|jpe?g|gif|webp|svg|woff2?|ttf|css)$/.test(url.pathname);

  if (isStatic) {
    // cache-first, refresh in background
    e.respondWith(
      caches.match(req).then((cached) =>
        cached ||
        fetch(req).then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        }).catch(() => cached)
      )
    );
    return;
  }

  // HTML / JS / everything else: network-first, fall back to cache when offline
  e.respondWith(
    fetch(req).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(req, copy));
      return res;
    }).catch(() => caches.match(req).then((c) => c || caches.match('/index.html')))
  );
});
