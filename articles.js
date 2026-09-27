const articleContainer = document.querySelector("#articleList");
const searchInput = document.querySelector("#articleSearch");
const categoryFilter = document.querySelector("#categoryFilter");
const tagFilters = document.querySelector("#tagFilters");
const clearFilters = document.querySelector("#clearFilters");
const sortArticles = document.querySelector("#sortArticles");
const resultCount = document.querySelector("#articleResultCount");

let allArticles = [];
let activeTag = "";
let articleFilterTimer = null;
let filtersReady = false;

function renderArticleState(title, detail) {
  articleContainer.replaceChildren();
  const state = document.createElement("div");
  state.className = "hutao-state article-state";
  const heading = document.createElement("strong");
  heading.textContent = title;
  const copy = document.createElement("span");
  copy.textContent = detail;
  state.append(heading, copy);
  articleContainer.appendChild(state);
}

function withTimeout(promise, message) {
  return Promise.race([
    promise,
    new Promise((_, reject) => window.setTimeout(() => reject(new Error(message)), 10000)),
  ]);
}

function restoreFilterState() {
  const params = new URLSearchParams(location.search);
  searchInput.value = params.get("q") || "";
  categoryFilter.value = params.get("category") || "";
  activeTag = params.get("tag") || "";
  sortArticles.value = params.get("sort") || "newest";
}

function updateFilterUrl() {
  const params = new URLSearchParams();
  if (searchInput.value.trim()) params.set("q", searchInput.value.trim());
  if (categoryFilter.value) params.set("category", categoryFilter.value);
  if (activeTag) params.set("tag", activeTag);
  if (sortArticles.value !== "newest") params.set("sort", sortArticles.value);
  history.replaceState(null, "", `${location.pathname}${params.size ? `?${params}` : ""}`);
}

function createListCard(article) {
  const link = document.createElement("a");
  link.className = "article-list-card reveal";
  link.href = articleService.articleUrl(article);

  const cover = articleService.firstImage(article);
  link.classList.toggle("without-cover", !cover);
  const visual = document.createElement("div");
  visual.className = `article-list-cover ${cover ? "" : "placeholder-cover"}`;
  if (cover) {
    const image = document.createElement("img");
    image.src = cover.url;
    image.alt = "";
    image.loading = "lazy";
    visual.appendChild(image);
  } else {
    visual.innerHTML = '<span aria-hidden="true">文</span>';
  }
  const views = document.createElement("span");
  views.className = "cover-view-count";
  views.textContent = `${article.view_count || 0} 次阅读`;
  visual.appendChild(views);

  const copy = document.createElement("div");
  copy.className = "article-list-copy";
  const meta = document.createElement("div");
  meta.className = "article-card-meta";
  const category = document.createElement("span");
  category.textContent = article.category || "随笔";
  const time = document.createElement("time");
  time.dateTime = article.published_at || "";
  time.textContent = article.published_at ? articleService.formatDate(article.published_at) : "未定卷期";
  meta.append(category, time);

  const title = document.createElement("h2");
  title.textContent = article.title || "未题";
  const excerpt = document.createElement("p");
  excerpt.textContent = article.excerpt || "这篇文章还没有写下引子。";
  const tags = document.createElement("div");
  tags.className = "article-tags";
  (article.tags || []).forEach((tag) => {
    const chip = document.createElement("span");
    chip.textContent = tag;
    tags.appendChild(chip);
  });
  const stats = document.createElement("span");
  stats.className = "article-card-stats";
  stats.textContent = `${article.view_count || 0} 次阅读 · ${article.like_count || 0} 人点赞`;

  copy.append(meta, title, excerpt, tags, stats);
  link.append(visual, copy);
  return link;
}

