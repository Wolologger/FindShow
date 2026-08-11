// ============================================================
// FindShow — service worker mínimo
// Solo cachea el "app shell" (HTML/CSS/JS/iconos propios) para que
// la PWA sea instalable y arranque offline. Las llamadas a Spotify,
// Ticketmaster y setlist.fm NUNCA se cachean: siempre van a red,
// porque son datos que cambian constantemente.
// ============================================================

var CACHE_NAME = 'findshow-shell-v1';

var APP_SHELL = [
  './',
  './index.html',
  './demo.html',
  './css/styles.css',
  './js/ui.js',
  './js/app.js',
  './js/demo.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(APP_SHELL);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(nombres) {
      return Promise.all(
        nombres
          .filter(function(nombre) { return nombre !== CACHE_NAME; })
          .map(function(nombre) { return caches.delete(nombre); })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function(event) {
  var url = event.request.url;

  // Nunca cachear llamadas a las APIs externas: siempre red, datos en vivo.
  var esApiExterna = url.indexOf('api.spotify.com') !== -1 ||
    url.indexOf('accounts.spotify.com') !== -1 ||
    url.indexOf('ticketmaster.com') !== -1 ||
    url.indexOf('setlist.fm') !== -1;

  if (esApiExterna || event.request.method !== 'GET') {
    return; // deja que el navegador la maneje normal, sin interceptar
  }

  // App shell: cache-first con actualización en segundo plano (stale-while-revalidate)
  event.respondWith(
    caches.match(event.request).then(function(cached) {
      var fetchPromise = fetch(event.request).then(function(networkResponse) {
        if (networkResponse && networkResponse.ok) {
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(event.request, networkResponse.clone());
          });
        }
        return networkResponse;
      }).catch(function() { return cached; });

      return cached || fetchPromise;
    })
  );
});
