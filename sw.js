/* ---------------------------------------------------------------------------
   sw.js — offline support.

   Network first, cache as the fallback. The obvious alternative — serve from
   cache and refresh in the background — means every visitor sees the *previous*
   build for one load after each deploy, which is exactly the trap this app fell
   into during testing. Being right matters more here than saving a round trip:
   the network copy wins whenever there is a network, and the cache carries the
   app when there is not.

   Bump CACHE when the file list changes, so stale entries are purged.
--------------------------------------------------------------------------- */

const CACHE = 'fullscreen-timer-v2';

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
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        // A deep link while offline still deserves the app shell.
        if (request.mode === 'navigate') {
          const shell = await caches.match('./');
          if (shell) return shell;
        }
        return Response.error();
      }),
  );
});
