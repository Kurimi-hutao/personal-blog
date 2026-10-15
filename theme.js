(function () {
  const scriptBase = new URL('.', document.currentScript.src);
  const searchModules = new Map();
  function loadSearchModule(path) {
    if (!searchModules.has(path)) {
      searchModules.set(path, new Promise((resolve, reject) => {
        const script = document.createElement('script'); script.src = new URL(path, scriptBase).href;
        script.onload = resolve;
        script.onerror = () => { searchModules.delete(path); script.remove(); reject(new Error('搜索模块未能加载')); };
        document.head.append(script);
      }));
    }
    return searchModules.get(path);
  }
  async function searchPublishedContent() {
    if (!window.articleService) {
      if (!window.supabase) await loadSearchModule('./assets/vendor/supabase/supabase-2.108.2.js');
      if (!window.BLOG_CONFIG) await loadSearchModule('./supabase-config.js');
      await loadSearchModule('./article-service.js?v=20261010-p1');
    }
    if (!window.articleService?.configured) throw new Error('内容服务暂不可用');
    return window.articleService.listPublished();
  }
  const storageKey = "hutao-theme";
  const saved = localStorage.getItem(storageKey);
  const theme = saved === "dark" ? "dark" : "light";
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
      document.fonts.load('48px "Blog Brush"', "桃"),
    ]).catch(() => {});
  };

  // The loading seal owns font readiness on pages using InkLottie.
  if (!window.InkLottie) warmUpFonts();

  const header = document.querySelector(".site-header");
  const navigation = header?.querySelector("nav");
  let menuToggle = header?.querySelector(".menu-toggle");
  let mobileChromeController = null;
  let closeMobileNavigation = () => {};

  if (header && navigation) {
    const menuHeading = document.createElement('div'); menuHeading.className = 'mobile-nav-heading';
    menuHeading.innerHTML = '<small>此间目录</small>';
    navigation.prepend(menuHeading);
    const menuDismiss = document.createElement('button'); menuDismiss.type = 'button'; menuDismiss.className = 'mobile-nav-dismiss';
    menuDismiss.textContent = '收起导航 ×'; navigation.append(menuDismiss);
    const primary = document.createElement('div'); primary.className = 'nav-primary';
    const secondary = document.createElement('div'); secondary.className = 'nav-secondary';
    const mainPages = ['articles', 'works', 'videos'];
    mainPages.forEach((page, i) => {
      const link = navigation.querySelector(`[data-nav-page="${page}"]`);
      if (!link) return;
      link.dataset.index = `0${i + 1}`;
      link.dataset.description = ['随笔与记录', '所做与所爱', '流动的片刻'][i];
      primary.append(link);
    });
    navigation.querySelectorAll(':scope > a').forEach(link => secondary.append(link));
    navigation.append(primary, secondary);
    const inertBeforeMenu = new Map();
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

    const currentPage = document.body.dataset.navParent || document.body.dataset.page;
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
      menuToggle.setAttribute("aria-label", open ? "关闭导航" : "打开导航");
      const menuLabel = menuToggle.querySelector(".sr-only");
      if (menuLabel) menuLabel.textContent = open ? "关闭导航" : "打开导航";
      document.documentElement.classList.toggle("mobile-nav-open", open);
      document.body.classList.toggle("mobile-nav-open", open);
      if (open) {
        document.querySelectorAll('main, body > footer, .mobile-control-dock, .reading-toc-trigger, .mobile-reading-bar, .site-header .brand').forEach(element => {
          if (!inertBeforeMenu.has(element)) inertBeforeMenu.set(element, element.inert);
          element.inert = true;
        });
      } else {
        inertBeforeMenu.forEach((inert, element) => { element.inert = inert; });
        inertBeforeMenu.clear();
      }
      mobileChromeController?.reset();
    };
    closeMobileNavigation = () => setMenuOpen(false);
    menuDismiss.onclick = () => { setMenuOpen(false); menuToggle.focus({ preventScroll: true }); };

    menuToggle.addEventListener("click", () => setMenuOpen(!navigation.classList.contains("open")));
    navigation.addEventListener("click", (event) => {
      if (event.target.closest("a") || event.target === navigation) setMenuOpen(false);
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && navigation.classList.contains("open")) setMenuOpen(false);
      if (event.key === 'Tab' && navigation.classList.contains('open')) {
        const targets = [menuToggle, header.querySelector('.site-search-trigger'), ...navigation.querySelectorAll('a, button')].filter((element, i, all) => element && all.indexOf(element) === i && element.getClientRects().length && !element.inert);
        const current = targets.indexOf(document.activeElement);
        const next = (current + (event.shiftKey ? -1 : 1) + targets.length) % targets.length;
        event.preventDefault(); targets[next].focus({ preventScroll: true }); targets[next].scrollIntoView({ block: 'nearest' });
      }
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
        <input type="search" placeholder="搜索文章、视频、作品或标签……" autocomplete="off" />
        <kbd>ESC</kbd>
      </label>
      <nav class="site-quick-links" aria-label="快捷入口">
        <a href="./index.html">首页</a>
        <a href="./articles.html">文章</a>
        <a href="./videos.html">视频</a>
        <a href="./works.html">作品</a>
        <a href="./kurumi.html">胡桃绘卷</a>
        <button type="button" data-search-bookmarks aria-pressed="false">我的收藏</button>
      </nav>
      <div class="search-type-filters" role="group" aria-label="搜索内容类型">
        <button type="button" data-search-type="all" aria-pressed="true">全部</button>
        <button type="button" data-search-type="article" aria-pressed="false">文章</button>
        <button type="button" data-search-type="video" aria-pressed="false">视频</button>
        <button type="button" data-search-type="work" aria-pressed="false">作品</button>
      </div>
      <div class="search-status" role="status" hidden></div>
      <div class="site-search-results" aria-live="polite">
        <p>输入关键词开始搜索，也可以使用上方快捷入口。</p>
      </div>
    </div>`;
  document.body.appendChild(searchDialog);

  const searchInput = searchDialog.querySelector("input");
  const searchResults = searchDialog.querySelector(".site-search-results");
  let searchableWorks = null;
  let searchType = 'all';
  let searchLimit = 8;
  let searchPending = false;
  const searchStatus = searchDialog.querySelector('.search-status');
  const typeFilters = searchDialog.querySelector('.search-type-filters');
  typeFilters.addEventListener('click', event => {
    const button = event.target.closest('[data-search-type]');
    if (!button) return;
    searchType = button.dataset.searchType; searchLimit = 8;
    typeFilters.querySelectorAll('button').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
    renderSearchResults(searchInput.value);
  });
  function localWorks() {
    return (window.HutaoWorksData?.works || []).map(work => ({ ...work, content_type: 'work', excerpt: work.description, tags: work.tech, searchUrl: work.demo }));
  }
  function updateSearchStatus(text, retry = false) {
    searchStatus.replaceChildren(); searchStatus.hidden = !text;
    const copy = document.createElement('span'); copy.textContent = text; searchStatus.append(copy);
    if (retry) {
      const button = document.createElement('button'); button.type = 'button'; button.textContent = '重新读取';
      button.onclick = () => loadSearchContent(); searchStatus.append(button);
    }
  }
  async function loadSearchContent() {
    if (searchPending) return;
    searchPending = true;
    updateSearchStatus('正在更新文章与视频，作品可以先行搜索……');
    let timer;
    try {
      searchableWorks = await Promise.race([
        searchPublishedContent(),
        new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('timeout')), 7000); }),
      ]);
      window.ContentCache?.write('search', searchableWorks);
      updateSearchStatus('');
    } catch {
      const cached = window.ContentCache?.read('search');
      searchableWorks = cached?.items || null;
      updateSearchStatus(cached ? '连接暂时受阻，文章与视频显示上次保存的内容。' : '文章与视频暂时无法读取，仍可搜索站内作品。', true);
    } finally {
      clearTimeout(timer); searchPending = false;
      if (searchDialog.open) renderSearchResults(searchInput.value);
    }
  }
  let searchClosing = false;
  let searchResultAnimation = null;
  let bookmarksMode = false;
  const bookmarksButton = searchDialog.querySelector('[data-search-bookmarks]');

  function showBookmarks() {
    bookmarksMode = true;
    bookmarksButton.setAttribute('aria-pressed', 'true');
    searchInput.placeholder = '搜索已收藏的标题、分类或标签……';
    renderSearchResults(searchInput.value);
  }
  document.querySelector('#homeBookmarks')?.addEventListener('click', () => {
    void openSearch(); showBookmarks();
  });
  function renderReadingReturn() {
    const list = document.querySelector('#readingReturnList');
    if (!list) return;
    list.replaceChildren();
    let positions = {}, bookmarks = [];
    try { positions = JSON.parse(localStorage.getItem('hutao-reading-positions') || '{}'); } catch {}
    try { bookmarks = JSON.parse(localStorage.getItem('hutao-bookmarked-articles') || '[]'); } catch {}
    const known = [...bookmarks, ...(window.ContentCache?.read('search')?.items || []), ...(window.ContentCache?.read('articles')?.items || [])];
    const entries = Object.entries(positions).filter(([, item]) => item && item.ratio > .03 && item.ratio < .98)
      .sort((a, b) => b[1].updatedAt - a[1].updatedAt);
    for (const [id, item] of entries) {
      const slug = item.slug || known.find(work => work.id === id)?.slug;
      if (!slug) continue;
      const link = document.createElement('a');
      link.href = `./article.html?slug=${encodeURIComponent(slug)}`;
      const title = document.createElement('strong'); title.textContent = item.title || '继续阅读';
      const progress = document.createElement('span'); progress.textContent = `上次读到 ${Math.round(item.ratio * 100)}% · 继续阅读 →`;
      link.append(title, progress); list.append(link);
      if (list.children.length === 3) break;
    }
    list.closest('.reading-return')?.classList.toggle('has-reading-history', Boolean(list.children.length));
    if (!list.children.length) {
      const link = document.createElement('a'); link.href = './articles.html';
      link.textContent = '翻开一篇文章，下次回来可从这里接着读 →'; list.append(link);
    }
  }
  renderReadingReturn();
  window.addEventListener('pageshow', renderReadingReturn);
  window.addEventListener('storage', renderReadingReturn);
  bookmarksButton.addEventListener('click', () => {
    bookmarksMode = !bookmarksMode;
    bookmarksButton.setAttribute('aria-pressed', String(bookmarksMode));
    searchInput.placeholder = bookmarksMode ? '搜索已收藏的标题、分类或标签……' : '搜索文章、视频、作品或标签……';
    renderSearchResults(searchInput.value);
  });
  const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

  function workTypeLabel(work) {
    return work.content_type === "work" ? "作品" : work.content_type === "video" ? "视频" : "文章";
  }

  function renderSearchResults(query) {
    searchResultAnimation?.cancel();
    const previousItems = Array.from(searchResults.children);
    const keyword = query.trim().toLowerCase();
    const draw = () => {
      typeFilters.hidden = bookmarksMode;
      searchResults.replaceChildren();
      if (bookmarksMode) {
        let bookmarks = [];
        try { bookmarks = JSON.parse(localStorage.getItem('hutao-bookmarked-articles') || '[]'); } catch {}
        const matches = bookmarks.filter(item => [item.title, item.category, ...(item.tags || [])].join(' ').toLowerCase().includes(keyword));
        const caption = document.createElement('p'); caption.className = 'site-search-caption';
        caption.textContent = `我的收藏 · ${matches.length} / ${bookmarks.length} 篇（当前浏览器）`;
        searchResults.append(caption);
        if (!matches.length) {
          const empty = document.createElement('p'); empty.textContent = keyword ? '没有匹配的收藏，试试其他关键词。' : '还没有收藏，阅读时点击“收藏此卷”即可加入。'; searchResults.append(empty);
        }
        matches.forEach(item => {
          const row = document.createElement('div'); row.className = 'bookmark-row';
          const link = document.createElement('a'); link.href = `./article.html?slug=${encodeURIComponent(item.slug)}`;
          const title = document.createElement('strong'); title.textContent = item.title; link.append(title);
          const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = '移除'; remove.setAttribute('aria-label', `移除收藏：${item.title}`);
          remove.onclick = () => {
            try { localStorage.setItem('hutao-bookmarked-articles', JSON.stringify(bookmarks.filter(saved => saved.id !== item.id))); } catch {}
            window.dispatchEvent(new Event('bookmarkschange')); renderSearchResults(searchInput.value);
          };
          row.append(link, remove); searchResults.append(row);
        });
        return;
      }
      if (!keyword) {
      let bookmarks = [];
      try {
        bookmarks = JSON.parse(localStorage.getItem("hutao-bookmarked-articles") || "[]");
      } catch {}
      if (!bookmarks.length) {
        window.InkAssets?.state(searchResults, { title: '翻开一卷江湖', detail: '输入关键词开始搜索，也可以使用上方快捷入口。' });
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
      const all = document.createElement('button'); all.type = 'button'; all.className = 'bookmark-all'; all.textContent = `查看全部收藏（${bookmarks.length}）`;
      all.onclick = showBookmarks; searchResults.append(all);
      return;
      }
      const allMatches = [...localWorks(), ...(searchableWorks || [])].filter(work => {
        const text = [work.title, work.excerpt, work.category, ...(work.tags || [])].join(' ').toLowerCase();
        return (searchType === 'all' || (work.content_type || 'article') === searchType) && text.includes(keyword);
      });
      const matches = allMatches.slice(0, searchLimit);
      const count = document.createElement('p'); count.className = 'site-search-caption';
      count.textContent = `找到 ${allMatches.length} 项内容`; searchResults.append(count);
      if (!matches.length) {
      window.InkAssets?.state(searchResults, { title: '未寻得合卷内容', detail: `没有找到与“${keyword}”相关的内容，换个关键词试试。` });
      return;
      }
      matches.forEach((work) => {
      const link = document.createElement("a");
      link.href = work.searchUrl || window.articleService?.articleUrl(work) || `./article.html?slug=${encodeURIComponent(work.slug)}`;
      link.innerHTML = `<span></span><strong></strong><small></small>`;
      link.querySelector("span").textContent = workTypeLabel(work);
      link.querySelector("strong").textContent = work.title;
      link.querySelector("small").textContent = work.category || "随笔";
      searchResults.appendChild(link);
      });
      if (allMatches.length > searchLimit) {
        const more = document.createElement('button'); more.type = 'button'; more.className = 'search-more';
        more.textContent = `查看全部结果（${allMatches.length}）`;
        more.onclick = () => { searchLimit = allMatches.length; renderSearchResults(searchInput.value); };
        searchResults.append(more);
      }
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
    closeMobileNavigation();
    mobileChromeController?.forceVisible();
    if (!searchDialog.open) searchDialog.showModal();
    searchDialog.classList.remove("is-closing");
    searchDialog.classList.add("is-opening");
    document.documentElement.classList.add("search-dialog-open");
    document.body.classList.add("search-dialog-open");
    searchInput.value = "";
    bookmarksMode = false;
    bookmarksButton.setAttribute('aria-pressed', 'false');
    searchInput.placeholder = '搜索文章、视频、作品或标签……';
    renderSearchResults("");
    window.setTimeout(() => {
      searchDialog.classList.remove("is-opening");
      searchInput.focus({ preventScroll: true });
    }, reducedMotionQuery.matches ? 0 : 230);
    searchLimit = 8;
    if (searchableWorks === null) {
      searchableWorks = window.ContentCache?.read('search')?.items || null;
      void loadSearchContent();
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
  searchInput.addEventListener("input", () => { searchLimit = 8; renderSearchResults(searchInput.value); });
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
  if (navigation) {
    const utilities = document.createElement('div'); utilities.className = 'nav-utilities';
    const savedButton = document.createElement('button'); savedButton.type = 'button'; savedButton.textContent = '收藏';
    savedButton.onclick = () => { closeMobileNavigation(); void openSearch(); showBookmarks(); };
    utilities.append(savedButton);
    const petals = document.querySelector('#summonPetals');
    if (petals) {
      const summon = document.createElement('button'); summon.type = 'button'; summon.textContent = '唤桃花'; summon.className = 'nav-summon-petals';
      summon.onclick = () => { closeMobileNavigation(); petals.click(); }; utilities.append(summon);
    }
    navigation.append(utilities);
    const layout = matchMedia('(max-width:1080px)');
    const placeUtilities = () => {
      if (layout.matches) utilities.prepend(searchButton, button);
      else { header.insertBefore(searchButton, menuToggle); document.querySelector('.mobile-control-dock')?.append(button); }
    };
    layout.addEventListener('change', placeUtilities); placeUtilities();
    const topLink = document.createElement('button'); topLink.type = 'button'; topLink.className = 'mobile-scroll-top'; topLink.textContent = '回到卷首 ↑';
    topLink.onclick = () => backToTop.click(); document.querySelector('body > footer')?.append(topLink);
  }

  // Keep dialogs inside the visual viewport when a phone keyboard is open.
  let viewportFrame = 0;
  const updateVisualViewport = () => {
    viewportFrame = 0;
    const viewport = window.visualViewport;
    const height = viewport?.height || innerHeight;
    document.documentElement.style.setProperty('--visual-viewport-height', `${height}px`);
    document.documentElement.style.setProperty('--visual-viewport-top', `${viewport?.offsetTop || 0}px`);
    const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '');
    document.body.classList.toggle('mobile-keyboard-open', typing && (height < innerHeight * .8 || height < 520));
  };
  const requestViewportUpdate = () => {
    if (!viewportFrame) viewportFrame = requestAnimationFrame(updateVisualViewport);
  };
  window.visualViewport?.addEventListener('resize', requestViewportUpdate, { passive: true });
  window.visualViewport?.addEventListener('scroll', requestViewportUpdate, { passive: true });
  window.addEventListener('resize', requestViewportUpdate, { passive: true });
  document.addEventListener('focusin', requestViewportUpdate);
  document.addEventListener('focusout', requestViewportUpdate);
  updateVisualViewport();

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
