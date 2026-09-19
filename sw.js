/* ---------------------------------------------------------------------------
   sw.js — offline support.

   Small enough to be obvious: precache the app on install, serve from cache,
   and refresh each entry in the background. Bump CACHE whenever a file changes,
   or browsers will keep serving the old build.
--------------------------------------------------------------------------- */

const CACHE = 'fullscreen-timer-v1';

const ASSETS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'assets/favicon.svg',
  'css/tokens.css',
  'css/layout.css',
  'css/components.css',
  'js/main.js',
  'js/state.js',
  'js/clock.js',
  'js/display.js',
  'js/format.js',
  'js/hide-mode.js',
  'js/keyboard.js',
  'js/screen.js',
  'js/sound.js',
  'js/theme.js',
  'js/ui.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);

      return cached || network;
    }),
  );
});
