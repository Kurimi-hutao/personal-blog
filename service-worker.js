const CACHE_NAME = "hutao-cottage-game-20261009-2";

const APP_SHELL = [
  "./cottage-ui.css",
  "./assets/pet-cottage/room-night-mobile.png",
  "./assets/pet-cottage/avatars/fireman.png",
  "./assets/pet-cottage/avatars/hutao.png",
  "./assets/pet-cottage/avatars/zhang.png",
  "./assets/pet-cottage/fallbacks/fireman.png",
  "./assets/pet-cottage/fallbacks/hutao.png",
  "./assets/pet-cottage/fallbacks/zhang.png",
  "./assets/pet-cottage/ui/01_interactions/dance.png",
  "./assets/pet-cottage/ui/01_interactions/feed.png",
  "./assets/pet-cottage/ui/01_interactions/pet.png",
  "./assets/pet-cottage/ui/01_interactions/play.png",
  "./assets/pet-cottage/ui/01_interactions/rest.png",
  "./assets/pet-cottage/ui/01_interactions/wave.png",
  "./assets/pet-cottage/ui/02_actions/daily_gift.png",
  "./assets/pet-cottage/ui/02_actions/reenter_scene.png",
  "./assets/pet-cottage/ui/02_actions/reload.png",
  "./assets/pet-cottage/ui/02_actions/return_position.png",
  "./assets/pet-cottage/ui/02_actions/visit_invite.png",
  "./assets/pet-cottage/ui/03_settings/motion_off.png",
  "./assets/pet-cottage/ui/03_settings/motion_on.png",
  "./assets/pet-cottage/ui/03_settings/sound_off.png",
  "./assets/pet-cottage/ui/03_settings/sound_on.png",
  "./assets/pet-cottage/ui/04_scenes/scene_auto.png",
  "./assets/pet-cottage/ui/04_scenes/scene_dawn.png",
  "./assets/pet-cottage/ui/04_scenes/scene_day.png",
  "./assets/pet-cottage/ui/04_scenes/scene_dusk.png",
  "./assets/pet-cottage/ui/04_scenes/scene_night.png",
  "./assets/pet-cottage/ui/05_button_states/button_default.png",
  "./assets/pet-cottage/ui/05_button_states/button_disabled.png",
  "./assets/pet-cottage/ui/05_button_states/button_hover.png",
  "./assets/pet-cottage/ui/05_button_states/button_pressed.png",
  "./assets/audio/hutao/hutao-feed-01.mp3",

  "./ink-assets.css",
  "./ink-assets.js",
  "./assets/visual-refresh/articles-writing-desk-night-mobile.webp",
  "./assets/visual-refresh/articles-writing-desk-night.webp",
  "./assets/visual-refresh/empty-comments.webp",
  "./assets/visual-refresh/empty-search.webp",
  "./assets/visual-refresh/favicon-16.png",
  "./assets/visual-refresh/favicon-32.png",
  "./assets/visual-refresh/favicon-48.png",
  "./assets/visual-refresh/favicon.ico",
  "./assets/visual-refresh/home-icon-180.png",
  "./assets/visual-refresh/home-icon-192.png",
  "./assets/visual-refresh/home-icon-512.png",
  "./assets/visual-refresh/icon-bookmark.webp",
  "./assets/visual-refresh/icon-brush.webp",
  "./assets/visual-refresh/icon-lantern.webp",
  "./assets/visual-refresh/icon-scroll.webp",
  "./assets/visual-refresh/icon-seal.webp",
  "./assets/visual-refresh/load-error.webp",
  "./assets/visual-refresh/seal-hutao.webp",
  "./assets/visual-refresh/videos-riverside-stage-night-mobile.webp",
  "./assets/visual-refresh/videos-riverside-stage-night.webp",
  "./assets/visual-refresh/works-maker-study-night-mobile.webp",
  "./assets/visual-refresh/works-maker-study-night.webp",

  "./",
  "./index.html",
  "./articles.html",
  "./article.html",
  "./videos.html",
  "./works.html",
  "./kurumi.html",
  "./pet.html",
  "./admin.html",
  "./admin-cover.css",
  "./admin-workbench.css",
  "./admin-cover.js",
  "./404.html",
  "./manifest.webmanifest",
  "./fonts.css",
  "./styles.css",
  "./site-footer.css",
  "./site-footer.js",
  "./assets/beian-police.png",
  "./ink-system.css",
  "./assets/brand-tigerhat.png",
  "./hutao-exhibit.css",
  "./motion-core.css",
  "./lottie-core.css",
  "./motion-home.css",
  "./spring-ink.css",
  "./page-scenes.css",
  "./works.css",
  "./pet.css",
  "./assets/room-moments.svg",
  "./article-pages.css",
  "./editorial.css",
  "./kurumi-refinements.css",
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
