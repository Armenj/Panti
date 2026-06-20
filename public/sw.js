/* Одиннадцать — service worker.
   Два кэша:
   - CODE_CACHE (версионный): HTML/JS/CSS. Чистится при смене CODE_VERSION,
     поэтому обновление кода лёгкое — но картинки НЕ перекачиваются.
   - IMG_CACHE (долгоживущий): картинки карт/шрифты. Переживает обновления кода,
     меняем имя только если реально меняются сами файлы картинок.
   HTML/JS — network-first с таймаутом (на медленной сети не висим, отдаём из кэша).
   Никогда не трогаем /socket.io/. */
const CODE_VERSION = 'v41';
const CODE_CACHE = 'odin-code-' + CODE_VERSION;
const IMG_CACHE = 'odin-img-v2';     // ← менять только при смене файлов картинок
const SHELL = [
  '/', '/index.html',
  '/css/style.css', '/js/client.js', '/js/main.js',
  '/socket.io/socket.io.js',
  '/icons/icon-192.png', '/icons/icon-512.png'
];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CODE_CACHE).then((c) => c.addAll(SHELL).catch(() => {})));
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keep = [CODE_CACHE, IMG_CACHE];
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => !keep.includes(k)).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

function cacheFirst(req, cacheName) {
  return caches.match(req).then((cached) =>
    cached ||
    fetch(req).then((res) => {
      const copy = res.clone();
      caches.open(cacheName).then((c) => c.put(req, copy));
      return res;
    }).catch(() => cached)
  );
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;                       // realtime POST polling, etc.
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;             // CDN fonts/icons → default handling
  // Клиентскую библиотеку socket.io кэшируем (чтобы io ВСЕГДА был доступен и
  // «мультиплеер недоступен» не выскакивал при сетевом сбое загрузки скрипта),
  // но сам realtime-транспорт (/socket.io/?EIO=...) НЕ трогаем.
  if (url.pathname === '/socket.io/socket.io.js') { e.respondWith(cacheFirst(req, CODE_CACHE)); return; }
  if (url.pathname.startsWith('/socket.io/')) return;     // never intercept realtime transport

  const isImg = /\.(png|jpe?g|gif|webp|svg|woff2?|ttf)$/.test(url.pathname);
  const isCss = /\.css$/.test(url.pathname);

  // Картинки/шрифты — cache-first в долгоживущем кэше (обновление кода их не трогает)
  if (isImg) { e.respondWith(cacheFirst(req, IMG_CACHE)); return; }

  // CSS — cache-first в кэше кода (обновляется при смене версии)
  if (isCss) { e.respondWith(cacheFirst(req, CODE_CACHE)); return; }

  // HTML / JS: network-first с таймаутом. На медленной сети fetch не отклоняется,
  // а висит — без таймаута страница «не грузится вовсе». Через 2.5с отдаём из кэша.
  e.respondWith(networkFirstWithTimeout(req, 2500));
});

function networkFirstWithTimeout(req, timeoutMs) {
  return new Promise((resolve) => {
    let settled = false;
    const done = (r) => { if (!settled && r) { settled = true; resolve(r); } };

    const timer = setTimeout(() => {
      caches.match(req).then((c) => { if (c) done(c); });   // кэш-фолбэк по таймауту
    }, timeoutMs);

    fetch(req).then((res) => {
      clearTimeout(timer);
      caches.open(CODE_CACHE).then((c) => c.put(req, res.clone()));
      done(res);
    }).catch(async () => {
      clearTimeout(timer);
      const cached = await caches.match(req);
      done(cached || (await caches.match('/index.html')) || Response.error());
    });
  });
}
