/* 오프라인 플레이용 서비스 워커 */
const VERSION = 'noodle-v1';
const SHELL = [
  './', './index.html', './manifest.webmanifest', './css/style.css',
  './vendor/three.min.js',
  './js/config.js', './js/ramen.js', './js/fx.js', './js/models.js', './js/noodle.js', './js/stage.js', './js/game.js', './js/main.js',
  './icons/icon-180.png', './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png',
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then(hit => hit || fetch(req).then(res => {
      // 글꼴 등 외부 리소스도 한 번 받으면 오프라인용으로 보관
      if (res && (res.ok || res.type === 'opaque')) {
        const copy = res.clone();
        caches.open(VERSION).then(c => c.put(req, copy));
      }
      return res;
    }).catch(() => caches.match('./index.html')))
  );
});
