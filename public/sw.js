const SHELL = 'gc-shell-v1';
const DATA  = 'gc-data-v1';

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(SHELL).then(c => c.addAll(['/', '/index.html', '/icon-180.png']))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== SHELL && k !== DATA).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const { request } = e;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;

  // CDN externo: cache-first (fontes, JsBarcode, Tesseract)
  if (url.origin !== self.location.origin) {
    e.respondWith(cacheFirst(request, SHELL));
    return;
  }

  // API GET: network-first, fallback para cache
  if (url.pathname.startsWith('/api/')) {
    e.respondWith(networkFirst(request, DATA));
    return;
  }

  // Assets locais (index.html, ícone...): network-first
  e.respondWith(networkFirst(request, SHELL));
});

async function networkFirst(req, cacheName) {
  try {
    const resp = await fetch(req);
    if (resp.ok) {
      const c = await caches.open(cacheName);
      c.put(req, resp.clone());
    }
    return resp;
  } catch {
    const cached = await caches.match(req);
    if (cached) return cached;
    return new Response(
      JSON.stringify({ cards: [] }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

async function cacheFirst(req, cacheName) {
  const cached = await caches.match(req);
  if (cached) return cached;
  try {
    const resp = await fetch(req);
    if (resp.ok) {
      const c = await caches.open(cacheName);
      c.put(req, resp.clone());
    }
    return resp;
  } catch {
    return new Response('', { status: 503 });
  }
}
