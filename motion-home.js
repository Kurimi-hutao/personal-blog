(function () {
  "use strict";

  if (!document.body.classList.contains("home-page")) return;

  const reduceQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  let reduced = reduceQuery.matches;
  const compact = window.matchMedia("(max-width: 840px), (pointer: coarse)").matches;
  const sessionKey = "hutao-home-opened";
  let openingTimer;

  function finishOpening() {
    window.clearTimeout(openingTimer);
    document.body.classList.remove("motion-home-opening");
    document.body.classList.add("motion-home-ready");
    sessionStorage.setItem(sessionKey, "true");
  }

  reduceQuery.addEventListener("change", (event) => {
    reduced = event.matches;
    if (reduced && document.body.classList.contains("motion-home-opening")) finishOpening();
  });

  function onReady(callback) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", callback, { once: true });
    } else {
      callback();
    }
  }

  function setupOpening() {
    const seen = sessionStorage.getItem(sessionKey) === "true";
    const duration = reduced ? 0 : seen ? 400 : compact ? 650 : 900;
    document.body.style.setProperty("--home-open-duration", `${duration}ms`);
    document.body.classList.add("motion-home-opening");

    openingTimer = window.setTimeout(finishOpening, duration);
  }

  function createRoute() {
    const main = document.querySelector(".home-page main");
    if (!main || document.querySelector(".jianghu-route")) return null;
    const route = document.createElement("div");
    route.className = "jianghu-route";
    route.setAttribute("aria-hidden", "true");
    route.innerHTML = [
      '<svg viewBox="0 0 44 640" preserveAspectRatio="none">',
      '<path pathLength="1" d="M22 6 C8 82 36 134 20 214 C8 274 34 334 22 398 C12 462 32 526 22 634" />',
      "</svg>",
      "<span></span><span></span><span></span><span></span><span></span><span></span><span></span>",
    ].join("");
    main.prepend(route);
    return route;
  }

  function setupRouteProgress() {
    const route = createRoute();
    if (!route) return;
    const nodes = Array.from(route.querySelectorAll("span"));
    const sections = [
      "#articles",
      "#videos",
      "#achievements",
      ".kurumi-portal",
      "#links",
      "#about",
      "#message",
    ].map((selector) => document.querySelector(selector));
    let ticking = false;

    function update() {
      ticking = false;
      const rect = route.getBoundingClientRect();
      const documentTop = window.scrollY + rect.top;
      const routeHeight = Math.max(1, route.offsetHeight - window.innerHeight * 0.22);
      const progress = Math.max(0, Math.min(1, (window.scrollY - documentTop + window.innerHeight * 0.58) / routeHeight));
      route.style.setProperty("--route-progress", progress.toFixed(3));

      sections.forEach((section, index) => {
        if (!section || !nodes[index]) return;
        const sectionTop = section.getBoundingClientRect().top;
        nodes[index].classList.toggle("is-lit", sectionTop < window.innerHeight * 0.62);
      });
    }

    function requestUpdate() {
      if (ticking || document.hidden) return;
      ticking = true;
      window.requestAnimationFrame(update);
    }

    update();
    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", requestUpdate, { passive: true });
  }

  function setupHeroParallax() {
    if (compact) return;
    const hero = document.querySelector(".home-page .hero");
    if (!hero) return;

    let frame = 0;
    let targetX = 0;
    let targetY = 0;

    function render() {
      frame = 0;
      if (reduced) return;
      hero.style.setProperty("--home-parallax-x", `${targetX.toFixed(2)}px`);
      hero.style.setProperty("--home-parallax-y", `${targetY.toFixed(2)}px`);
    }

    hero.addEventListener("pointermove", (event) => {
      if (reduced) return;
      const rect = hero.getBoundingClientRect();
      targetX = ((event.clientX - rect.left) / rect.width - 0.5) * 12;
      targetY = ((event.clientY - rect.top) / rect.height - 0.5) * 8;
      if (!frame) frame = window.requestAnimationFrame(render);
    }, { passive: true });

    hero.addEventListener("pointerleave", () => {
      targetX = 0;
      targetY = 0;
      if (!frame) frame = window.requestAnimationFrame(render);
    });
    reduceQuery.addEventListener("change", () => {
      targetX = targetY = 0;
      hero.style.setProperty("--home-parallax-x", "0px");
      hero.style.setProperty("--home-parallax-y", "0px");
    });
  }

  onReady(() => {
    Promise.resolve(window.InkLottie?.loaded).then(setupOpening);
    setupRouteProgress();
    setupHeroParallax();
  });
}());
