(function () {
  "use strict";

  if (window.MotionCore?.ready) return;

  const reduceQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const coarseQuery = window.matchMedia("(max-width: 840px), (pointer: coarse)");
  const fineQuery = window.matchMedia("(hover: hover) and (pointer: fine)");
  const state = {
    ready: true,
    reduced: reduceQuery.matches,
    coarse: coarseQuery.matches,
    fine: fineQuery.matches,
    observers: new Set(),
    mutationObservers: new Set(),
    leaving: false,
    hidden: document.hidden,
    openSelect: null,
  };

  const selectInstances = new WeakMap();
  const listAnimations = new WeakMap();
  let revealObserver = null;
  let illustrationPaused = false;
  try { illustrationPaused = localStorage.getItem('hutao-wuxia-paused') === '1'; } catch {}

  reduceQuery.addEventListener("change", (event) => {
    state.reduced = event.matches;
    syncAmbientState();
    if (!state.reduced) {
      setupReveal();
      setupInkHeadings();
      return;
    }
    document.querySelectorAll(".motion-reveal").forEach((element) => {
      element.classList.add("is-visible", "visible");
      element.getAnimations().forEach((animation) => {
        if (animation.effect?.getTiming().iterations !== Infinity) animation.finish();
      });
    });
    document.querySelectorAll(".click-petal, .ink-click-core, .ink-click-ripple").forEach((element) => element.remove());
    document.querySelectorAll(".motion-pressing, .motion-released").forEach((element) => element.classList.remove("motion-pressing", "motion-released"));
    document.querySelectorAll(".ink-heading-ready").forEach(element => element.classList.add("ink-heading-visible"));
  });

  const revealSelector = [
    ".reveal",
    ".page-title",
    ".article-filters",
    ".filter-summary",
    ".all-articles-grid > *",
    ".video-grid > *",
    ".article-detail-shell > *",
    ".kurumi-profile-card",
    ".kurumi-art-card",
    ".pet-notes > *",
  ].join(",");

  const dynamicContainers = [
    "#latestArticles",
    "#latestVideos",
    "#articleList",
    "#videoList",
    "#relatedArticles",
    "#commentList",
    "#guestbookList",
  ].join(",");

  function onReady(callback) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", callback, { once: true });
    } else {
      callback();
    }
  }

  function addReveal(element, index = 0) {
    if (!(element instanceof HTMLElement)) return;
    if (element.closest(".hero, .pet-entry") || element.classList.contains("motion-reveal")) return;
    element.classList.add("motion-reveal");
    element.style.transitionDelay = `${Math.min(index % 5, 4) * 55}ms`;
  }

  function getRevealObserver() {
    if (state.reduced || !("IntersectionObserver" in window)) return null;
    if (revealObserver) return revealObserver;
    try {
      revealObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible", "visible", "ink-heading-visible");
          revealObserver?.unobserve(entry.target);
        });
      }, { rootMargin: "0px 0px -6% 0px", threshold: 0.05 });
      state.observers.add(revealObserver);
    } catch {
      // Enhancement failure must never hide content.
      revealObserver = null;
    }
    return revealObserver;
  }

  function observeOrShow(element) {
    const observer = getRevealObserver();
    if (observer) {
      try { observer.observe(element); return; } catch {}
    }
    element.classList.add("is-visible", "visible", "ink-heading-visible");
  }

  function setupReveal(root = document) {
    const elements = Array.from(root.querySelectorAll?.(revealSelector) || []);
    elements.forEach((element, index) => { addReveal(element, index); observeOrShow(element); });
    return revealObserver;
  }

  function setupInkHeadings(root = document) {
    root.querySelectorAll?.(".section-heading h2, .page-title h1, .works-hero h1, .kurumi-gallery-section h2").forEach(element => {
      if (element.classList.contains("ink-heading-ready")) return;
      element.classList.add("ink-heading-ready");
      observeOrShow(element);
    });
  }

  function revealInserted(node) {
    if (!(node instanceof HTMLElement)) return;
    const candidates = [];
    if (node.matches(revealSelector) || node.matches("article, a, figure, .article-card, .video-card, .comment-item")) {
      candidates.push(node);
    }
    candidates.push(...node.querySelectorAll?.(revealSelector) || []);
    candidates.forEach((element, index) => {
      addReveal(element, index);
      observeOrShow(element);
    });
    setupInkHeadings(node);
  }

  function setupDynamicReveal() {
    if (!("MutationObserver" in window)) return;
    document.querySelectorAll(dynamicContainers).forEach((container) => {
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => mutation.addedNodes.forEach(revealInserted));
      });
      observer.observe(container, { childList: true, subtree: true });
      state.mutationObservers.add(observer);
    });
  }

  function setupScrollProgress() {
    if (state.coarse) return;
    const progress = document.createElement("div");
    progress.className = "motion-scroll-progress";
    progress.setAttribute("aria-hidden", "true");
    progress.innerHTML = '<span class="motion-scroll-progress__dot"></span>';
    document.body.appendChild(progress);
    const dot = progress.querySelector("span");
    let ticking = false;

    function update() {
      ticking = false;
      const scrollable = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      const ratio = Math.max(0, Math.min(1, window.scrollY / scrollable));
      dot.style.top = `${ratio * 100}%`;
      document.body.classList.toggle("is-scrolled", window.scrollY > 16);
      document.querySelector("[data-site-header]")?.classList.toggle("scrolled", window.scrollY > 40);
    }

    function requestUpdate() {
      if (ticking || state.hidden) return;
      ticking = true;
      window.requestAnimationFrame(update);
    }

    update();
    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", requestUpdate, { passive: true });
  }

  function createClickEffect(x, y, source) {
    if (state.reduced || state.hidden) return;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    const target = source instanceof Element ? source : null;
    if (!target?.closest("button, a, summary, [role='button']")) return;
    if (target.closest("dialog, .animated-select, .animated-select__panel, input, textarea, select, option, video, audio, iframe, canvas, [contenteditable='true'], :disabled, [aria-disabled='true']")) return;
    // Animate these controls at the affected icon or panel.
    if (target.closest('#bookmarkArticle,#shareArticle,.friend-group-heading,.like-button,.seal-button,[data-gallery-src],.menu-toggle,.theme-toggle,.back-to-top')) return;
    if (document.querySelectorAll('.ink-click-ripple').length >= 3) return;

    const duration = state.coarse ? 460 : 580;
    const size = state.coarse ? 42 : 60;
    const variant = 1 + Math.floor(Math.random() * 4);
    const rotation = `${Math.round(Math.random() * 360)}deg`;
    const root = document.createDocumentFragment();
    ['ink-click-ripple', 'ink-click-core'].forEach((className) => {
      const mark = document.createElement('i');
      mark.className = className;
      mark.setAttribute('aria-hidden', 'true');
      mark.style.setProperty('--click-x', `${x}px`);
      mark.style.setProperty('--click-y', `${y}px`);
      mark.style.setProperty('--click-size', `${size}px`);
      mark.style.setProperty('--click-duration', `${duration}ms`);
      mark.style.setProperty('--ink-angle', rotation);
      mark.style.setProperty('--ink-drop-mask', `url('./assets/ink-refinement-20261104/ink-drop-${variant}.svg')`);
      root.appendChild(mark);
    });
    const nodes = Array.from(root.children);
    document.body.appendChild(root);
    window.setTimeout(() => nodes.forEach(node => node.remove()), duration + 80);
  }

  function setupClickFeedback() {
    const mobileOwnsPress = () => document.documentElement.classList.contains('has-mobile-feedback') &&
      window.matchMedia('(max-width:1080px)').matches;
    let touch = null;
    window.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || !event.isPrimary) { touch = null; return; }
      if (event.pointerType === 'mouse') createClickEffect(event.clientX, event.clientY, event.target);
      else touch = { id: event.pointerId, x: event.clientX, y: event.clientY, target: event.target, at: performance.now() };
    }, { passive: true });
    window.addEventListener('pointermove', event => {
      if (touch?.id === event.pointerId && Math.hypot(event.clientX - touch.x, event.clientY - touch.y) > 10) touch = null;
    }, { passive: true });
    window.addEventListener('pointerup', event => {
      const tap = touch; touch = null;
      if (!tap || tap.id !== event.pointerId || performance.now() - tap.at > 500) return;
      if (Math.hypot(event.clientX - tap.x, event.clientY - tap.y) > 10 || !window.getSelection()?.isCollapsed) return;
      createClickEffect(event.clientX, event.clientY, tap.target);
    }, { passive: true });
    window.addEventListener('pointercancel', () => { touch = null; }, { passive: true });

    document.addEventListener("pointerdown", (event) => {
      if (state.reduced || mobileOwnsPress() || !event.isPrimary || event.button !== 0) return;
      const target = event.target.closest?.("button, a, [role='button'], [role='option'], summary");
      if (!target || target.matches(":disabled, [aria-disabled='true']")) return;
      target.classList.add("motion-pressing");
    }, { passive: true });

    const release = () => {
      document.querySelectorAll(".motion-pressing").forEach((target) => {
        target.classList.remove("motion-pressing");
        target.classList.add("motion-released");
        window.setTimeout(() => target.classList.remove("motion-released"), state.reduced ? 80 : 180);
      });
    };
    document.addEventListener("pointerup", release, { passive: true });
    document.addEventListener("pointercancel", release, { passive: true });
    window.addEventListener('blur', release);
    document.addEventListener("keyup", (event) => {
      if (event.key === "Enter" || event.key === " ") release();
    });
    document.addEventListener("keydown", (event) => {
      if (state.reduced || mobileOwnsPress() || event.repeat) return;
      if (event.key !== "Enter" && event.key !== " ") return;
      const target = event.target.closest?.("button, a, [role='button'], [role='option'], summary");
      if (!target || target.matches(":disabled, [aria-disabled='true']")) return;
      target.classList.add("motion-pressing");
    });
  }

  function nextId(prefix) {
    return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
  }

  function optionLabel(option) {
    return option?.textContent?.trim() || option?.value || "";
  }

  function closeOpenSelect(except) {
    if (state.openSelect && state.openSelect !== except) state.openSelect.close();
  }

  function createAnimatedSelect(select) {
    if (!(select instanceof HTMLSelectElement)) return null;
    const existing = selectInstances.get(select);
    if (existing) {
      existing.refresh();
      return existing;
    }

    const wrapper = document.createElement("div");
    wrapper.className = "animated-select";
    if (select.id) wrapper.dataset.selectId = select.id;
    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "animated-select__trigger";
    const panelId = nextId(select.id || "animated-select");
    trigger.setAttribute("aria-haspopup", "listbox");
    trigger.setAttribute("aria-expanded", "false");
    trigger.setAttribute("aria-controls", panelId);
    const value = document.createElement("span");
    value.className = "animated-select__value";
    const arrow = document.createElement("span");
    arrow.className = "animated-select__arrow";
    arrow.setAttribute("aria-hidden", "true");
    trigger.append(value, arrow);

    const panel = document.createElement("div");
    panel.className = "animated-select__panel";
    panel.hidden = true;
    panel.id = panelId;
    panel.dataset.selectPortal = select.id || panelId;
    const listbox = document.createElement("div");
    listbox.className = "animated-select__list";
    listbox.setAttribute("role", "listbox");
    panel.appendChild(listbox);
    wrapper.append(trigger);
    select.after(wrapper);
    document.body.appendChild(panel);
    select.classList.add("native-select-hidden");
    select.dataset.animatedReady = "true";
    select.setAttribute("aria-hidden", "true");
    select.setAttribute("tabindex", "-1");
    select.setAttribute("inert", "");
    select.hidden = true;

    let optionButtons = [];
    let activeIndex = Math.max(0, select.selectedIndex);
    let open = false;
    let focusTimer = 0;
    let panelAnimation = null;
    let optionAnimations = [];

    function stopSelectEvent(event) {
      event.stopPropagation();
    }

    [wrapper, panel].forEach((element) => {
      element.addEventListener("pointerdown", stopSelectEvent);
      element.addEventListener("mousedown", stopSelectEvent);
      element.addEventListener("click", stopSelectEvent);
    });

    function selectedIndex() {
      const index = Array.from(select.options).findIndex((option) => option.value === select.value);
      return Math.max(0, index);
    }

    function setSelected(index, emit = true) {
      const option = select.options[index];
      if (!option) return;
      select.value = option.value;
      activeIndex = index;
      value.textContent = optionLabel(option);
      optionButtons.forEach((button, buttonIndex) => {
        const selected = buttonIndex === index;
        button.setAttribute("aria-selected", String(selected));
        button.tabIndex = selected ? 0 : -1;
        button.classList.toggle("is-selected", selected);
      });
      if (emit) select.dispatchEvent(new Event("change", { bubbles: true }));
    }

    function refresh() {
      listbox.replaceChildren();
      optionButtons = Array.from(select.options).map((option, index) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "animated-select__option";
        button.setAttribute("role", "option");
        button.dataset.value = option.value;
        button.textContent = optionLabel(option);
        button.addEventListener("pointerdown", stopSelectEvent);
        button.addEventListener("mousedown", stopSelectEvent);
        button.addEventListener("click", (event) => {
          event.stopPropagation();
          setSelected(index);
          close(true);
          trigger.focus({ preventScroll: true });
        });
        listbox.appendChild(button);
        return button;
      });
      setSelected(selectedIndex(), false);
    }

    function cancelAnimations() {
      window.clearTimeout(focusTimer);
      panelAnimation?.cancel();
      panelAnimation = null;
      optionAnimations.forEach((animation) => animation.cancel());
      optionAnimations = [];
    }

    function updatePosition() {
      if (!open) return;
      const rect = trigger.getBoundingClientRect();
      const viewportWidth = document.documentElement.clientWidth;
      const viewportHeight = document.documentElement.clientHeight;
      const gutter = 14;
      const width = Math.min(Math.max(rect.width, 180), Math.max(180, viewportWidth - gutter * 2));
      const left = Math.min(Math.max(gutter, rect.left), Math.max(gutter, viewportWidth - width - gutter));
      const below = Math.max(120, viewportHeight - rect.bottom - gutter);
      const above = Math.max(120, rect.top - gutter);
      const openUp = below < 180 && above > below;
      const maxHeight = Math.min(320, openUp ? above - 8 : below - 8);
      panel.classList.toggle("is-above", openUp);
      panel.style.width = `${width}px`;
      panel.style.left = `${left}px`;
      panel.style.top = openUp ? "auto" : `${rect.bottom + 8}px`;
      panel.style.bottom = openUp ? `${viewportHeight - rect.top + 8}px` : "auto";
      panel.style.setProperty("--animated-select-max-height", `${Math.max(120, maxHeight)}px`);
    }

    function openPanel() {
      if (open) return;
      closeOpenSelect(api);
      open = true;
      state.openSelect = api;
      cancelAnimations();
      wrapper.classList.add("is-open");
      panel.hidden = false;
      panel.classList.add("is-portaled", "is-open");
      trigger.setAttribute("aria-expanded", "true");
      updatePosition();
      panel.style.visibility = "visible";
      panel.style.pointerEvents = "auto";
      const duration = state.reduced ? 1 : 210;
      panelAnimation = panel.animate(
        [
          { opacity: 0, transform: "translate3d(0,-8px,0) scaleY(.94)" },
          { opacity: 1, transform: "translate3d(0,0,0) scaleY(1)" },
        ],
        { duration, easing: "cubic-bezier(.22,1,.36,1)", fill: "forwards" },
      );
      optionButtons.forEach((button, index) => {
        const animation = button.animate(
          [
            { opacity: 0, transform: "translate3d(0,6px,0)" },
            { opacity: 1, transform: "translate3d(0,0,0)" },
          ],
          {
            duration: state.reduced ? 1 : 160,
            delay: state.reduced ? 0 : Math.min(index, 8) * 32,
            easing: "cubic-bezier(.22,1,.36,1)",
            fill: "forwards",
          },
        );
        optionAnimations.push(animation);
      });
      focusTimer = window.setTimeout(() => {
        if (open) optionButtons[activeIndex]?.focus({ preventScroll: true });
      }, state.reduced ? 0 : 40);
    }

    function close(returnFocus = false) {
      if (!open) return;
      open = false;
      if (state.openSelect === api) state.openSelect = null;
      cancelAnimations();
      wrapper.classList.remove("is-open");
      panel.classList.remove("is-open");
      trigger.setAttribute("aria-expanded", "false");
      const duration = state.reduced ? 1 : 150;
      optionButtons.forEach((button) => {
        optionAnimations.push(button.animate(
          [{ opacity: 1 }, { opacity: 0 }],
          { duration: state.reduced ? 1 : 90, easing: "ease-out", fill: "forwards" },
        ));
      });
      panelAnimation = panel.animate(
        [
          { opacity: 1, transform: "translate3d(0,0,0) scaleY(1)" },
          { opacity: 0, transform: "translate3d(0,-6px,0) scaleY(.96)" },
        ],
        { duration, easing: "cubic-bezier(.4,0,.2,1)", fill: "forwards" },
      );
      panelAnimation.onfinish = () => {
        if (open) return;
        panel.style.visibility = "hidden";
        panel.style.pointerEvents = "none";
        panel.hidden = true;
        panel.classList.remove("is-portaled", "is-above");
      };
      if (returnFocus) trigger.focus({ preventScroll: true });
    }

    function move(delta) {
      const count = optionButtons.length;
      if (!count) return;
      activeIndex = (activeIndex + delta + count) % count;
      optionButtons[activeIndex].focus({ preventScroll: true });
    }

    trigger.addEventListener("pointerdown", stopSelectEvent);
    trigger.addEventListener("mousedown", stopSelectEvent);
    trigger.addEventListener("click", (event) => {
      event.stopPropagation();
      open ? close() : openPanel();
    });
    trigger.addEventListener("keydown", (event) => {
      if (["Enter", " ", "ArrowDown", "ArrowUp"].includes(event.key)) {
        event.preventDefault();
        if (!open) openPanel();
        if (event.key === "ArrowDown") move(1);
        if (event.key === "ArrowUp") move(-1);
      }
    });
    listbox.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close(true);
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        move(1);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        move(-1);
      } else if (event.key === "Home") {
        event.preventDefault();
        activeIndex = 0;
        optionButtons[activeIndex]?.focus({ preventScroll: true });
      } else if (event.key === "End") {
        event.preventDefault();
        activeIndex = optionButtons.length - 1;
        optionButtons[activeIndex]?.focus({ preventScroll: true });
      } else if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        setSelected(activeIndex);
        close(true);
      }
    });
    listbox.addEventListener("focusin", (event) => {
      const index = optionButtons.indexOf(event.target);
      if (index >= 0) activeIndex = index;
    });
    select.addEventListener("change", () => setSelected(selectedIndex(), false));

    const api = { select, wrapper, trigger, panel, refresh, close, open: openPanel, updatePosition };
    selectInstances.set(select, api);
    refresh();
    return api;
  }

  function setupCustomSelects(root = document) {
    const selectors = [
      "select[data-animated-select]",
      "#categoryFilter",
      "#sortArticles",
      "#videoCategory",
      ".admin-enhanced-select",
      ".editor-form select",
    ].join(",");
    const instances = Array.from(root.querySelectorAll?.(selectors) || [])
      .map(createAnimatedSelect)
      .filter(Boolean);
    return instances;
  }

  function animateListUpdate(container, renderCallback) {
    if (!(container instanceof HTMLElement) || typeof renderCallback !== "function") {
      renderCallback?.();
      return Promise.resolve();
    }
    listAnimations.get(container)?.abort();
    const controller = new AbortController();
    listAnimations.set(container, controller);
    const previousHeight = container.offsetHeight;
    if (previousHeight) container.style.minHeight = `${previousHeight}px`;
    const oldItems = Array.from(container.children);
    const reduced = state.reduced;
    const entranceAnimations = [];
    const exitAnimations = oldItems.map((item) => item.animate(
      [
        { opacity: 1, transform: "translate3d(0,0,0) scale(1)" },
        { opacity: 0, transform: "translate3d(0,8px,0) scale(.985)" },
      ],
      { duration: reduced ? 1 : 100, easing: "cubic-bezier(.4,0,.2,1)", fill: "forwards" },
    ));

    controller.signal.addEventListener("abort", () => {
      exitAnimations.forEach((animation) => animation.cancel());
      entranceAnimations.forEach((animation) => animation.cancel());
    }, { once: true });

    return Promise.allSettled(exitAnimations.map((animation) => animation.finished))
      .then(() => {
        if (controller.signal.aborted) return;
        renderCallback();
        const newItems = Array.from(container.children);
        newItems.forEach((item, index) => {
          const animation = item.animate(
            [
              { opacity: 0, transform: "translate3d(0,14px,0) scale(.98)" },
              { opacity: 1, transform: "translate3d(0,0,0) scale(1)" },
            ],
            {
              duration: reduced ? 1 : 180,
              delay: reduced ? 0 : Math.min(index, 3) * 18,
              easing: "cubic-bezier(.22,1,.36,1)",
              fill: "both",
            },
          );
          entranceAnimations.push(animation);
          // Release filled keyframes so CSS hover/focus/press feedback can take over.
          animation.finished.then(() => animation.cancel(), () => {});
          item.classList.add("is-visible", "visible");
          window.MotionCore?.revealInserted?.(item);
        });
        return Promise.allSettled(entranceAnimations.map((animation) => animation.finished));
      })
      .finally(() => {
        if (listAnimations.get(container) === controller) {
          listAnimations.delete(container);
          container.style.minHeight = "";
        }
      });
  }

  // Paper-edge hover feedback is CSS-only; no per-pointer geometry reads.
  function syncAmbientState() {
    const paused = state.hidden || state.reduced || illustrationPaused || navigator.connection?.saveData ||
      document.documentElement.classList.contains('mobile-nav-open') ||
      Boolean(document.querySelector('dialog[open]'));
    if (document.documentElement.classList.contains('ink-motion-paused') !== paused) {
      document.documentElement.classList.toggle('ink-motion-paused', paused);
    }
  }

  function setupAmbientVisibility() {
    syncAmbientState();
    document.addEventListener('mobile-illustration-motion-change', event => {
      illustrationPaused = Boolean(event.detail?.paused);
      syncAmbientState();
    });
    navigator.connection?.addEventListener('change', syncAmbientState);
    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver(entries => entries.forEach(entry => {
        entry.target.classList.toggle('ink-scene-paused', !entry.isIntersecting);
      }), { threshold: 0.01 });
      document.querySelectorAll('.hero, .kurumi-page-hero').forEach(scene => observer.observe(scene));
      state.observers.add(observer);
    }
    if ('MutationObserver' in window) {
      const observer = new MutationObserver(syncAmbientState);
      observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
      observer.observe(document.body, { attributes: true, attributeFilter: ['open'], subtree: true });
      state.mutationObservers.add(observer);
    }
  }

  function cleanup() {
    state.observers.forEach((observer) => observer.disconnect());
    state.mutationObservers.forEach((observer) => observer.disconnect());
    state.observers.clear();
    revealObserver = null;
    state.mutationObservers.clear();
  }

  document.addEventListener("visibilitychange", () => {
    state.hidden = document.hidden;
    document.documentElement.classList.toggle("page-hidden", state.hidden);
    syncAmbientState();
  });

  document.addEventListener("pointerdown", (event) => {
    if (!state.openSelect) return;
    if (event.target.closest?.(".animated-select, .animated-select__panel")) return;
    state.openSelect.close();
  }, { passive: true });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") state.openSelect?.close(true);
  });

  window.addEventListener("scroll", () => state.openSelect?.updatePosition(), { passive: true });
  window.addEventListener("resize", () => state.openSelect?.updatePosition(), { passive: true });

  window.MotionCore = {
    state,
    ready: true,
    createClickEffect,
    revealInserted,
    createAnimatedSelect,
    setupCustomSelects,
    animateListUpdate,
    cleanup,
  };

  onReady(() => {
    document.documentElement.classList.add("motion-core-ready");
    setupReveal();
    setupDynamicReveal();
    setupScrollProgress();
    setupClickFeedback();
    setupInkHeadings();
    setupAmbientVisibility();
    setupCustomSelects();
  });
}());
