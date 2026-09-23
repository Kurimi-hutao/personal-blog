const CACHE_NAME = "hutao-blog-v66";

const APP_SHELL = [
  "./",
  "./index.html",
  "./articles.html",
  "./article.html",
  "./videos.html",
  "./works.html",
  "./kurumi.html",
  "./pet.html",
  "./admin.html",
  "./404.html",
  "./manifest.webmanifest",
  "./fonts.css",
  "./styles.css",
  "./hutao-exhibit.css",
  "./motion-core.css",
  "./lottie-core.css",
  "./motion-home.css",
  "./works.css",
  "./pet.css",
  "./article-pages.css",
  "./script.js",
  "./motion-core.js",
  "./lottie-core.js",
  "./motion-home.js",
  "./motion-articles.js",
  "./motion-video.js",
  "./motion-gallery.js",
  "./motion-pet.js",
  "./works-data.js",
  "./works.js",
  "./articles.js",
  "./article-detail.js",
  "./videos.js",
  "./article-service.js",
  "./video-uploader.js",
  "./markdown.js",
  "./theme.js",
  "./kurumi.js",
  "./pet-rig.js",
  "./pet-voices.js",
  "./pet.js",
  "./assets/vendor/gsap/gsap-3.13.0.min.js",
  "./assets/vendor/lottie-web/lottie_light-5.13.0.min.js",
  "./assets/vendor/supabase/supabase-2.108.2.js",
  "./assets/vendor/katex/katex-0.16.22.min.css",
  "./assets/vendor/katex/katex-0.16.22.min.js",
  "./assets/vendor/katex/auto-render-0.16.22.min.js",
  "./assets/icon-96.webp",
  "./assets/ink-hero-desktop.webp",
  "./assets/ink-hero-tablet.webp",
  "./assets/ink-hero-mobile.webp",
  "./assets/ink-hero.webp",
  "./assets/hutao.webp",
  "./assets/hutao-entry-shanshui.webp",
  "./assets/ink-scroll.webp",
  "./assets/kurumi-portrait-red-moon.webp",
  "./assets/kurumi-tiger.webp",
  "./assets/kurumi-spring-smile.webp",
  "./assets/kurumi-mountains.webp",
  "./assets/kurumi-vertical.webp",
  "./assets/next/parallax_mist_foreground.webp",
  "./assets/hutao-ink/PaperTexture.webp",
  "./assets/hutao-ink/InkFog_01.webp",
  "./assets/hutao-ink/InkFog_02.webp",
  "./assets/hutao-ink/InkFog_03.webp",
  "./assets/hutao-ink/BambooLeaf_01.webp",
  "./assets/lottie/ink-drop-loading.json"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.allSettled(APP_SHELL.map((asset) => cache.add(asset))),
    ),
  );
  self.skipWaiting();
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const requestUrl = new URL(event.request.url);
  if (event.request.destination === "video" || /\.(mp4|webm|ogg)(?:$|\?)/i.test(requestUrl.pathname)) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.ok && event.request.url.startsWith(self.location.origin)) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() =>
        caches.match(event.request).then((cached) => {
          if (cached) return cached;
          if (event.request.mode === "navigate") return caches.match("./index.html");
          return Response.error();
        }),
      ),
  );
});
