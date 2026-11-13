(function () {
  "use strict";

  const grid = document.querySelector("#videoList");
  const filters = document.querySelector(".article-filters");
  if (!grid || !filters) return;

  const allowPreview = matchMedia("(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)");
  let previewCard = null;
  let previewVideo = null;
  let previewTimer;

  function stopPreview() {
    clearTimeout(previewTimer);
    previewCard = null;
    if (!previewVideo) return;
    const player = previewVideo;
    previewVideo = null;
    player.pause();
    player.removeAttribute("src");
    player.load();
    player.remove();
  }

  grid.addEventListener("pointerover", event => {
    const card = event.target.closest("a[data-preview-url]");
    if (!card || card === previewCard || event.pointerType === "touch" || !allowPreview.matches || navigator.connection?.saveData) return;
    stopPreview();
    previewCard = card;
    previewTimer = setTimeout(() => {
      if (!card.isConnected || document.hidden) return stopPreview();
      const player = document.createElement("video");
      player.muted = true;
      player.playsInline = true;
      player.className = "video-card-preview";
      player.setAttribute("aria-hidden", "true");
      player.src = card.dataset.previewUrl.split("#")[0] + "#t=0,4";
      previewVideo = player;
      card.querySelector(".video-card-visual").append(player);
      previewTimer = setTimeout(stopPreview, 4000);
      player.play().then(() => {
        if (previewVideo !== player) return;
        player.classList.add("is-playing");
        clearTimeout(previewTimer);
        previewTimer = setTimeout(stopPreview, 4000);
      }).catch(() => { if (previewVideo === player) stopPreview(); });
    }, 450);
  });
  grid.addEventListener("pointerout", event => {
    if (previewCard && !previewCard.contains(event.relatedTarget)) stopPreview();
  });
  document.addEventListener("visibilitychange", () => { if (document.hidden) stopPreview(); });
  allowPreview.addEventListener("change", stopPreview);
  window.addEventListener("pagehide", stopPreview);

  let timer = 0;
  function markRearranging() {
    stopPreview();
    grid.classList.add("is-rearranging");
    window.clearTimeout(timer);
    timer = window.setTimeout(() => grid.classList.remove("is-rearranging"), 320);
  }

  filters.addEventListener("input", markRearranging);
  filters.addEventListener("change", markRearranging);
  filters.addEventListener("click", (event) => {
    if (event.target.closest("button")) markRearranging();
  });
}());
