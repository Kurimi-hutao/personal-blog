let currentArticle = null;
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function setMeta(name, content, property = false) {
  let element = document.head.querySelector(`meta[${property ? "property" : "name"}="${name}"]`);
  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(property ? "property" : "name", name);
    document.head.appendChild(element);
  }
  element.content = content;
}

function renderArticle(article) {
  const root = document.querySelector("#articleDetail");
  root.replaceChildren();
  const header = document.createElement("header");
  header.className = "article-detail-header";
  header.innerHTML = `
    <p class="eyebrow"></p>
    <h1></h1>
    <div class="article-detail-meta">
      <time datetime="${article.published_at}">${articleService.formatDate(article.published_at)}</time>
      <span></span>
    </div>
    <p class="article-detail-excerpt"></p>`;
  header.querySelector(".eyebrow").textContent = article.category || "Jianghu Notes";
  header.querySelector("h1").textContent = article.title;
  header.querySelector(".article-detail-meta span").textContent = (article.tags || [])
    .map((tag) => `#${tag}`)
    .join(" ");
  const readingMeta = document.createElement("span");
  const plainText = (article.content || article.excerpt || "").replace(/[#*_>`~\[\]()!-]/g, " ");
  const characterCount = plainText.replace(/\s/g, "").length;
  readingMeta.textContent = article.content_type === "video"
    ? "视频作品"
    : `约 ${Math.max(1, Math.ceil(characterCount / 420))} 分钟阅读`;
  header.querySelector(".article-detail-meta").appendChild(readingMeta);
  if (article.content_type === "video" && article.series_name) {
    const series = document.createElement("span");
    series.className = "video-series-label";
    series.textContent = `${article.series_name}${article.episode_number ? ` · 第 ${article.episode_number} 集` : ""}`;
    header.querySelector(".article-detail-meta").appendChild(series);
  }
  header.querySelector(".article-detail-excerpt").textContent = article.excerpt;

  const body = document.createElement("div");
  body.className = "article-body";
  if (article.content_type === "video") {
    const player = document.createElement("video");
    player.className = "work-video-player";
    player.controls = true;
    player.preload = "metadata";
    player.playsInline = true;
    player.src = article.video_url;
    if (article.video_poster) player.poster = article.video_poster;
    player.setAttribute("aria-label", article.title);
    body.appendChild(player);
    setupVideoExperience(player, article);
    const description = document.createElement("div");
    description.className = "video-description";
    description.innerHTML = window.blogMarkdown.render(article.content || article.excerpt);
    body.appendChild(description);
  } else {
    body.innerHTML = window.blogMarkdown.render(article.content);
  }
  renderArticleMath(body);

  const attachments = article.attachments || [];
  const images = attachments.filter((file) => file.role !== "cover" && file.type?.startsWith("image/"));
  const files = attachments.filter((file) => !file.type?.startsWith("image/"));
  if (images.length) {
    const gallery = document.createElement("div");
    gallery.className = "article-image-gallery";
    images.forEach((file) => {
      const figure = document.createElement("figure");
      figure.innerHTML = `<img loading="lazy"><figcaption></figcaption>`;
      figure.querySelector("img").src = file.url;
      figure.querySelector("img").alt = file.name;
      figure.querySelector("figcaption").textContent = file.name;
      gallery.appendChild(figure);
    });
    body.appendChild(gallery);
  }
  if (files.length) {
    const box = document.createElement("section");
    box.className = "article-attachments";
    box.innerHTML = "<h2>附件</h2>";
    files.forEach((file) => box.appendChild(createAttachmentLink(file)));
    body.appendChild(box);
  }
  root.append(header, body);
  if (article.content_type !== "video") {
    const ending = document.createElement("img");
    ending.className = "article-ending-scene";
    ending.src = "./assets/page-scenes/article-ending.png";
    ending.alt = "";
    ending.setAttribute("aria-hidden", "true");
    ending.width = 1536;
    ending.height = 1024;
    ending.loading = "lazy";
    root.appendChild(ending);
  }

  document.title = `${article.title} | ${article.content_type === "video" ? "视频" : "文章"} | 虎桃不会振刀`;
  setMeta("description", article.excerpt);
  setMeta("og:title", article.title, true);
  setMeta("og:description", article.excerpt, true);
  setMeta("og:url", location.href, true);
  const cover = articleService.firstImage(article);
  if (cover) setMeta("og:image", cover.url, true);
  createToc(body);
  setupReadingTools(article);
  window.ArticleReading.setupResume(article);
}

function setupReadingTools(article) {
  if (article.content_type === "video") return;
  const tools = document.querySelector("#readingTools");
  const root = document.documentElement;
  const scaleKey = "hutao-reading-scale";
  const bookmarkKey = "hutao-bookmarked-articles";
  let scale = Math.min(1.2, Math.max(0.9, Number(localStorage.getItem(scaleKey)) || 1));

  const applyScale = () => {
    root.style.setProperty("--article-font-scale", scale);
    localStorage.setItem(scaleKey, String(scale));
  };
  const getBookmarks = () => {
    try {
      return JSON.parse(localStorage.getItem(bookmarkKey) || "[]");
    } catch {
      return [];
    }
  };
  const bookmark = document.querySelector("#bookmarkArticle");
  const renderBookmark = () => {
    const active = getBookmarks().some((item) => item.id === article.id);
    bookmark.classList.toggle("active", active);
    bookmark.setAttribute("aria-pressed", String(active));
    bookmark.textContent = active ? "已收藏" : "收藏此卷";
  };

  applyScale();
  renderBookmark();
  window.addEventListener('bookmarkschange', renderBookmark);
  tools.hidden = false;
  document.querySelector("#decreaseFont").addEventListener("click", () => {
    scale = Math.max(0.9, Number((scale - 0.1).toFixed(1)));
    applyScale();
  });
  document.querySelector("#increaseFont").addEventListener("click", () => {
    scale = Math.min(1.2, Number((scale + 0.1).toFixed(1)));
    applyScale();
  });
  bookmark.addEventListener("click", () => {
    const items = getBookmarks();
    const index = items.findIndex((item) => item.id === article.id);
    if (index >= 0) items.splice(index, 1);
    else items.unshift({ id: article.id, slug: article.slug, title: article.title, category: article.category, tags: article.tags || [], savedAt: Date.now() });
    localStorage.setItem(bookmarkKey, JSON.stringify(items.slice(0, 50)));
    renderBookmark();
  });
}

function formatDuration(seconds) {
  const value = Math.max(0, Math.round(Number(seconds) || 0));
  const minutes = Math.floor(value / 60);
  return `${minutes}:${String(value % 60).padStart(2, "0")}`;
}

function setupVideoExperience(player, article) {
  const progressKey = `hutao-video-progress-${article.id}`;
  const completedKey = `hutao-video-complete-${article.id}`;
  const saved = Number(localStorage.getItem(progressKey) || 0);
  const info = document.createElement("div");
  info.className = "video-playback-info";
  info.innerHTML = `<span>播放进度会自动保存</span><span class="video-duration"></span>`;
  player.insertAdjacentElement("afterend", info);

  player.addEventListener("loadedmetadata", () => {
    const duration = article.duration_seconds || player.duration;
    info.querySelector(".video-duration").textContent = duration ? `时长 ${formatDuration(duration)}` : "";
    if (saved > 5 && saved < player.duration - 5) {
      player.currentTime = saved;
      info.firstElementChild.textContent = `已恢复到 ${formatDuration(saved)}`;
    }
  });
  player.addEventListener("timeupdate", () => {
    if (Math.floor(player.currentTime) % 5 === 0) {
      localStorage.setItem(progressKey, String(player.currentTime));
    }
  });
  player.addEventListener("ended", async () => {
    localStorage.removeItem(progressKey);
    if (localStorage.getItem(completedKey)) return;
    localStorage.setItem(completedKey, "1");
    try {
      await articleService.recordVideoComplete(article.id);
    } catch {}
  });
}

function renderArticleMath(root) {
  const render = () => {
    if (typeof window.renderMathInElement !== "function") return false;
    window.renderMathInElement(root, {
      delimiters: [
        { left: "$$", right: "$$", display: true },
        { left: "\\[", right: "\\]", display: true },
        { left: "\\(", right: "\\)", display: false },
        { left: "$", right: "$", display: false },
      ],
      ignoredTags: ["script", "noscript", "style", "textarea", "pre", "code"],
      throwOnError: false,
    });
    return true;
  };
  if (!render()) window.addEventListener("load", render, { once: true });
}

function createLikeInkEffect(button) {
  if (reducedMotion) return;
  const burst = document.createElement("span");
  burst.className = "like-ink-burst";
  button.appendChild(burst);
  const drops = Array.from({ length: 8 }, (_, index) => {
    const drop = document.createElement("i");
    drop.dataset.angle = String((index * 45 + Math.random() * 18 - 9) * Math.PI / 180);
    drop.dataset.distance = String(22 + Math.random() * 20);
    burst.appendChild(drop);
    return drop;
  });

  if (window.gsap) {
    gsap.fromTo(burst, { scale: 0.2, autoAlpha: 0.8 }, {
      scale: 1.8,
      autoAlpha: 0,
      duration: 0.72,
      ease: "power2.out",
      onComplete: () => burst.remove(),
    });
    gsap.fromTo(drops, { scale: 0.2, autoAlpha: 0.9 }, {
      x: (_, drop) => Math.cos(Number(drop.dataset.angle)) * Number(drop.dataset.distance),
      y: (_, drop) => Math.sin(Number(drop.dataset.angle)) * Number(drop.dataset.distance),
      scale: 0,
      autoAlpha: 0,
      duration: 0.62,
      stagger: 0.025,
      ease: "power2.out",
    });
    gsap.fromTo(button, { scale: 0.94 }, { scale: 1, duration: 0.35, ease: "back.out(2)" });
  } else {
    burst.classList.add("css-only");
    burst.addEventListener("animationend", () => burst.remove(), { once: true });
  }
}

function createToc(body) { window.ArticleReading.setupToc(body); }

function createAttachmentLink(file) {
  const link = document.createElement("a");
  link.href = file.url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = `${file.name} (${Math.max(1, Math.round(file.size / 1024))} KB)`;
  return link;
}

function setupComments(article) { window.ArticleComments.setup(article); }
async function loadComments() { await window.ArticleComments.load(); }

async function setupArticleExtras(article) {
  const actions = document.querySelector("#articleActions");
  const viewCount = document.querySelector("#viewCount");
  actions.hidden = false;
  let views = article.view_count || 0;
  const viewKey = `hutao-view-${article.id}`;
  if (!sessionStorage.getItem(viewKey)) {
    try {
      views = await articleService.recordView(article.id);
      sessionStorage.setItem(viewKey, "1");
    } catch {}
  }
  viewCount.textContent = `${views} ${article.content_type === "video" ? "次播放" : "次阅读"}`;

  actions.querySelectorAll("[data-reaction]").forEach((button) => {
    button.querySelector(".like-count").textContent = article.like_count || 0;
    const active = articleService.hasReaction(article.id);
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
    button.addEventListener("click", async () => {
      button.disabled = true;
      try {
        const result = await articleService.toggleReaction(article.id);
        button.classList.toggle("active", result.active);
        button.setAttribute("aria-pressed", String(result.active));
        button.querySelector(".like-count").textContent = result.count;
        if (result.active) createLikeInkEffect(button);
      } catch {
        button.title = "请先执行最新的 Supabase 数据库迁移";
      } finally {
        button.disabled = false;
      }
    });
  });

  document.querySelector("#shareArticle").addEventListener("click", async () => {
    const data = { title: article.title, text: article.excerpt, url: location.href };
    try {
      if (navigator.share) await navigator.share(data);
      else {
        await navigator.clipboard.writeText(location.href);
        document.querySelector("#shareArticle").textContent = "链接已复制";
      }
    } catch {}
  });

  const all = await articleService.listPublished(null, { contentType: article.content_type || "article" });
  const index = all.findIndex((item) => item.id === article.id);
  const neighbors = document.querySelector("#articleNeighbors");
  const previous = all[index + 1];
  const next = all[index - 1];
  if (previous || next) {
    if (previous) neighbors.appendChild(neighborLink(previous, article.content_type === "video" ? "上一个视频" : "上一篇"));
    if (next) neighbors.appendChild(neighborLink(next, article.content_type === "video" ? "下一个视频" : "下一篇"));
    neighbors.hidden = false;
  }
  const related = await articleService.listRelated(article);
  if (related.length) {
    const section = document.querySelector("#relatedArticles");
    related.forEach((item) => section.querySelector("div").appendChild(neighborLink(item, item.category || "相关文章")));
    section.hidden = false;
  }
}

function neighborLink(article, label) {
  const link = document.createElement("a");
  link.href = articleService.articleUrl(article);
  const small = document.createElement("small");
  small.textContent = label;
  const strong = document.createElement("strong");
  strong.textContent = article.title;
  link.append(small, strong);
  return link;
}

async function loadArticle() {
  const slug = new URLSearchParams(location.search).get("slug");
  const root = document.querySelector("#articleDetail");
  if (!slug || !articleService.configured) {
    window.InkAssets?.state(root, { title: '没有找到要展开的文章', detail: '回到文章目录，再挑一卷读读。', action: '返回文章目录', onAction: () => { location.href = './articles.html'; } });
    return;
  }
  try {
    window.InkAssets?.loading(root, '正在展开此卷……', 1);
    currentArticle = await articleService.getPublished(slug);
    if (!currentArticle) throw new Error('Article not found');
    root.removeAttribute('aria-busy');
    renderArticle(currentArticle);
    setupComments(currentArticle);
    await Promise.allSettled([loadComments(currentArticle.id), setupArticleExtras(currentArticle)]);
  } catch {
    window.InkAssets?.state(root, { kind: 'error', title: '此卷暂时未能展开', detail: '文章可能尚未发布，或暂时无法连接。', action: '重新翻阅', onAction: loadArticle });
  }
}

loadArticle();
