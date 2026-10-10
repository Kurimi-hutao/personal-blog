const CACHE_NAME = "hutao-comments-20261010-3";
// Install only the offline fallback. Artwork, fonts and page modules are cached
// on demand, so a home visit never downloads the pet room or other pages.
const APP_SHELL = ["./offline.html"];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(key => key.startsWith("hutao-") && key !== CACHE_NAME).map(key => caches.delete(key)),
  )).then(() => self.clients.claim()));
});

self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  if (request.destination === "video" || request.headers.has("range") || /\.(mp4|webm|ogg)$/i.test(url.pathname)) return;

  const update = async () => {
    const response = await fetch(request);
    if (response.ok && response.type !== "opaque") {
      const copy = response.clone();
      event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.put(request, copy)).catch(() => {}));
    }
    return response;
  };

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    if (request.mode === "navigate") {
      try { return await update(); }
      catch { return cached || await cache.match("./offline.html") || Response.error(); }
    }
    // Reuse downloaded fonts/artwork immediately; refresh scripts/styles in
    // the background. Versioned URLs and cache rotation carry asset updates.
    if (cached) {
      if (request.destination === "script" || request.destination === "style") {
        event.waitUntil(update().catch(() => {}));
      }
      return cached;
    }
    try { return await update(); } catch { return Response.error(); }
  })());
});
