(function () {
  "use strict";

  const gallery = document.querySelector(".kurumi-gallery-grid, .kurumi-art-grid");
  if (!gallery) return;

  // Touch and trackpad scroll natively. A mouse drag begins only after intent is clear.
  let drag = null;
  let suppressClick = false;
  gallery.addEventListener('dragstart', event => event.preventDefault());
  gallery.addEventListener('pointerdown', event => {
    suppressClick = false;
    if (event.pointerType !== 'mouse' || event.button !== 0) return;
    drag = { id: event.pointerId, x: event.clientX, left: gallery.scrollLeft };
  });
  gallery.addEventListener('pointermove', event => {
    if (!drag || drag.id !== event.pointerId) return;
    if (!(event.buttons & 1)) { finishDrag(); return; }
    const offset = event.clientX - drag.x;
    if (!suppressClick && Math.abs(offset) < 6) return;
    if (!suppressClick) {
      gallery.setPointerCapture(event.pointerId);
      gallery.classList.add('is-dragging');
      suppressClick = true;
    }
    gallery.scrollLeft = drag.left - offset;
  });
  function finishDrag() {
    drag = null;
    gallery.classList.remove('is-dragging');
  }
  gallery.addEventListener('pointerup', finishDrag);
  gallery.addEventListener('lostpointercapture', finishDrag);
  gallery.addEventListener('pointercancel', finishDrag);
  gallery.addEventListener('click', event => {
    if (suppressClick && event.detail) {
      event.stopImmediatePropagation();
      event.preventDefault();
    }
    suppressClick = false;
  }, true);

  gallery.addEventListener("click", (event) => {
    const trigger = event.target.closest("[data-gallery-src]");
    if (!trigger) return;
    document.documentElement.classList.add("gallery-lightbox-opening");
    window.setTimeout(() => document.documentElement.classList.remove("gallery-lightbox-opening"), 420);
  });
}());
