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

  reduceQuery.addEventListener("change", (event) => {
    state.reduced = event.matches;
    if (!state.reduced) return;
    document.querySelectorAll(".motion-reveal").forEach((element) => {
      element.classList.add("is-visible", "visible");
      element.getAnimations().forEach((animation) => {
        if (animation.effect?.getTiming().iterations !== Infinity) animation.finish();
      });
    });
    document.querySelectorAll(".click-petal, .ink-click-core, .ink-click-ripple").forEach((element) => element.remove());
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

  function setupReveal(root = document) {
    const elements = Array.from(root.querySelectorAll?.(revealSelector) || []);
    elements.forEach(addReveal);

    if (state.reduced || !("IntersectionObserver" in window)) {
      elements.forEach((element) => element.classList.add("is-visible", "visible"));
      return null;
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible", "visible");
        observer.unobserve(entry.target);
      });
    }, { rootMargin: "0px 0px -9% 0px", threshold: 0.08 });

    elements.forEach((element) => observer.observe(element));
    state.observers.add(observer);
    return observer;
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
      if (state.reduced) element.classList.add("is-visible", "visible");
    });

    if (!state.reduced) {
      const observer = [...state.observers].at(-1);
      if (observer) candidates.forEach((element) => observer.observe(element));
    }
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
    if (typeof x !== "number" || typeof y !== "number") return;
    const target = source instanceof Element ? source : null;
    if (target?.closest(".click-petal, .falling-piece, input, textarea, select, option, video, audio, iframe, canvas, [contenteditable='true']")) return;

    const interactive = Boolean(target?.closest("button, a, summary, [role='button'], .ink-button, .text-button, .seal-button"));
    const duration = state.reduced ? 180 : interactive ? 340 : state.coarse ? 360 : 430;
    const size = state.reduced ? 34 : interactive ? 46 : state.coarse ? 68 : 96;
    const root = document.createDocumentFragment();

    const ripple = document.createElement("i");
    ripple.className = "ink-click-ripple";
    ripple.style.setProperty("--click-x", `${x}px`);
    ripple.style.setProperty("--click-y", `${y}px`);
    ripple.style.setProperty("--click-size", `${size}px`);
    ripple.style.setProperty("--click-duration", `${duration}ms`);
    root.appendChild(ripple);

    if (!state.reduced) {
      const core = document.createElement("i");
      core.className = "ink-click-core";
      core.style.setProperty("--click-x", `${x}px`);
      core.style.setProperty("--click-y", `${y}px`);
      core.style.setProperty("--click-duration", `${duration - 30}ms`);
      root.appendChild(core);
    }

    const count = state.reduced ? 0 : interactive ? 1 : state.coarse ? 1 : 3;
    for (let index = 0; index < count; index += 1) {
      const petal = document.createElement("i");
      petal.className = "click-petal";
      petal.style.setProperty("--click-x", `${x}px`);
      petal.style.setProperty("--click-y", `${y}px`);
      petal.style.setProperty("--click-duration", `${duration + 20}ms`);
      petal.style.setProperty("--petal-x", `${(Math.random() - 0.5) * (interactive ? 24 : 48)}px`);
      petal.style.setProperty("--petal-y", `${-8 - Math.random() * (interactive ? 14 : 28)}px`);
      petal.style.setProperty("--petal-r", `${Math.random() * 140 - 70}deg`);
      root.appendChild(petal);
    }

    const nodes = Array.from(root.children);
    document.body.appendChild(root);
    window.setTimeout(() => nodes.forEach((node) => node.remove()), duration + 80);
  }

  function setupClickFeedback() {
    window.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      createClickEffect(event.clientX, event.clientY, event.target);
    }, { passive: true });

    document.addEventListener("pointerdown", (event) => {
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
    document.addEventListener("keyup", (event) => {
      if (event.key === "Enter" || event.key === " ") release();
    });
    document.addEventListener("keydown", (event) => {
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
      window.setTimeout(() => optionButtons[activeIndex]?.focus({ preventScroll: true }), state.reduced ? 0 : 40);
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
    const exitAnimations = oldItems.map((item) => item.animate(
      [
        { opacity: 1, transform: "translate3d(0,0,0) scale(1)" },
        { opacity: 0, transform: "translate3d(0,8px,0) scale(.985)" },
      ],
      { duration: reduced ? 1 : 140, easing: "cubic-bezier(.4,0,.2,1)", fill: "forwards" },
    ));

    controller.signal.addEventListener("abort", () => {
      exitAnimations.forEach((animation) => animation.cancel());
    }, { once: true });

    return Promise.allSettled(exitAnimations.map((animation) => animation.finished))
      .then(() => {
        if (controller.signal.aborted) return;
        renderCallback();
        const newItems = Array.from(container.children);
        newItems.forEach((item, index) => {
          item.animate(
            [
              { opacity: 0, transform: "translate3d(0,14px,0) scale(.98)" },
              { opacity: 1, transform: "translate3d(0,0,0) scale(1)" },
            ],
            {
              duration: reduced ? 1 : 220,
              delay: reduced ? 0 : Math.min(index, 8) * 42,
              easing: "cubic-bezier(.22,1,.36,1)",
              fill: "both",
            },
          );
          window.MotionCore?.revealInserted?.(item);
        });
      })
      .finally(() => {
        if (listAnimations.get(container) === controller) {
          listAnimations.delete(container);
          window.setTimeout(() => { container.style.minHeight = ""; }, reduced ? 0 : 260);
        }
      });
  }

  function setupCardHover() {
    if (!state.fine) return;
    const selector = ".article-card, .article-list-card, .video-card, .home-video-card, .friend-card, .portal-card, .achievement-cards article";
    document.addEventListener("pointermove", (event) => {
      const card = event.target.closest?.(selector);
      if (!card) return;
      const rect = card.getBoundingClientRect();
      card.style.setProperty("--motion-ink-x", `${event.clientX - rect.left}px`);
      card.style.setProperty("--motion-ink-y", `${event.clientY - rect.top}px`);
    }, { passive: true });
  }

  function cleanup() {
    state.observers.forEach((observer) => observer.disconnect());
    state.mutationObservers.forEach((observer) => observer.disconnect());
    state.observers.clear();
    state.mutationObservers.clear();
  }

  document.addEventListener("visibilitychange", () => {
    state.hidden = document.hidden;
    document.documentElement.classList.toggle("page-hidden", state.hidden);
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
    setupCardHover();
    setupCustomSelects();
  });
}());
