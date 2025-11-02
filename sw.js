const CACHE_NAME = 'sila90-v2';
const ASSETS = [
    '/', '/index.html', '/manifest.webmanifest',

    '/icons/favicon.ico',
    '/icons/favicon-16.png',
    '/icons/favicon-32.png',
    '/icons/favicon-48.png',
    '/icons/favicon-64.png',
    '/icons/icon-72.png',
    '/icons/icon-96.png',
    '/icons/icon-128.png',
    '/icons/icon-144.png',
    '/icons/icon-192.png',
    '/icons/icon-256.png',
    '/icons/icon-384.png',
    '/icons/icon-512.png',
    '/icons/icon-512-maskable.png',
    '/icons/icon-1024.png',
    '/icons/icon-1024-maskable.svg',
    '/icons/apple-touch-icon-120.png',
    '/icons/apple-touch-icon-152.png',
    '/icons/apple-touch-icon-167.png',
    '/icons/apple-touch-icon-180.png',

    '/assets/fontawesome/css/all.min.css',
    '/assets/fontawesome/webfonts/fa-brands-400.woff2',
    '/assets/fontawesome/webfonts/fa-regular-400.woff2',
    '/assets/fontawesome/webfonts/fa-solid-900.woff2'
];

self.addEventListener('install', (e) => {
    e.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)));
    self.skipWaiting();
});

self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then(keys => Promise.all(
            keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
        ))
    );
    self.clients.claim();
});

// Стратегия: HTML — network-first, остальное — cache-first
self.addEventListener('fetch', (e) => {
    const req = e.request;
    const isHTML = req.headers.get('accept')?.includes('text/html');

    if (isHTML) {
        e.respondWith(
            fetch(req).then(res => {
                const copy = res.clone();
                caches.open(CACHE_NAME).then(c => c.put(req, copy));
                return res;
            }).catch(() => caches.match(req).then(r => r || caches.match('/index.html')))
        );
    } else {
        e.respondWith(
            caches.match(req).then(cached => cached || fetch(req).then(res => {
                // можно закэшить только same-origin и GET
                if (req.method === 'GET' && new URL(req.url).origin === location.origin) {
                    const copy = res.clone();
                    caches.open(CACHE_NAME).then(c => c.put(req, copy));
                }
                return res;
            }))
        );
    }
});