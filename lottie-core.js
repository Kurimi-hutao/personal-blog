(function () {
  "use strict";

  if (window.InkLottie?.ready) return;

  const script = document.currentScript;
  const reduceQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const animationCache = new Map();
  const instances = new Set();
  const config = {
    inkLoading: "ink-drop-loading.json",
  };

  function asset(path) {
    return new URL(path, script?.src || document.baseURI).href;
  }

  function lottiePath(name) {
    return asset(`./assets/lottie/${name}`);
  }

  function isReduced() {
    return reduceQuery.matches;
  }

  function wait(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  function withTimeout(promise, ms) {
    return Promise.race([promise, wait(ms)]);
  }

  function loadData(name) {
    if (!animationCache.has(name)) {
      animationCache.set(
        name,
        fetch(lottiePath(name), { cache: "force-cache" }).then((response) => {
          if (!response.ok) throw new Error(`Lottie not found: ${name}`);
          return response.json();
        }),
      );
    }
    return animationCache.get(name);
  }

  async function createAnimation(container, options = {}) {
    if (!container || isReduced() || typeof window.lottie === "undefined") return null;
    const data = options.animationData || await loadData(options.name);
    if (!container.isConnected || isReduced()) return null;
    const instance = window.lottie.loadAnimation({
      container,
      renderer: options.renderer || "svg",
      loop: Boolean(options.loop),
      autoplay: options.autoplay !== false,
      animationData: data,
      rendererSettings: {
        preserveAspectRatio: options.preserveAspectRatio || "xMidYMid meet",
        progressiveLoad: true,
      },
    });
    instance.__inkLottieLoop = Boolean(options.loop);
    if (options.speed) instance.setSpeed(options.speed);
    instances.add(instance);
    instance.addEventListener("destroy", () => instances.delete(instance));
    return instance;
  }

  function criticalImagesReady() {
    const images = Array.from(document.images || []).filter((image) => {
      const rect = image.getBoundingClientRect();
      return image.getAttribute("fetchpriority") === "high" || rect.top < window.innerHeight * 1.15;
    });
    return Promise.allSettled(
      images.map((image) => {
        if (image.complete) return Promise.resolve();
        return new Promise((resolve) => {
          image.addEventListener("load", resolve, { once: true });
          image.addEventListener("error", resolve, { once: true });
        });
      }),
    );
  }

  function fontsReady() {
    return document.fonts?.ready?.catch(() => {}) || Promise.resolve();
  }

  async function setupSiteLoader() {
    if (!document.body?.classList.contains('home-page') || isReduced()) return;
    try {
      if (sessionStorage.getItem('hutao-seal-intro') === 'seen') return;
      sessionStorage.setItem('hutao-seal-intro', 'seen');
    } catch { /* Storage may be unavailable in private browsing. */ }
    const loader = document.createElement("div");
    loader.className = "ink-site-loader";
    loader.setAttribute("aria-hidden", "true");
    loader.innerHTML = [
      '<div class="ink-site-loader__inner">',
      `<div class="ink-site-loader__mark"><span class="ink-site-loader__drop"></span><img src="${asset('./assets/visual-refresh/seal-hutao.webp')}" width="90" height="104" alt=""></div>`,
      '<p class="ink-site-loader__text">墨卷初开</p>',
      "</div>",
    ].join("");
    document.body.prepend(loader);

    // A bounded, once-per-session introduction; data loading stays in its own region.
    await withTimeout(Promise.allSettled([loader.querySelector('img').decode(), wait(560)]), 780);
    loader.classList.add("is-leaving");
    await new Promise((resolve) => {
      const finish = () => {
        window.clearTimeout(timer);
        loader.remove();
        resolve();
      };
      const timer = window.setTimeout(finish, 280);
      loader.addEventListener("transitionend", (event) => {
        if (event.target === loader && event.propertyName === "opacity") finish();
      });
    });
  }

  document.addEventListener("visibilitychange", () => {
    instances.forEach((instance) => {
      if (document.hidden || isReduced()) instance.pause();
      else if (instance.__inkLottieLoop) instance.play();
    });
  });
  reduceQuery.addEventListener("change", () => {
    instances.forEach((instance) => {
      if (isReduced() || document.hidden) instance.pause();
      else if (instance.__inkLottieLoop) instance.play();
    });
  });

  window.InkLottie = {
    ready: true,
    asset,
    lottiePath,
    loadData,
    createAnimation,
  };

  window.InkLottie.loaded = setupSiteLoader();
}());
