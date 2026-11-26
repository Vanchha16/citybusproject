// City Bus service worker: makes the app installable and quick to open, and shows bus
// alerts as system notifications (some phones allow notifications only from here).
//
//   pages            network first: always the newest version when online; the saved
//                    copy only when offline
//   built files      cache first: their names change with every build (/assets/…)
//   API, map tiles,  never cached here: bus times and positions must be live
//   fonts
const CACHE = 'citybus-v1';
const SHELL = ['/', '/logo.svg', '/manifest.webmanifest', '/icons/icon-192.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    // Every page is the same app (index.html), so one saved copy serves them all offline.
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put('/', copy)); }
          return res;
        })
        .catch(() => caches.match('/')),
    );
    return;
  }

  if (/^\/(assets|icons|rides)\//.test(url.pathname)) {
    event.respondWith(
      caches.match(request).then((hit) => hit || fetch(request).then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(request, copy)); }
        return res;
      })),
    );
  }
});

// Tapping a bus alert brings the app back (or opens it).
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((windows) => (windows[0] ? windows[0].focus() : self.clients.openWindow('/'))),
  );
});