function renderFilters() {
  categoryFilter.querySelectorAll("option:not(:first-child)").forEach((option) => option.remove());
  tagFilters.replaceChildren();

  const categories = [...new Set(allArticles.map((article) => article.category).filter(Boolean))];
  categories.forEach((category) => {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    categoryFilter.appendChild(option);
  });

  const params = new URLSearchParams(location.search);
  categoryFilter.value = params.get("category") || "";

  const tags = [...new Set(allArticles.flatMap((article) => article.tags || []))];
  tags.forEach((tag) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = tag;
    button.addEventListener("click", () => {
      activeTag = activeTag === tag ? "" : tag;
      renderArticles();
    });
    tagFilters.appendChild(button);
  });
  window.MotionCore?.setupCustomSelects?.(document.querySelector(".article-filters"));
  filtersReady = true;
}

function filteredArticles() {
  const keyword = searchInput.value.trim().toLowerCase();
  const category = categoryFilter.value;
  const filtered = allArticles.filter((article) => {
    const title = article.title || "";
    const excerpt = article.excerpt || "";
    const matchesKeyword =
      !keyword ||
      title.toLowerCase().includes(keyword) ||
      excerpt.toLowerCase().includes(keyword);
    return matchesKeyword &&
      (!category || article.category === category) &&
      (!activeTag || (article.tags || []).includes(activeTag));
  });
  const sorters = {
    newest: (a, b) => new Date(b.published_at || 0) - new Date(a.published_at || 0),
    popular: (a, b) => (b.view_count || 0) - (a.view_count || 0),
    liked: (a, b) => (b.like_count || 0) - (a.like_count || 0),
  };
  filtered.sort(sorters[sortArticles.value] || sorters.newest);
  return filtered;
}

function renderArticleDom(filtered) {
  [...tagFilters.children].forEach((button) => {
    button.classList.toggle("active", button.textContent === activeTag);
    button.setAttribute("aria-pressed", String(button.textContent === activeTag));
  });
  articleContainer.replaceChildren();
  resultCount.textContent = `共找到 ${filtered.length} 篇文章`;
  updateFilterUrl();

  if (!filtered.length) {
    renderArticleState("未寻得合卷文章", "换一个关键词、分类或标签再试试，江湖册页还在继续整理。");
    return;
  }
  filtered.forEach((article) => articleContainer.appendChild(createListCard(article)));
}

function renderArticles(options = {}) {
  const filtered = filteredArticles();
  resultCount.textContent = `共找到 ${filtered.length} 篇文章`;
  updateFilterUrl();
  const render = () => renderArticleDom(filtered);
  if (options.immediate || !filtersReady || !window.MotionCore?.animateListUpdate) {
    render();
    return;
  }
  window.MotionCore.animateListUpdate(articleContainer, render);
}

function scheduleRenderArticles(delay = 150) {
  window.clearTimeout(articleFilterTimer);
  articleFilterTimer = window.setTimeout(() => renderArticles(), delay);
}

async function loadArticles() {
  if (!articleService.configured) {
    resultCount.textContent = "文章服务待配置";
    renderArticleState("文章卷宗暂未开启", "当前文章服务尚未完成配置，页面结构已就绪，不会再停留在读取状态。");
    return;
  }

  try {
    allArticles = await withTimeout(articleService.listPublished(), "文章服务响应超时");
    restoreFilterState();
    renderFilters();
    renderArticles({ immediate: true });
  } catch (error) {
    resultCount.textContent = "读取受阻";
    renderArticleState("文章读取暂时受阻", error.message || "稍后再试，或检查文章服务配置。");
  }
}

searchInput.addEventListener("input", () => scheduleRenderArticles(150));
categoryFilter.addEventListener("change", () => renderArticles());
sortArticles.addEventListener("change", () => renderArticles());
clearFilters.addEventListener("click", () => {
  searchInput.value = "";
  categoryFilter.value = "";
  activeTag = "";
  sortArticles.value = "newest";
  categoryFilter.dispatchEvent(new Event("change", { bubbles: true }));
  sortArticles.dispatchEvent(new Event("change", { bubbles: true }));
  renderArticles();
});

window.addEventListener("popstate", () => {
  restoreFilterState();
  window.MotionCore?.setupCustomSelects?.(document.querySelector(".article-filters"));
  renderArticles();
});

loadArticles();
