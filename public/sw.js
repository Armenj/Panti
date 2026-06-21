/* Одиннадцать — service worker.
   Два кэша:
   - CODE_CACHE (версионный): HTML/JS/CSS. Чистится при смене CODE_VERSION,
     поэтому обновление кода лёгкое — но картинки НЕ перекачиваются.
   - IMG_CACHE (долгоживущий): картинки карт/шрифты. Переживает обновления кода,
     меняем имя только если реально меняются сами файлы картинок.
   HTML/JS/CSS — stale-while-revalidate (мгновенно из кэша, обновление в фоне).
   Никогда не трогаем /socket.io/ и /api/. */
const CODE_VERSION = 'v68';
const CODE_CACHE = 'odin-code-' + CODE_VERSION;
const IMG_CACHE = 'odin-img-v2';     // ← менять только при смене файлов картинок
const SHELL = [
  '/', '/index.html',
  '/css/style.css', '/css/cabinet.css',
  '/js/client.js', '/js/main.js', '/js/auth.js',
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
  if (url.pathname.startsWith('/api/')) return;           // REST-API всегда из сети, не кэшируем

  const isImg = /\.(png|jpe?g|gif|webp|svg|woff2?|ttf)$/.test(url.pathname);

  // Картинки/шрифты/аватары — cache-first в долгоживущем кэше (версия в ?v= бастит аватар)
  if (isImg) { e.respondWith(cacheFirst(req, IMG_CACHE)); return; }

  // Навигация (открытие страницы/PWA) — отдельно и БРОНЕБОЙНО: всегда отдаём валидный
  // HTML, иначе белый экран. Сеть с таймаутом → свежий index; иначе кэш; иначе мини-HTML.
  if (req.mode === 'navigate') { e.respondWith(handleNavigate(req)); return; }

  // JS / CSS — stale-while-revalidate (мгновенно из кэша, обновление в фоне).
  e.respondWith(staleWhileRevalidate(req));
});

// Навигация: сеть (таймаут 2.5с) → кэш index → последний фолбэк (никогда не пусто)
function handleNavigate(req) {
  return caches.open(CODE_CACHE).then((cache) => new Promise((resolve) => {
    let done = false;
    const finish = (r) => { if (!done && r) { done = true; resolve(r); return true; } return false; };
    const fallback = () => cache.match('/index.html').then((c) => c || cache.match('/')).then((c) =>
      finish(c || new Response('<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="1">Загрузка…',
        { headers: { 'Content-Type': 'text/html; charset=utf-8' } })));
    const timer = setTimeout(fallback, 2500);
    fetch(req).then((res) => {
      clearTimeout(timer);
      if (res && res.status === 200) cache.put('/index.html', res.clone());
      if (!finish(res)) fallback();
    }).catch(() => { clearTimeout(timer); fallback(); });
  }));
}

function staleWhileRevalidate(req) {
  return caches.open(CODE_CACHE).then((cache) =>
    cache.match(req).then((cached) => {
      const network = fetch(req).then((res) => {
        if (res && res.status === 200) cache.put(req, res.clone());
        return res;
      }).catch(() => null);
      // есть кэш → отдаём сразу; нет → сеть; в самом конце — пустой 504, но НЕ undefined
      return cached || network.then((r) => r || new Response('', { status: 504 }));
    })
  );
}
