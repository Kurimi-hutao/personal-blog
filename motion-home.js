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
    try { sessionStorage.setItem(sessionKey, "true"); } catch {}
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
    // The seal introduction owns the entrance; keep the hero immediately usable.
    finishOpening();
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
    setupHeroParallax();
  });
}());
