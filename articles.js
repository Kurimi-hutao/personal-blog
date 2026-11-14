const articleContainer = document.querySelector("#articleList");
const searchInput = document.querySelector("#articleSearch");
const categoryFilter = document.querySelector("#categoryFilter");
const tagFilters = document.querySelector("#tagFilters");
const clearFilters = document.querySelector("#clearFilters");
const sortArticles = document.querySelector("#sortArticles");
const resultCount = document.querySelector("#articleResultCount");

let allArticles = [];
const articleCards = new Map();
let activeTag = "";
let activeTopic = "";
const topicFilters = document.querySelector('#topicFilters');
const keywordSearch = document.querySelector('#keywordSearch');
const moreFilters = document.querySelector('#moreFilters');
const topicDefinitions = [
  ['AI 学习', /人工智能|机器学习|深度学习|强化学习|大模型|生成式|提示词|智能体|入门|学习路线|\bai\b|llm|chatgpt|agent|prompt/i],
  ['神经网络', /神经网络|感知机|卷积|循环网络|注意力|transformer|cnn|rnn|lstm|架构|激活函数|反向传播/i],
  ['模型训练', /训练|微调|优化|梯度|损失|过拟合|正则|数据集|蒸馏|量化|推理|评估|lora|fine.?tun|pytorch|tensorflow/i],
  ['物理科学', /物理|科学|量子|力学|电磁|相对论|天文|宇宙|粒子|热学|光学|牛顿|数学/i],
  ['技术开发', /开发|编程|代码|工程|前端|后端|数据库|算法|部署|工具|计算机|软件|python|javascript|typescript|react|vue|api|git|linux|docker|web/i],
  ['开源周报', /开源|周报|周刊|github|开源项目/i],
  ['教育思考', /教育|教学|思考|反思|课堂|课程|学生|教师|学习方法|认知|成长|读书/i],
  ['设计创作', /设计|创作|绘画|插画|视觉|艺术|动画|摄影|排版|字体|视频|剪辑|水墨|ui|ux|figma|blender|after effects/i],
];
function syncFilterControls() {
  topicFilters.querySelectorAll('button').forEach(button => {
    const selected = button.dataset.topic === activeTopic;
    button.classList.toggle('active', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
  tagFilters.querySelectorAll('button').forEach(button => {
    const selected = button.dataset.tag === activeTag;
    button.classList.toggle('active', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
  document.querySelector('#moreFiltersToggle').textContent = activeTag ? `更多筛选 · ${activeTag}` : '更多筛选';
}
function searchKeywords() {
  const query = keywordSearch.value.trim().toLowerCase();
  let count = 0;
  tagFilters.querySelectorAll('button').forEach(button => {
    button.hidden = !button.dataset.tag.toLowerCase().includes(query);
    if (!button.hidden) count++;
  });
  document.querySelector('#keywordEmpty').hidden = count > 0;
}
let articleFilterTimer = null;
let filtersReady = false;

function renderArticleState(title, detail, kind = 'search') {
  if (window.InkAssets) return InkAssets.state(articleContainer, {
    kind, title, detail,
    action: kind === 'empty' ? null : (kind === 'error' ? '重新翻阅' : '清除筛选'),
    onAction: kind === 'error' ? loadArticles : () => clearFilters.click(),
  });
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


function restoreFilterState() {
  const params = new URLSearchParams(location.search);
  searchInput.value = params.get("q") || "";
  categoryFilter.value = params.get("category") || "";
  activeTag = params.get("tag") || "";
  activeTopic = topicDefinitions.some(([name]) => name === params.get("topic")) ? params.get("topic") : "";
  sortArticles.value = params.get("sort") || "newest";
}

function updateFilterUrl() {
  const params = new URLSearchParams();
  if (searchInput.value.trim()) params.set("q", searchInput.value.trim());
  if (categoryFilter.value) params.set("category", categoryFilter.value);
  if (activeTag) params.set("tag", activeTag);
  if (activeTopic) params.set("topic", activeTopic);
  if (sortArticles.value !== "newest") params.set("sort", sortArticles.value);
  const next = `${location.pathname}${params.size ? `?${params}` : ""}`;
  if (next !== location.pathname + location.search) history.pushState(null, "", next);
}

function writeSearchText(element, value, pattern) {
  if (!pattern) {
    element.append(value);
    return;
  }
  let start = 0;
  for (const match of value.matchAll(pattern)) {
    element.append(value.slice(start, match.index));
    const mark = document.createElement("mark");
    mark.textContent = match[0];
    element.append(mark);
    start = match.index + match[0].length;
  }
  element.append(value.slice(start));
}

function createListCard(article, pattern, copyOnly = false) {
  const link = document.createElement("a");
  link.className = "article-list-card reveal";
  link.href = articleService.articleUrl(article);

  const cover = articleService.articleCover(article);
  const visual = document.createElement("div");
  visual.className = `article-list-cover ${cover ? "" : "placeholder-cover"}`;
  if (cover && !copyOnly) {
    const image = document.createElement("img");
    image.src = cover.url;
    image.alt = "";
    image.loading = "lazy";
    image.width = 640; image.height = 360; image.decoding = "async";
    image.addEventListener('error', () => { image.src = articleService.fallbackCover(article).url; }, { once: true });
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
  writeSearchText(category, article.category || "随笔", pattern);
  const time = document.createElement("time");
  time.dateTime = article.published_at || "";
  time.textContent = article.published_at ? articleService.formatDate(article.published_at) : "未定卷期";
  meta.append(category, time);

  const title = document.createElement("h2");
  writeSearchText(title, article.title || "未题", pattern);
  const excerpt = document.createElement("p");
  let summary = article.excerpt || "这篇文章还没有写下引子。";
  if (pattern && article.excerpt) {
    const matchIndex = summary.search(pattern);
    if (matchIndex > 20) {
      const context = Array.from(summary.slice(0, matchIndex)).slice(-12).join("");
      summary = "…" + context + summary.slice(matchIndex);
    }
  }
  writeSearchText(excerpt, summary, pattern);
  const tags = document.createElement("div");
  tags.className = "article-tags";
  (article.tags || []).forEach((tag) => {
    const chip = document.createElement("span");
    chip.append("# ");
    writeSearchText(chip, tag, pattern);
    tags.appendChild(chip);
  });
  const stats = document.createElement("span");
  stats.className = "article-card-stats";
  stats.textContent = `${article.like_count || 0} 人点赞`;

  copy.append(meta, title, excerpt, tags, stats);
  link.append(visual, copy);
  return link;
}

function renderFilters() {
  categoryFilter.querySelectorAll("option:not(:first-child)").forEach((option) => option.remove());
  tagFilters.replaceChildren();
  topicFilters.replaceChildren();
  ['', ...topicDefinitions.map(([name]) => name)].forEach(name => {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.topic = name;
    button.textContent = name || '全部';
    button.addEventListener('click', () => {
      activeTopic = name;
      activeTag = '';
      renderArticles();
    });
    topicFilters.appendChild(button);
  });

  const categories = [...new Set(allArticles.map((article) => article.category).filter(Boolean))];
  categories.forEach((category) => {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    categoryFilter.appendChild(option);
  });

  const params = new URLSearchParams(location.search);
  categoryFilter.value = params.get("category") || "";

  const tagCounts = new Map();
  for (const article of allArticles) {
    for (const tag of new Set(article.tags || [])) {
      if (tag) tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
    }
  }
  const tags = [...tagCounts].sort((a, b) => b[1] - a[1]);
  tags.forEach(([tag, count]) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = `# ${tag} · ${count} 篇`;
    button.dataset.tag = tag;
    button.addEventListener("click", () => {
      activeTag = activeTag === tag ? "" : tag;
      renderArticles();
    });
    tagFilters.appendChild(button);
  });
  window.MotionCore?.setupCustomSelects?.(document.querySelector(".article-filters"));
  searchKeywords();
  syncFilterControls();
  filtersReady = true;
}

function filteredArticles(pattern) {
  const category = categoryFilter.value;
  const filtered = allArticles.filter((article) => {
    const fields = [article.title, article.excerpt, article.category, ...(article.tags || [])];
    const matchesKeyword =
      !pattern ||
      fields.some(value => value && value.search(pattern) !== -1);
    return matchesKeyword &&
      (!category || article.category === category) &&
      (!activeTag || (article.tags || []).includes(activeTag)) &&
      (!activeTopic || (article.tags || []).some(tag => topicDefinitions.find(([name]) => name === activeTopic)[1].test(tag)));
  });
  const sorters = {
    newest: (a, b) => new Date(b.published_at || 0) - new Date(a.published_at || 0),
    popular: (a, b) => (b.view_count || 0) - (a.view_count || 0),
    liked: (a, b) => (b.like_count || 0) - (a.like_count || 0),
  };
  filtered.sort(sorters[sortArticles.value] || sorters.newest);
  return filtered;
}

function renderArticleDom(filtered, pattern) {
  syncFilterControls();
  articleContainer.replaceChildren();
  resultCount.textContent = `共找到 ${filtered.length} 篇文章`;
  articleContainer.removeAttribute('aria-busy');
  updateFilterUrl();

  if (!filtered.length) {
    if (!allArticles.length) renderArticleState("第一卷正在酝酿中", "这里还没有发布的文章，新的随笔会在这里归档。", 'empty');
    else renderArticleState("未寻得合卷文章", "换一个关键词、分类或标签再试试，江湖册页还在继续整理。");
    return;
  }
  filtered.forEach((article, index) => {
    const key = article.id || article.slug, signature = JSON.stringify(article);
    let cached = articleCards.get(key);
    if (!cached || cached.signature !== signature) {
      cached = { signature, node: createListCard(article, pattern), pattern: pattern?.source };
      articleCards.set(key, cached);
    } else if (cached.pattern !== pattern?.source) {
      const fresh = createListCard(article, pattern, true);
      cached.node.querySelector('.article-list-copy').replaceWith(fresh.querySelector('.article-list-copy'));
      cached.pattern = pattern?.source;
    }
    cached.node.dataset.articleId = key;
    const img = cached.node.querySelector('img'); if (img && index < 2) img.loading = 'eager';
    articleContainer.appendChild(cached.node);
  });
}

function renderArticles(options = {}) {
  const query = searchInput.value.trim();
  const literal = query.replace(/[.*+?^$(){}|[\]\\]/g, "\\$&");
  const pattern = query ? new RegExp(literal, "giu") : null;
  const filtered = filteredArticles(pattern);
  resultCount.textContent = `共找到 ${filtered.length} 篇文章`;
  updateFilterUrl();
  syncFilterControls();
  const render = () => renderArticleDom(filtered, pattern);
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
  if (articleContainer.dataset.refreshing) return;
  articleContainer.dataset.refreshing = 'true';
  try { return await loadArticlesRequest(); }
  finally { delete articleContainer.dataset.refreshing; }
}
async function loadArticlesRequest() {
  if (!articleService.configured) {
    resultCount.textContent = "文章服务待配置";
    renderArticleState("文章卷宗暂未开启", "文章服务暂不可用，请稍后再来。", 'error');
    return;
  }

  try {
    window.ContentCache?.clearNotice(articleContainer);
    const saved = window.ContentCache?.read('articles');
    if (saved) { allArticles = saved.items; renderFilters(); restoreFilterState(); renderArticles({ immediate: true }); window.ContentCache.notice(articleContainer, loadArticles, saved.savedAt, true); }
    if (!saved && !allArticles.length) window.InkAssets?.loading(articleContainer, '正在翻阅文章……');
    allArticles = await articleService.readPublicFeed(null, { contentType: "article" });
    window.ContentCache?.clearNotice(articleContainer);
    window.ContentCache?.write('articles', allArticles);
    restoreFilterState();
    renderFilters();
    renderArticles({ immediate: true });
  } catch (error) {
    const cached = window.ContentCache?.read('articles') || (allArticles.length ? { items: allArticles, savedAt: Date.now() } : null);
    if (cached) {
      allArticles = cached.items;
      renderFilters(); restoreFilterState(); renderArticles({ immediate: true });
      window.ContentCache.notice(articleContainer, loadArticles, cached.savedAt);
      return;
    }
    resultCount.textContent = "读取受阻";
    renderArticleState("文章读取暂时受阻", "连接暂时不可用，请重新读取。这不代表文章卷宗为空。", 'error');
  }
}

searchInput.addEventListener("input", () => scheduleRenderArticles(150));
categoryFilter.addEventListener("change", () => renderArticles());
sortArticles.addEventListener("change", () => renderArticles());
clearFilters.addEventListener("click", () => {
  searchInput.value = "";
  categoryFilter.value = "";
  activeTag = "";
  activeTopic = "";
  keywordSearch.value = "";
  searchKeywords();
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

keywordSearch.addEventListener('input', searchKeywords);
document.querySelector('#clearKeywords').addEventListener('click', () => {
  activeTag = '';
  keywordSearch.value = '';
  searchKeywords();
  renderArticles();
});
moreFilters.addEventListener('toggle', () => {
  if (moreFilters.open) keywordSearch.focus();
});
document.addEventListener('click', event => {
  if (!moreFilters.contains(event.target)) moreFilters.open = false;
});
moreFilters.addEventListener('keydown', event => {
  if (event.key === 'Escape') {
    moreFilters.open = false;
    document.querySelector('#moreFiltersToggle').focus();
  }
});
loadArticles();
