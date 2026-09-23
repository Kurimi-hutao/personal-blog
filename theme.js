(function () {
  const storageKey = "hutao-theme";
  const saved = localStorage.getItem(storageKey);
  const preferredDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const theme = saved || (preferredDark ? "dark" : "light");
  document.documentElement.dataset.theme = theme;

  const button = document.createElement("button");
  button.type = "button";
  button.className = "theme-toggle";
  button.setAttribute("aria-label", "切换明暗主题");

  function render() {
    const dark = document.documentElement.dataset.theme === "dark";
    button.textContent = dark ? "昼" : "夜";
    button.title = dark ? "切换为日间主题" : "切换为夜间主题";
  }

  button.addEventListener("click", () => {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    localStorage.setItem(storageKey, next);
    render();
  });

  render();
  document.body.appendChild(button);

  const warmUpFonts = () => {
    if (!document.fonts?.load) return;
    Promise.allSettled([
      document.fonts.load('16px "Blog Serif"', "桃"),
      document.fonts.load('48px "Blog Brush"', "桃"),
    ]).catch(() => {});
  };

  window.setTimeout(warmUpFonts, 1200);

  const header = document.querySelector(".site-header");
  const navigation = header?.querySelector("nav");
  let menuToggle = header?.querySelector(".menu-toggle");
  let mobileChromeController = null;

  if (header && navigation) {
    navigation.classList.add("site-nav");
    if (!navigation.id) navigation.id = "siteNav";

    if (!menuToggle) {
      menuToggle = document.createElement("button");
      menuToggle.type = "button";
      menuToggle.className = "menu-toggle";
      menuToggle.innerHTML = '<span></span><span></span><span class="sr-only">打开导航</span>';
      header.insertBefore(menuToggle, navigation);
    }

    menuToggle.setAttribute("aria-controls", navigation.id);
    menuToggle.setAttribute("aria-expanded", "false");
    if (!menuToggle.hasAttribute("aria-label")) {
      menuToggle.setAttribute("aria-label", "打开导航");
    }

    const currentPage = document.body.dataset.page;
    if (currentPage) {
      navigation.querySelectorAll("[data-nav-page]").forEach((link) => {
        link.classList.toggle("active", link.dataset.navPage === currentPage);
      });
    }

    const setMenuOpen = (open) => {
      if (open) mobileChromeController?.forceVisible();
      navigation.classList.toggle("open", open);
      menuToggle.classList.toggle("open", open);
      menuToggle.setAttribute("aria-expanded", String(open));
      document.documentElement.classList.toggle("mobile-nav-open", open);
      document.body.classList.toggle("mobile-nav-open", open);
      mobileChromeController?.reset();
    };

    menuToggle.addEventListener("click", () => setMenuOpen(!navigation.classList.contains("open")));
    navigation.addEventListener("click", (event) => {
      if (event.target.closest("a")) setMenuOpen(false);
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && navigation.classList.contains("open")) setMenuOpen(false);
    });
    window.addEventListener("resize", () => {
      if (window.innerWidth > 1080 && navigation.classList.contains("open")) setMenuOpen(false);
    }, { passive: true });
  }

  const searchButton = document.createElement("button");
  searchButton.type = "button";
  searchButton.className = "site-search-trigger";
  searchButton.setAttribute("aria-label", "搜索全站内容");
  searchButton.innerHTML = '<span aria-hidden="true">⌕</span><span>搜索</span><kbd>/</kbd>';
  if (header) {
    header.insertBefore(searchButton, navigation || null);
  }

  const searchDialog = document.createElement("dialog");
  searchDialog.className = "site-search-dialog";
  searchDialog.innerHTML = `
    <div class="site-search-shell">
      <header>
        <div><small>QUICK ACCESS</small><strong>寻卷</strong></div>
        <button type="button" data-search-close aria-label="关闭搜索">×</button>
      </header>
      <label class="site-search-field">
        <span aria-hidden="true">⌕</span>
        <input type="search" placeholder="搜索文章、视频或标签……" autocomplete="off" />
        <kbd>ESC</kbd>
      </label>
      <nav class="site-quick-links" aria-label="快捷入口">
        <a href="./index.html">首页</a>
        <a href="./articles.html">文章</a>
        <a href="./videos.html">视频</a>
        <a href="./kurumi.html">胡桃绘卷</a>
        <a href="./pet.html">桌宠小屋</a>
      </nav>
      <div class="site-search-results" aria-live="polite">
        <p>输入关键词开始搜索，也可以使用上方快捷入口。</p>
      </div>
    </div>`;
  document.body.appendChild(searchDialog);

  const searchInput = searchDialog.querySelector("input");
  const searchResults = searchDialog.querySelector(".site-search-results");
  let searchableWorks = null;
  let searchClosing = false;
  let searchResultAnimation = null;
  const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

  function workTypeLabel(work) {
    return work.content_type === "video" ? "视频" : "文章";
  }

  function renderSearchResults(query) {
    searchResultAnimation?.cancel();
    const previousItems = Array.from(searchResults.children);
    const keyword = query.trim().toLowerCase();
    const draw = () => {
      searchResults.replaceChildren();
      if (!keyword) {
      let bookmarks = [];
      try {
        bookmarks = JSON.parse(localStorage.getItem("hutao-bookmarked-articles") || "[]");
      } catch {}
      if (!bookmarks.length) {
        searchResults.innerHTML = "<p>输入关键词开始搜索，也可以使用上方快捷入口。</p>";
        return;
      }
      const heading = document.createElement("p");
      heading.className = "site-search-caption";
      heading.textContent = "最近收藏";
      searchResults.appendChild(heading);
      bookmarks.slice(0, 4).forEach((item) => {
        const link = document.createElement("a");
        link.href = `./article.html?slug=${encodeURIComponent(item.slug)}`;
        link.innerHTML = `<span>收藏</span><strong></strong><small>继续阅读 →</small>`;
        link.querySelector("strong").textContent = item.title;
        searchResults.appendChild(link);
      });
      return;
      }
      const matches = (searchableWorks || []).filter((work) => {
      const text = [work.title, work.excerpt, work.category, ...(work.tags || [])].join(" ").toLowerCase();
      return text.includes(keyword);
    }).slice(0, 8);
      if (!matches.length) {
      searchResults.innerHTML = `<p>没有找到与“${keyword.replace(/[<>&]/g, "")}”相关的内容。</p>`;
      return;
      }
      matches.forEach((work) => {
      const link = document.createElement("a");
      link.href = window.articleService?.articleUrl(work) || `./article.html?slug=${encodeURIComponent(work.slug)}`;
      link.innerHTML = `<span></span><strong></strong><small></small>`;
      link.querySelector("span").textContent = workTypeLabel(work);
      link.querySelector("strong").textContent = work.title;
      link.querySelector("small").textContent = work.category || "随笔";
      searchResults.appendChild(link);
      });
    };

    const reduced = reducedMotionQuery.matches;
    if (!previousItems.length || reduced) {
      draw();
    } else {
      searchResultAnimation = searchResults.animate(
        [{ opacity: 1 }, { opacity: 0 }],
        { duration: 90, easing: "ease-out", fill: "forwards" },
      );
      searchResultAnimation.onfinish = () => {
        draw();
        // The outgoing animation belongs to the parent; release its opacity
        // before animating the newly inserted children.
        searchResultAnimation.cancel();
        searchResultAnimation = null;
        Array.from(searchResults.children).forEach((item, index) => {
          item.animate(
            [
              { opacity: 0, transform: "translate3d(0,8px,0)" },
              { opacity: 1, transform: "translate3d(0,0,0)" },
            ],
            { duration: 170, delay: Math.min(index, 6) * 34, easing: "cubic-bezier(.22,1,.36,1)", fill: "both" },
          );
        });
      };
    }
  }

  async function openSearch() {
    if (searchClosing) return;
    mobileChromeController?.forceVisible();
    if (!searchDialog.open) searchDialog.showModal();
    searchDialog.classList.remove("is-closing");
    searchDialog.classList.add("is-opening");
    document.documentElement.classList.add("search-dialog-open");
    document.body.classList.add("search-dialog-open");
    searchInput.value = "";
    renderSearchResults("");
    window.setTimeout(() => {
      searchDialog.classList.remove("is-opening");
      searchInput.focus({ preventScroll: true });
    }, reducedMotionQuery.matches ? 0 : 230);
    if (searchableWorks === null && window.articleService?.configured) {
      searchResults.innerHTML = "<p>正在整理全站内容……</p>";
      try {
        searchableWorks = await window.articleService.listPublished();
      } catch {
        searchableWorks = [];
      }
      renderSearchResults(searchInput.value);
    }
  }

  function closeSearchAnimated() {
    if (!searchDialog.open || searchClosing) return;
    searchClosing = true;
    searchDialog.classList.remove("is-opening");
    searchDialog.classList.add("is-closing");
    window.setTimeout(() => {
      searchDialog.close();
      searchClosing = false;
      searchDialog.classList.remove("is-closing");
    }, reducedMotionQuery.matches ? 1 : 170);
  }

  searchButton.addEventListener("click", openSearch);
  searchDialog.querySelector("[data-search-close]").addEventListener("click", closeSearchAnimated);
  searchDialog.addEventListener("close", () => {
    document.documentElement.classList.remove("search-dialog-open");
    document.body.classList.remove("search-dialog-open");
    mobileChromeController?.forceVisible();
    mobileChromeController?.reset();
  });
  searchDialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    closeSearchAnimated();
  });
  searchDialog.addEventListener("click", (event) => {
    if (event.target === searchDialog) closeSearchAnimated();
  });
  searchResults.addEventListener("click", (event) => {
    if (event.target.closest("a")) closeSearchAnimated();
  });
  searchInput.addEventListener("input", () => renderSearchResults(searchInput.value));
  window.addEventListener("keydown", (event) => {
    const editing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || "");
    if (event.key === "/" && !editing && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      openSearch();
    }
  });

  const backToTop = document.createElement("button");
  backToTop.type = "button";
  backToTop.className = "back-to-top";
  backToTop.setAttribute("aria-label", "返回顶部");
  backToTop.textContent = "↑";
  document.body.appendChild(backToTop);
  backToTop.addEventListener("click", () => window.scrollTo({ top: 0, behavior: reducedMotion ? "auto" : "smooth" }));
  let backToTopFrame = 0;
  const updateBackToTop = () => {
    backToTopFrame = 0;
    backToTop.classList.toggle("visible", Math.max(0, window.scrollY) > 650);
  };
  const requestBackToTopUpdate = () => {
    if (backToTopFrame) return;
    backToTopFrame = window.requestAnimationFrame(updateBackToTop);
  };
  window.addEventListener("scroll", requestBackToTopUpdate, { passive: true });
  updateBackToTop();

  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  let reducedMotion = reducedMotionQuery.matches;
  reducedMotionQuery.addEventListener("change", (event) => {
    reducedMotion = event.matches;
    document.documentElement.classList.toggle("cursor-ready", finePointer && !reducedMotion);
    document.querySelectorAll(".ink-cursor-trail").forEach((trail) => {
      trail.getAnimations().forEach((animation) => animation.cancel());
      trail.remove();
    });
  });

  function setupMobileScrollChrome() {
    const mobileQuery = window.matchMedia("(max-width: 900px)");
    let lastScrollY = clampScrollY();
    let accumulatedDelta = 0;
    let scrollFrame = 0;
    let chromeVisible = true;

    const setVisible = (visible) => {
      chromeVisible = visible;
      document.body.classList.toggle("mobile-chrome-visible", visible);
      document.body.classList.toggle("mobile-chrome-hidden", !visible);
    };

    const hasOpenMobileOverlay = () => (
      document.documentElement.classList.contains("mobile-nav-open") ||
      document.body.classList.contains("mobile-nav-open") ||
      document.documentElement.classList.contains("search-dialog-open") ||
      document.body.classList.contains("search-dialog-open") ||
      Boolean(document.querySelector("dialog[open]")) ||
      /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || "")
    );

    function clampScrollY() {
      const maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
      return Math.max(0, Math.min(window.scrollY || 0, maxScroll));
    }

    const reset = (show = false) => {
      lastScrollY = clampScrollY();
      accumulatedDelta = 0;
      if (!mobileQuery.matches) {
        setVisible(true);
        return;
      }
      if (show || lastScrollY <= 24 || hasOpenMobileOverlay()) setVisible(true);
    };

    const update = () => {
      scrollFrame = 0;

      if (!mobileQuery.matches) {
        reset();
        return;
      }

      const currentY = clampScrollY();
      const delta = currentY - lastScrollY;

      if (currentY <= 24 || hasOpenMobileOverlay()) {
        setVisible(true);
        accumulatedDelta = 0;
        lastScrollY = currentY;
        return;
      }

      if (Math.abs(delta) < 2) {
        lastScrollY = currentY;
        return;
      }

      const sameDirection = accumulatedDelta === 0 || Math.sign(accumulatedDelta) === Math.sign(delta);
      accumulatedDelta = sameDirection ? accumulatedDelta + delta : delta;

      if (accumulatedDelta > 14 && currentY > 90 && chromeVisible) {
        setVisible(false);
        accumulatedDelta = 0;
      } else if (accumulatedDelta < -10 && !chromeVisible) {
        setVisible(true);
        accumulatedDelta = 0;
      }

      lastScrollY = currentY;
    };

    const requestUpdate = () => {
      if (scrollFrame) return;
      scrollFrame = window.requestAnimationFrame(update);
    };

    const forceVisible = () => {
      setVisible(true);
      reset();
    };

    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", () => reset(true), { passive: true });
    window.addEventListener("orientationchange", () => reset(true), { passive: true });
    window.addEventListener("pageshow", () => reset(true), { passive: true });
    document.addEventListener("focusin", (event) => {
      if (event.target.closest?.("input, textarea, select")) forceVisible();
    });
    document.addEventListener("focusout", () => reset(true));

    mobileQuery.addEventListener?.("change", () => reset(true));
    reset(true);

    return { forceVisible, reset: () => reset(true), requestUpdate };
  }

  function setupMobileControlDock({ themeToggle, windToggle, backToTop }) {
    let dock = document.querySelector(".mobile-control-dock");

    if (!dock) {
      dock = document.createElement("div");
      dock.className = "mobile-control-dock";
      dock.setAttribute("aria-label", "页面快捷操作");
      document.body.appendChild(dock);
    }

    [backToTop, windToggle, themeToggle].filter(Boolean).forEach((control) => {
      dock.appendChild(control);
    });

    return dock;
  }

  function setupFloatingControls() {
    const windToggle = document.querySelector(".wind-toggle");
    const leftControls = [button].filter(Boolean);
    const rightControls = [windToggle, backToTop].filter(Boolean);
    if (!leftControls.length && !rightControls.length) return;

    document.body.classList.add("floating-controls-ready");

    if (!finePointer) {
      document.body.classList.remove("floating-left-open", "floating-right-open", "floating-controls-awake");
      if (!window.matchMedia("(max-width: 900px)").matches) {
        document.body.classList.add("floating-left-open", "floating-right-open");
      }
      return;
    }

    let frame = 0;
    let lastX = window.innerWidth / 2;
    let hideTimer = 0;
    let holdTimer = 0;

    const setSide = (side, visible) => {
      document.body.classList.toggle(`floating-${side}-open`, visible);
    };

    const scheduleHide = () => {
      window.clearTimeout(hideTimer);
      hideTimer = window.setTimeout(() => {
        if (Date.now() < holdTimer) {
          scheduleHide();
          return;
        }
        if (document.querySelector(".theme-toggle:hover, .wind-toggle:hover, .back-to-top:hover, .theme-toggle:focus-visible, .wind-toggle:focus-visible, .back-to-top:focus-visible")) return;
        setSide("left", false);
        setSide("right", false);
      }, 1200);
    };

    const updateFromPointer = () => {
      frame = 0;
      const edge = Math.min(90, Math.max(72, window.innerWidth * 0.06));
      if (lastX <= edge) setSide("left", true);
      if (lastX >= window.innerWidth - edge) setSide("right", true);
      scheduleHide();
    };

    window.addEventListener("pointermove", (event) => {
      lastX = event.clientX;
      if (!frame) frame = window.requestAnimationFrame(updateFromPointer);
    }, { passive: true });

    [...leftControls, ...rightControls].forEach((control) => {
      control.addEventListener("pointerenter", () => {
        if (leftControls.includes(control)) setSide("left", true);
        if (rightControls.includes(control)) setSide("right", true);
        window.clearTimeout(hideTimer);
      });
      control.addEventListener("pointerleave", scheduleHide);
      control.addEventListener("focus", () => {
        if (leftControls.includes(control)) setSide("left", true);
        if (rightControls.includes(control)) setSide("right", true);
      });
      control.addEventListener("blur", scheduleHide);
      control.addEventListener("click", () => {
        holdTimer = Date.now() + 1600;
        scheduleHide();
      });
    });
  }

  mobileChromeController = setupMobileScrollChrome();
  setupMobileControlDock({
    themeToggle: button,
    windToggle: document.querySelector(".wind-toggle"),
    backToTop,
  });
  setupFloatingControls();

  if (finePointer && !document.querySelector(".ink-cursor")) {
    const cursor = document.createElement("div");
    cursor.className = "ink-cursor";
    cursor.setAttribute("aria-hidden", "true");
    cursor.innerHTML = '<span class="ink-cursor-ring"></span><span class="ink-cursor-dot"></span>';
    document.body.appendChild(cursor);
    document.documentElement.classList.toggle("cursor-ready", !reducedMotion);

    let trailAt = 0;

    window.addEventListener("pointermove", (event) => {
      if (reducedMotion) return;
      cursor.style.transform = `translate3d(${event.clientX}px, ${event.clientY}px, 0)`;
      cursor.style.opacity = "1";

      const now = performance.now();
      if (now - trailAt < 42 || window.innerWidth <= 840) return;
      trailAt = now;

      const trail = document.createElement("i");
      trail.className = "ink-cursor-trail";
      trail.style.transform = `translate3d(${event.clientX}px, ${event.clientY}px, 0) translate(-50%, -50%)`;
      document.body.appendChild(trail);
      trail.animate(
        [
          { opacity: 0.4, transform: trail.style.transform },
          {
            opacity: 0,
            transform: `translate3d(${event.clientX - 9}px, ${event.clientY + 8}px, 0) translate(-50%, -50%) scale(.2)`,
          },
        ],
        { duration: 580, easing: "ease-out" },
      ).onfinish = () => trail.remove();
    });

    document.addEventListener("pointerover", (event) => {
      cursor.classList.toggle(
        "is-interactive",
        Boolean(event.target.closest("a, button, input, textarea, select")),
      );
    });

    document.documentElement.addEventListener("mouseleave", () => {
      cursor.style.opacity = "0";
    });
    document.documentElement.addEventListener("mouseenter", () => {
      cursor.style.opacity = "1";
    });

  }

  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    navigator.serviceWorker.register("./service-worker.js", { updateViaCache: "none" }).catch(() => {});
  }
})();
