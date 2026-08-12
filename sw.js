// ============================================================
// FindShow — service worker mínimo
// v1.5.0 — 12/08/26
// ------------------------------------------------------------
// CHANGELOG (últimas 3):
// v1.5.0 (12/08/26) — Corregido bug real: cache.put(response.clone()) podía
//                      lanzar "Response body is already used" y dejaba la
//                      caché desactualizada para siempre. Cambiado a
//                      estrategia network-first (más simple y sin la
//                      condición de carrera). Las páginas detectan la
//                      actualización con el evento estándar
//                      'controllerchange' y se recargan solas.
// ============================================================
// Solo cachea el "app shell" (HTML/CSS/JS/iconos propios) para que
// la PWA sea instalable y arranque offline. Las llamadas a Spotify,
// Ticketmaster y setlist.fm NUNCA se cachean: siempre van a red,
// porque son datos que cambian constantemente.
//
// IMPORTANTE: sube siempre CACHE_NAME al desplegar cambios en el app
// shell (HTML/CSS/JS). Si no, el navegador puede seguir sirviendo
// versiones viejas cacheadas indefinidamente.
// ============================================================

var CACHE_NAME = 'findshow-shell-v1.5.0';

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

  // App shell: network-first. Prioriza siempre la versión más reciente;
  // si no hay red, cae a la última copia cacheada (para que funcione offline).
  // El clone se hace UNA vez, inmediatamente al recibir la respuesta, antes
  // de que nada más pueda leer su body — evita el bug de "body already used".
  event.respondWith(
    fetch(event.request).then(function(networkResponse) {
      if (networkResponse && networkResponse.ok) {
        var copia = networkResponse.clone();
        caches.open(CACHE_NAME).then(function(cache) {
          cache.put(event.request, copia);
        });
      }
      return networkResponse;
    }).catch(function() {
      return caches.match(event.request);
    })
  );
});
