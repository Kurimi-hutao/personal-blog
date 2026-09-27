const authPanel = document.querySelector("#authPanel");
const editorPanel = document.querySelector("#editorPanel");
const loginForm = document.querySelector("#loginForm");
const articleForm = document.querySelector("#articleForm");
const logoutButton = document.querySelector("#logoutButton");
const articleList = document.querySelector("#adminArticleList");
const commentList = document.querySelector("#adminCommentList");
const messageList = document.querySelector("#adminMessageList");
const commentCount = document.querySelector("#commentCount");
const messageCount = document.querySelector("#messageCount");
const existingAttachments = document.querySelector("#existingAttachments");
const editorTitle = document.querySelector("#editorTitle");
const statusElement = document.querySelector("#adminStatus");
const markdownPreview = document.querySelector("#markdownPreview");
const videoEditorFields = document.querySelector("#videoEditorFields");
const currentVideo = document.querySelector("#currentVideo");
const contentFieldLabel = document.querySelector("#contentFieldLabel");
const videoUploadHint = document.querySelector("#videoUploadHint");
const videoUploadPanel = document.querySelector("#videoUploadPanel");
const videoUploadName = document.querySelector("#videoUploadName");
const videoUploadSize = document.querySelector("#videoUploadSize");
const videoUploadStatus = document.querySelector("#videoUploadStatus");
const videoUploadProgress = document.querySelector("#videoUploadProgress");
const videoUploadPercent = document.querySelector("#videoUploadPercent");
const videoUploadBytes = document.querySelector("#videoUploadBytes");
const videoUploadPart = document.querySelector("#videoUploadPart");
const videoUploadSpeed = document.querySelector("#videoUploadSpeed");
const videoUploadEta = document.querySelector("#videoUploadEta");
const cancelVideoUpload = document.querySelector("#cancelVideoUpload");
const retryVideoUpload = document.querySelector("#retryVideoUpload");
const adminWorkSearch = document.querySelector("#adminWorkSearch");
const adminCategoryFilter = document.querySelector("#adminCategoryFilter");
const adminSeriesFilter = document.querySelector("#adminSeriesFilter");
const adminSortWorks = document.querySelector("#adminSortWorks");
const selectVisibleWorks = document.querySelector("#selectVisibleWorks");
const clearSelectedWorks = document.querySelector("#clearSelectedWorks");

let articles = [];
let comments = [];
let messages = [];
let editingArticle = null;
let workFilter = "all";
let adminMetadata = { categories: new Map(), tags: new Map(), series: new Map() };
let visibleAdminWorks = [];
let adminListReady = false;
const selectedWorks = new Set();
let autosaveTimer = null;
let currentVideoUpload = null;
let lastVideoFile = null;
let savingWork = false;

function getVideoUploadMode() {
  return window.BLOG_CONFIG?.videoUploadApi ? "r2" : "supabase";
}

function getMaxVideoSizeBytes() {
  return getVideoUploadMode() === "r2"
    ? Number(window.BLOG_CONFIG?.maxVideoSizeMb || 500) * 1024 * 1024
    : 50 * 1024 * 1024;
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return "0 MB";
  return `${(bytes / 1024 / 1024).toFixed(bytes >= 100 * 1024 * 1024 ? 0 : 1)} MB`;
}

function validateVideoFile(file) {
  if (!file) return null;
  if (!["video/mp4", "video/webm", "video/ogg"].includes(file.type)) return "Video must be MP4, WebM, or OGG.";
  const maxBytes = getMaxVideoSizeBytes();
  if (file.size > maxBytes) return `Video must not exceed ${formatBytes(maxBytes)}.`;
  return null;
}

function updateVideoUploadHint() {
  if (!videoUploadHint) return;
  videoUploadHint.textContent = getVideoUploadMode() === "r2"
    ? "MP4/WebM/OGG, up to 500MB with multipart R2 upload."
    : "Supabase compatibility upload is active: up to 50MB. Configure Cloudflare R2 for 500MB.";
}

function renderUploadProgress(detail = {}) {
  if (!videoUploadPanel) return;
  videoUploadPanel.hidden = !detail.file;
  if (!detail.file) return;
  videoUploadName.textContent = detail.file.name;
  videoUploadSize.textContent = formatBytes(detail.file.size);
  const label = {
    creating: "Creating upload",
    uploading: "Uploading",
    retrying: "Retrying",
    completing: "Completing upload",
    done: "Upload complete",
    failed: "Upload failed",
    canceled: "Canceled",
    waiting: "Waiting",
  }[detail.status] || "Waiting";
  videoUploadStatus.textContent = label;
  videoUploadProgress.value = Math.round(detail.percent || 0);
  videoUploadPercent.textContent = `${Math.round(detail.percent || 0)}%`;
  videoUploadBytes.textContent = `${formatBytes(detail.uploadedBytes || 0)} / ${formatBytes(detail.totalBytes || detail.file.size)}`;
  videoUploadPart.textContent = `Part ${detail.partNumber || 0} / ${detail.totalParts || 0}`;
  videoUploadSpeed.textContent = `${formatBytes(detail.speedBytesPerSecond || 0)}/s`;
  videoUploadEta.textContent = detail.remainingSeconds ? `ETA ${Math.ceil(detail.remainingSeconds)}s` : "ETA --";
}

async function uploadSelectedVideo(file, session) {
  if (getVideoUploadMode() !== "r2") return articleService.uploadVideo(file, session.user.id);
  const controller = new AbortController();
  const uploader = new window.MultipartVideoUploader({
    endpoint: window.BLOG_CONFIG.videoUploadApi,
    accessToken: session.access_token,
    chunkSize: 10 * 1024 * 1024,
    concurrency: 3,
    maxRetries: 3,
    signal: controller.signal,
    onProgress: (detail) => {
      sessionStorage.setItem("hutao-video-upload-state", JSON.stringify({
        name: detail.file.name,
        size: detail.file.size,
        percent: detail.percent,
        status: detail.status,
      }));
      renderUploadProgress(detail);
    },
  });
  currentVideoUpload = { controller, uploader, file };
  cancelVideoUpload.hidden = false;
  retryVideoUpload.hidden = true;
  articleForm.elements.videoFile.disabled = true;
  try {
    const result = await uploader.uploadFile(file);
    renderUploadProgress({ file, status: "done", percent: 100, uploadedBytes: file.size, totalBytes: file.size });
    sessionStorage.removeItem("hutao-video-upload-state");
    return {
      name: file.name,
      path: `r2:${result.key}`,
      url: result.url,
      type: file.type,
      size: file.size,
      provider: "cloudflare-r2",
    };
  } catch (error) {
    if (error?.name === "AbortError") {
      await uploader.abort();
      renderUploadProgress({ file, status: "canceled", percent: 0, uploadedBytes: 0, totalBytes: file.size });
    } else {
      renderUploadProgress({ file, status: "failed", percent: videoUploadProgress.value, totalBytes: file.size });
      retryVideoUpload.hidden = false;
    }
    throw error;
  } finally {
    cancelVideoUpload.hidden = true;
    articleForm.elements.videoFile.disabled = false;
    currentVideoUpload = null;
  }
}

function setStatus(message, isError = false) {
  statusElement.textContent = message;
  statusElement.classList.toggle("error", isError);
}

function adminDialog({ title, message, input = false, danger = false }) {
  return new Promise((resolve) => {
    const dialog = document.createElement("dialog");
    dialog.className = `admin-dialog${danger ? " danger" : ""}`;
    dialog.innerHTML = `
      <form method="dialog" class="admin-dialog__shell">
        <h2></h2>
        <p></p>
        ${input ? '<textarea rows="5" maxlength="800" autofocus></textarea>' : ""}
        <div class="admin-dialog__actions">
          <button class="text-button" value="cancel" type="submit">取消</button>
          <button class="ink-button" value="ok" type="submit">${danger ? "确认操作" : "确认"}</button>
        </div>
      </form>`;
    dialog.querySelector("h2").textContent = title;
    dialog.querySelector("p").textContent = message;
    document.body.appendChild(dialog);
    dialog.addEventListener("close", () => {
      const textarea = dialog.querySelector("textarea");
      const value = dialog.returnValue === "ok" ? (input ? textarea.value.trim() : true) : null;
      dialog.remove();
      resolve(value);
    }, { once: true });
    dialog.showModal();
  });
}

function confirmAction(message, danger = false) {
  return adminDialog({ title: danger ? "危险操作" : "确认操作", message, danger });
}

function promptOwnerReply(name) {
  return adminDialog({ title: "站长回复", message: `回复 ${name}：`, input: true });
}

function buildAdminMetadata() {
  const categories = new Map();
  const tags = new Map();
  const series = new Map();
  articles.filter((article) => !article.deleted_at).forEach((article) => {
    const type = article.content_type === "video" ? "video" : "article";
    const category = article.category || (type === "video" ? "视频" : "随笔");
    const categoryMeta = categories.get(category) || { name: category, total: 0, article: 0, video: 0 };
    categoryMeta.total += 1;
    categoryMeta[type] += 1;
    categories.set(category, categoryMeta);
    (article.tags || []).forEach((tag) => {
      tags.set(tag, (tags.get(tag) || 0) + 1);
    });
    if (type === "video" && article.series_name) {
      const item = series.get(article.series_name) || { name: article.series_name, total: 0, episodes: [] };
      item.total += 1;
      if (article.episode_number) item.episodes.push({ number: Number(article.episode_number), id: article.id });
      series.set(article.series_name, item);
    }
  });
  adminMetadata = { categories, tags, series };
  return adminMetadata;
}

function getCategoriesByContentType(type = selectedContentType()) {
  return [...adminMetadata.categories.values()]
    .filter((item) => !type || item[type] || item.total)
    .sort((a, b) => (b[type] || b.total) - (a[type] || a.total) || a.name.localeCompare(b.name, "zh-CN"));
}

function getExistingTags() {
  return [...adminMetadata.tags.entries()]
    .map(([name, total]) => ({ name, total }))
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, "zh-CN"));
}

function getVideoSeries() {
  return [...adminMetadata.series.values()].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, "zh-CN"));
}

function getEpisodesForSeries(seriesName) {
  return (adminMetadata.series.get(seriesName)?.episodes || [])
    .map((item) => item.number)
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
}

function getNextEpisodeNumber(seriesName) {
  const episodes = getEpisodesForSeries(seriesName);
  return episodes.length ? Math.max(...episodes) + 1 : 1;
}

function replaceOptions(select, values, firstLabel) {
  if (!select) return;
  const current = select.value;
  select.replaceChildren(new Option(firstLabel, ""));
  values.forEach((item) => {
    const label = item.total ? `${item.name}（${item.total}）` : item.name;
    select.appendChild(new Option(label, item.name));
  });
  select.value = [...select.options].some((option) => option.value === current) ? current : "";
  window.MotionCore?.createAnimatedSelect?.(select)?.refresh();
}

function refreshAdminSuggestions() {
  buildAdminMetadata();
  replaceOptions(adminCategoryFilter, [...adminMetadata.categories.values()].sort((a, b) => b.total - a.total), "全部分类");
  replaceOptions(adminSeriesFilter, getVideoSeries(), "全部系列");
  window.MotionCore?.setupCustomSelects?.(document);
  window.dispatchEvent(new CustomEvent("admin-metadata-ready"));
}

function switchPanel(panelId) {
  document.querySelectorAll(".admin-tab-panel").forEach((panel) => {
    panel.classList.toggle("active", panel.id === panelId);
  });
  document.querySelectorAll("[data-admin-target]").forEach((button) => {
    button.classList.toggle("active", button.dataset.adminTarget === panelId);
  });
}

function showEditor(session) {
  const owner = articleService.isOwner(session);
  authPanel.hidden = owner;
  editorPanel.hidden = !owner;
  return owner;
}

function selectedContentType() {
  return articleForm.elements.contentType.value;
}

function updateEditorMode() {
  const type = selectedContentType();
  const isVideo = type === "video";
  window.adminCover.mode(isVideo);
  videoEditorFields.hidden = !isVideo;
  document.querySelector(".video-duration-field").hidden = !isVideo;
  contentFieldLabel.textContent = isVideo ? "视频简介（Markdown）" : "正文（Markdown）";
  articleForm.elements.content.placeholder = isVideo
    ? "介绍视频内容、录制背景或精彩看点。"
    : "# 标题\n\n支持列表、引用、链接、图片、代码块与 LaTeX 公式。";
  if (!editingArticle) editorTitle.textContent = isVideo ? "新建视频" : "新建文章";
  articleForm.querySelector(".publish-button").textContent = editingArticle
    ? "保存修改"
    : isVideo ? "发布视频" : "发布文章";
  updateVideoUploadHint();
  refreshEditorSuggestionPanels();
  updateEpisodeHelper();
}

function ensureSuggestionPanel(input, className) {
  let panel = input.parentElement.querySelector(`.${className}`);
  if (!panel) {
    panel = document.createElement("div");
    panel.className = `admin-suggestion-panel ${className}`;
    input.after(panel);
  }
  return panel;
}

function renderInputSuggestions(input, items, onPick, emptyLabel = "可创建新项目") {
  const panel = ensureSuggestionPanel(input, "input-suggestions");
  const keyword = input.value.trim().toLowerCase();
  const matches = items.filter((item) => item.name.toLowerCase().includes(keyword)).slice(0, 8);
  panel.replaceChildren();
  matches.forEach((item, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = item.total ? `${item.name}（${item.total}）` : item.name;
    button.style.setProperty("--suggestion-delay", `${Math.min(index, 6) * 30}ms`);
    button.addEventListener("click", () => {
      onPick(item.name);
      panel.classList.remove("is-open");
    });
    panel.appendChild(button);
  });
  if (!matches.length && input.value.trim()) {
    const create = document.createElement("button");
    create.type = "button";
    create.textContent = `${emptyLabel}：${input.value.trim()}`;
    create.addEventListener("click", () => {
      onPick(input.value.trim());
      panel.classList.remove("is-open");
    });
    panel.appendChild(create);
  }
  panel.classList.toggle("is-open", document.activeElement === input && Boolean(panel.children.length));
}

function appendTag(tag) {
  const normalized = tag.trim();
  if (!normalized) return;
  const current = articleForm.elements.tags.value.split(/[,，]/).map((item) => item.trim()).filter(Boolean);
  if (!current.includes(normalized)) current.push(normalized);
  articleForm.elements.tags.value = current.join(", ");
  articleForm.elements.tags.dispatchEvent(new Event("input", { bubbles: true }));
}

function refreshEditorSuggestionPanels() {
  if (!articleForm) return;
  renderInputSuggestions(
    articleForm.elements.category,
    getCategoriesByContentType(selectedContentType()),
    (value) => { articleForm.elements.category.value = value; },
    "新分类",
  );
  renderInputSuggestions(
    articleForm.elements.seriesName,
    getVideoSeries(),
    (value) => {
      articleForm.elements.seriesName.value = value;
      updateEpisodeHelper(true);
    },
    "新系列",
  );
  const tagInput = articleForm.elements.tags;
  const panel = ensureSuggestionPanel(tagInput, "tag-suggestions");
  const lastToken = tagInput.value.split(/[,，]/).pop().trim().toLowerCase();
  const existing = tagInput.value.split(/[,，]/).map((item) => item.trim()).filter(Boolean);
  const matches = getExistingTags()
    .filter((item) => !existing.includes(item.name) && (!lastToken || item.name.toLowerCase().includes(lastToken)))
    .slice(0, 8);
  panel.replaceChildren();
  matches.forEach((item, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = `${item.name}（${item.total}）`;
    button.style.setProperty("--suggestion-delay", `${Math.min(index, 6) * 30}ms`);
    button.addEventListener("click", () => appendTag(item.name));
    panel.appendChild(button);
  });
  panel.classList.toggle("is-open", document.activeElement === tagInput && Boolean(matches.length));
}

function ensureEpisodeHelper() {
  let helper = articleForm.querySelector(".episode-helper");
  if (!helper) {
    helper = document.createElement("p");
    helper.className = "episode-helper";
    articleForm.elements.episodeNumber.closest("label").appendChild(helper);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "text-button auto-episode-button";
    button.textContent = "自动下一集";
    button.addEventListener("click", () => updateEpisodeHelper(true));
    helper.after(button);
  }
  return helper;
}

function updateEpisodeHelper(applyNext = false) {
  const helper = ensureEpisodeHelper();
  const button = articleForm.querySelector(".auto-episode-button");
  const seriesName = articleForm.elements.seriesName.value.trim();
  const isVideo = selectedContentType() === "video";
  helper.hidden = !isVideo || !seriesName;
  button.hidden = helper.hidden;
  if (helper.hidden) return;
  const episodes = getEpisodesForSeries(seriesName);
  const next = getNextEpisodeNumber(seriesName);
  helper.textContent = `已存在：${episodes.length ? episodes.map((number) => `第 ${number} 集`).join("、") : "暂无"}；推荐下一集：第 ${next} 集`;
  if (applyNext && !editingArticle) articleForm.elements.episodeNumber.value = next;
}

function hasEpisodeConflict() {
  const seriesName = articleForm.elements.seriesName.value.trim();
  const episode = Number(articleForm.elements.episodeNumber.value);
  if (selectedContentType() !== "video" || !seriesName || !episode) return false;
  return articles.some((article) =>
    !article.deleted_at &&
    article.id !== editingArticle?.id &&
    article.content_type === "video" &&
    article.series_name === seriesName &&
    Number(article.episode_number) === episode
  );
}

function resetEditor(type = "article") {
  if (savingWork) return;
  clearTimeout(autosaveTimer);
  editingArticle = null;
  articleForm.reset();
  window.adminCover.reset();
  articleForm.elements.articleId.value = "";
  articleForm.elements.contentType.value = type;
  articleForm.elements.category.value = type === "video" ? "视频" : "随笔";
  articleForm.elements.published.value = "true";
  existingAttachments.hidden = true;
  existingAttachments.replaceChildren();
  currentVideo.hidden = true;
  currentVideo.textContent = "";
  renderUploadProgress();
  document.querySelector("#restoreDraftButton").hidden = !localStorage.getItem(`hutao-editor-draft-${type}`);
  updateEditorMode();
  renderMarkdownPreview();
}

function openNewWork(type) {
  resetEditor(type);
  switchPanel("editorWorkPanel");
  articleForm.elements.title.focus();
}

function renderExistingAttachments(article) {
  existingAttachments.replaceChildren();
  const attachments = article.attachments || [];
  existingAttachments.hidden = !attachments.length;
  if (!attachments.length) return;
  const heading = document.createElement("strong");
  heading.textContent = "已上传附件（勾选后保存将删除）";
  existingAttachments.appendChild(heading);
  attachments.forEach((file, index) => {
    if (file.role === "cover") return;
    const label = document.createElement("label");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.name = "removeAttachment";
    checkbox.value = String(index);
    const text = document.createElement("span");
    text.textContent = file.name;
    label.append(checkbox, text);
    existingAttachments.appendChild(label);
  });
}

function beginEdit(article) {
  if (savingWork) return;
  clearTimeout(autosaveTimer);
  articleForm.reset();
  editingArticle = article;
  articleForm.elements.articleId.value = article.id;
  articleForm.elements.contentType.value = article.content_type || "article";
  articleForm.elements.title.value = article.title;
  articleForm.elements.slug.value = article.slug;
  articleForm.elements.excerpt.value = article.excerpt;
  articleForm.elements.content.value = article.content;
  articleForm.elements.category.value = article.category || "随笔";
  articleForm.elements.tags.value = (article.tags || []).join(", ");
  articleForm.elements.published.value = String(article.published);
  articleForm.elements.scheduledAt.value = article.scheduled_at
    ? new Date(article.scheduled_at).toISOString().slice(0, 16)
    : "";
  articleForm.elements.videoUrl.value = article.video_url || "";
  articleForm.elements.videoPoster.value = article.video_poster || "";
  window.adminCover.reset(article);
  articleForm.elements.seriesName.value = article.series_name || "";
  articleForm.elements.episodeNumber.value = article.episode_number || "";
  articleForm.elements.durationSeconds.value = article.duration_seconds || "";
  currentVideo.hidden = !article.video_url;
  currentVideo.textContent = article.video_url ? `当前视频：${article.video_name || article.video_url}` : "";
  document.querySelector("#restoreDraftButton").hidden = !localStorage.getItem(`hutao-editor-draft-${article.id}`);
  editorTitle.textContent = `编辑${articleService.contentLabel(article)}`;
  renderExistingAttachments(article);
  updateEditorMode();
  renderMarkdownPreview();
  switchPanel("editorWorkPanel");
  articleForm.scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderArticleList() {
  const search = (adminWorkSearch?.value || "").trim().toLowerCase();
  const category = adminCategoryFilter?.value || "";
  const series = adminSeriesFilter?.value || "";
  const sort = adminSortWorks?.value || "updated-desc";
  const filtered = articles.filter((article) => {
    if (workFilter === "trash") return Boolean(article.deleted_at);
    if (article.deleted_at) return false;
    const typeMatch = workFilter === "all" || (article.content_type || "article") === workFilter;
    const text = [article.title, article.excerpt, article.category, article.series_name, ...(article.tags || [])].join(" ").toLowerCase();
    return typeMatch &&
      (!category || article.category === category) &&
      (!series || article.series_name === series) &&
      (!search || text.includes(search));
  });
  const sorters = {
    "updated-desc": (a, b) => new Date(b.updated_at || 0) - new Date(a.updated_at || 0),
    "published-desc": (a, b) => new Date(b.published_at || 0) - new Date(a.published_at || 0),
    "views-desc": (a, b) => Number(b.view_count || 0) - Number(a.view_count || 0),
  };
  filtered.sort(sorters[sort] || sorters["updated-desc"]);
  visibleAdminWorks = filtered;

  const draw = () => {
  articleList.replaceChildren();
  if (!filtered.length) {
    articleList.innerHTML = '<p class="article-state">当前分类还没有作品。</p>';
  } else {
    filtered.forEach((article) => {
      const row = document.createElement("article");
      row.className = "admin-article-row";
      const copy = document.createElement("div");
      const select = document.createElement("input");
      select.type = "checkbox";
      select.className = "work-select";
      select.checked = selectedWorks.has(article.id);
      select.setAttribute("aria-label", `选择《${article.title}》`);
      select.addEventListener("change", () => {
        if (select.checked) selectedWorks.add(article.id);
        else selectedWorks.delete(article.id);
      });
      const title = document.createElement("h3");
      title.textContent = article.title;
      const meta = document.createElement("p");
      const categoryText = article.category ? ` · ${article.category}` : "";
      const seriesText = article.content_type === "video" && article.series_name
        ? ` · ${article.series_name}${article.episode_number ? ` 第 ${article.episode_number} 集` : ""}`
        : "";
      meta.textContent = `${articleService.contentLabel(article)} · ${article.published ? "已发布" : "草稿"}${categoryText}${seriesText} · ${articleService.formatDate(article.updated_at)} · ${article.view_count || 0} 次浏览`;
      copy.append(title, meta);
      const actions = document.createElement("div");
      actions.className = "admin-row-actions";
      const viewLink = document.createElement("a");
      viewLink.className = "text-button";
      viewLink.href = articleService.articleUrl(article);
      viewLink.target = "_blank";
      viewLink.rel = "noopener";
      viewLink.textContent = "查看";
      const editButton = document.createElement("button");
      editButton.type = "button";
      editButton.className = "text-button";
      editButton.textContent = "编辑";
      editButton.addEventListener("click", () => beginEdit(article));
      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.className = "text-button danger";
      deleteButton.textContent = article.deleted_at ? "永久删除" : "移入回收站";
      deleteButton.addEventListener("click", () => article.deleted_at
        ? permanentlyRemoveArticle(article, deleteButton)
        : removeArticle(article, deleteButton));
      if (article.deleted_at) {
        const restoreButton = document.createElement("button");
        restoreButton.type = "button";
        restoreButton.className = "text-button";
        restoreButton.textContent = "恢复";
        restoreButton.addEventListener("click", async () => {
          restoreButton.disabled = true;
          await articleService.restoreArticle(article.id);
          await loadAdminArticles();
          setStatus("作品已从回收站恢复为草稿。");
        });
        actions.append(restoreButton, deleteButton);
      } else {
        actions.append(viewLink, editButton, deleteButton);
      }
      row.append(select, copy, actions);
      articleList.appendChild(row);
    });
  }
  };
  if (adminListReady && window.MotionCore?.animateListUpdate) {
    window.MotionCore.animateListUpdate(articleList, draw);
  } else {
    draw();
    adminListReady = true;
  }
  const activeWorks = articles.filter((item) => !item.deleted_at);
  const articleWorks = activeWorks.filter((item) => (item.content_type || "article") === "article");
  const videoWorks = activeWorks.filter((item) => item.content_type === "video");
  document.querySelector("#articleMetric").textContent = articleWorks.length;
  document.querySelector("#videoMetric").textContent = videoWorks.length;
  document.querySelector("#viewMetric").textContent = activeWorks.reduce((sum, item) => sum + Number(item.view_count || 0), 0);
  document.querySelector("#reactionMetric").textContent = activeWorks.reduce((sum, item) => sum + Number(item.like_count || 0), 0);
}

async function loadAdminArticles() {
  articleList.innerHTML = '<p class="article-state">正在读取作品……</p>';
  articles = await articleService.listAllArticles();
  refreshAdminSuggestions();
  renderArticleList();
}

function renderDashboardStats(data) {
  const chart = document.querySelector("#analyticsChart");
  const daily = data?.daily || [];
  chart.replaceChildren();
  if (!daily.length) {
    chart.innerHTML = '<p class="article-state">暂无趋势数据，新的访问会从迁移执行后开始记录。</p>';
  } else {
    const max = Math.max(1, ...daily.map((day) => Number(day.views || 0)));
    daily.forEach((day) => {
      const column = document.createElement("div");
      column.className = "analytics-column";
      column.title = `${day.day}：${day.views} 次浏览，${day.completions} 次完播`;
      column.innerHTML = `<span style="height:${Math.max(6, Number(day.views || 0) / max * 100)}%"></span><small>${String(day.day).slice(5)}</small>`;
      chart.appendChild(column);
    });
  }
  const top = document.querySelector("#topWorksList");
  top.replaceChildren();
  (data?.top_works || []).forEach((work, index) => {
    const row = document.createElement("p");
    row.innerHTML = `<strong>${index + 1}. ${work.title}</strong><span>${work.view_count || 0} 浏览 · ${work.like_count || 0} 点赞</span>`;
    top.appendChild(row);
  });
}

async function loadDashboardStats() {
  try {
    renderDashboardStats(await articleService.getOwnerDashboard());
  } catch {
    renderDashboardStats(null);
  }
}

function createModerationRow(item, type) {
  const row = document.createElement("article");
  row.className = "admin-moderation-row";
  const copy = document.createElement("div");
  const meta = document.createElement("p");
  const source = type === "comment"
    ? `《${item.articles?.title || "已删除作品"}》${item.articles?.content_type === "video" ? "视频" : "文章"}`
    : "主页留言";
  meta.textContent = `${item.visitor_name} · ${source} · ${articleService.formatDate(item.created_at)}`;
  const body = document.createElement("p");
  body.className = "admin-moderation-body";
  body.textContent = item.body;
  copy.append(meta, body);
  const actions = document.createElement("div");
  actions.className = "admin-row-actions";
  if (type === "comment") {
    const approvalButton = document.createElement("button");
    approvalButton.type = "button";
    approvalButton.className = "text-button";
    approvalButton.textContent = item.approved ? "隐藏" : "通过";
    approvalButton.addEventListener("click", async () => {
      approvalButton.disabled = true;
      try {
        await articleService.updateCommentApproval(item.id, !item.approved);
        await loadModerationContent();
        setStatus(item.approved ? "评论已隐藏。" : "评论已通过。");
      } catch (error) {
        setStatus(`操作失败：${error.message}`, true);
        approvalButton.disabled = false;
      }
    });
    actions.appendChild(approvalButton);
    const pinButton = document.createElement("button");
    pinButton.type = "button";
    pinButton.className = "text-button";
    pinButton.textContent = item.pinned ? "取消置顶" : "置顶";
    pinButton.addEventListener("click", async () => {
      pinButton.disabled = true;
      await articleService.updateCommentPinned(item.id, !item.pinned);
      await loadModerationContent();
      setStatus(item.pinned ? "已取消置顶。" : "评论已置顶。");
    });
    const replyButton = document.createElement("button");
    replyButton.type = "button";
    replyButton.className = "text-button";
    replyButton.textContent = "站长回复";
    replyButton.addEventListener("click", () => replyAsOwner(item, replyButton));
    actions.append(pinButton, replyButton);
  }
  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.className = "text-button danger";
  deleteButton.textContent = "删除";
  deleteButton.addEventListener("click", () => type === "comment" ? removeComment(item, deleteButton) : removeMessage(item, deleteButton));
  actions.appendChild(deleteButton);
  row.append(copy, actions);
  return row;
}

async function replyAsOwner(comment, button) {
  const body = await promptOwnerReply(comment.visitor_name);
  if (!body?.trim()) return;
  button.disabled = true;
  try {
    await articleService.createComment({
      article_id: comment.article_id,
      parent_id: comment.parent_id || comment.id,
      visitor_name: "虎桃不会振刀",
      visitor_token: articleService.getVisitorToken(),
      body: body.trim(),
      attachments: [],
      is_owner: true,
    });
    await loadModerationContent();
    setStatus("站长回复已发布。");
  } catch (error) {
    setStatus(`回复失败：${error.message}`, true);
    button.disabled = false;
  }
}

function renderModerationLists() {
  commentList.replaceChildren();
  messageList.replaceChildren();
  commentCount.textContent = `${comments.length} 条`;
  messageCount.textContent = `${messages.length} 条`;
  document.querySelector("#pendingMetric").textContent = comments.filter((comment) => !comment.approved).length;
  if (!comments.length) commentList.innerHTML = '<p class="article-state">暂无评论。</p>';
  else comments.forEach((comment) => commentList.appendChild(createModerationRow(comment, "comment")));
  if (!messages.length) messageList.innerHTML = '<p class="article-state">暂无留言。</p>';
  else messages.forEach((message) => messageList.appendChild(createModerationRow(message, "message")));
}

async function loadModerationContent() {
  [comments, messages] = await Promise.all([articleService.listAllComments(), articleService.listMessages(100)]);
  renderModerationLists();
}

async function removeComment(comment, button) {
  if (!await confirmAction(`确定删除 ${comment.visitor_name} 的这条评论吗？`, true)) return;
  button.disabled = true;
  try {
    await articleService.deleteComment(comment.id);
    if (comment.attachments?.length) await articleService.removeCommentFiles(comment.attachments).catch(() => {});
    await loadModerationContent();
    setStatus("评论已删除。");
  } catch (error) {
    setStatus(`删除评论失败：${error.message}`, true);
    button.disabled = false;
  }
}

async function removeMessage(message, button) {
  if (!await confirmAction(`确定删除 ${message.visitor_name} 的这条留言吗？`, true)) return;
  button.disabled = true;
  try {
    await articleService.deleteMessage(message.id);
    await loadModerationContent();
    setStatus("留言已删除。");
  } catch (error) {
    setStatus(`删除留言失败：${error.message}`, true);
    button.disabled = false;
  }
}

async function removeArticle(article, button) {
  if (!await confirmAction(`将${articleService.contentLabel(article)}《${article.title}》移入回收站吗？`, true)) return;
  button.disabled = true;
  try {
    await articleService.deleteArticle(article.id);
    if (editingArticle?.id === article.id) resetEditor();
    await loadAdminArticles();
    setStatus("作品已移入回收站。");
  } catch (error) {
    setStatus(`删除失败：${error.message}`, true);
    button.disabled = false;
  }
}

async function permanentlyRemoveArticle(article, button) {
  if (!await confirmAction(`永久删除《${article.title}》及其评论和文件吗？此操作无法撤销。`, true)) return;
  button.disabled = true;
  try {
    const commentAttachments = comments
      .filter((comment) => comment.article_id === article.id)
      .flatMap((comment) => comment.attachments || []);
    await articleService.permanentlyDeleteArticle(article.id);
    if (article.attachments?.length) await articleService.removeFiles(article.attachments).catch(() => {});
    if (article.video_path) await articleService.removeVideo({ path: article.video_path }).catch(() => {});
    if (commentAttachments.length) await articleService.removeCommentFiles(commentAttachments).catch(() => {});
    await Promise.all([loadAdminArticles(), loadModerationContent()]);
    setStatus("作品已永久删除。");
  } catch (error) {
    setStatus(`永久删除失败：${error.message}`, true);
    button.disabled = false;
  }
}

async function loadOwnerConsole() {
  await Promise.all([loadAdminArticles(), loadModerationContent(), loadDashboardStats()]);
}

function renderMarkdownPreview() {
  markdownPreview.innerHTML = window.blogMarkdown.render(articleForm.elements.content.value);
  if (!markdownPreview.textContent.trim()) {
    markdownPreview.innerHTML = '<p class="article-state">预览会随内容输入实时更新。</p>';
  } else if (typeof window.renderMathInElement === "function") {
    window.renderMathInElement(markdownPreview, {
      delimiters: [
        { left: "$$", right: "$$", display: true },
        { left: "\\[", right: "\\]", display: true },
        { left: "\\(", right: "\\)", display: false },
        { left: "$", right: "$", display: false },
      ],
      ignoredTags: ["script", "noscript", "style", "textarea", "pre", "code"],
      throwOnError: false,
    });
  }
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = loginForm.querySelector("button");
  button.disabled = true;
  try {
    const form = new FormData(loginForm);
    const { session } = await articleService.signIn(form.get("email").trim(), form.get("password"));
    if (!showEditor(session)) {
      await articleService.signOut();
      throw new Error("当前账号不是站长。");
    }
    loginForm.reset();
    await loadOwnerConsole();
    setStatus("登录成功。");
  } catch (error) {
    setStatus(`登录失败：${error.message}`, true);
  } finally {
    button.disabled = false;
  }
});

articleForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (savingWork) return;
  const button = articleForm.querySelector(".publish-button");
  const form = new FormData(articleForm);
  const slug = form.get("slug").trim();
  const contentType = form.get("contentType");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    setStatus("网址标识只能包含小写字母、数字和连字符。", true);
    return;
  }
  const selectedVideo = articleForm.elements.videoFile.files[0];
  const videoError = validateVideoFile(selectedVideo);
  if (videoError) {
    setStatus(videoError, true);
    return;
  }
  if (contentType === "video" && !selectedVideo && !form.get("videoUrl").trim() && !editingArticle?.video_url) {
    setStatus("请上传视频或填写视频直链。", true);
    return;
  }
  if (hasEpisodeConflict()) {
    setStatus("该系列中已存在相同集数，请调整集数后再保存。", true);
    return;
  }

  let coverSelection;
  try { coverSelection = window.adminCover.selection(); }
  catch (error) { setStatus(error.message, true); return; }
  savingWork = true;
  articleForm.inert = true;
  clearTimeout(autosaveTimer);
  const savedDraftKey = draftKey();
  button.disabled = true;
  setStatus("正在保存作品……");
  let newAttachments = [];
  let uploadedVideo = null;
  let committed = false;
  try {
    const session = await articleService.getSession();
    if (!session) throw new Error("登录已过期，请重新登录。");
    const files = [...articleForm.elements.attachments.files];
    newAttachments = files.length ? await articleService.uploadFiles(files, session.user.id) : [];
    let coverAttachment = coverSelection.attachment;
    if (coverSelection.file) {
      const uploaded = await articleService.uploadFiles([coverSelection.file], session.user.id);
      coverAttachment = { ...uploaded[0], role: "cover" };
      newAttachments.push(coverAttachment);
    }
    if (selectedVideo) uploadedVideo = await uploadSelectedVideo(selectedVideo, session);

    const removedIndexes = new Set(form.getAll("removeAttachment").map(Number));
    const oldAttachments = editingArticle?.attachments || [];
    const removedAttachments = oldAttachments.filter((file, index) => removedIndexes.has(index) || (file.role === "cover" && file.path && file.path !== coverAttachment?.path));
    const attachments = oldAttachments.filter((file, index) => !removedIndexes.has(index) && file.role !== "cover").concat(newAttachments.filter(file => file.role !== "cover"));
    if (coverAttachment) attachments.unshift(coverAttachment);
    const scheduledAt = form.get("scheduledAt") ? new Date(form.get("scheduledAt")).toISOString() : null;
    const directVideoUrl = form.get("videoUrl").trim();
    const values = {
      title: form.get("title").trim(),
      slug,
      excerpt: form.get("excerpt").trim(),
      content: form.get("content").trim(),
      category: form.get("category").trim() || (contentType === "video" ? "视频" : "随笔"),
      tags: form.get("tags").split(/[,，]/).map((tag) => tag.trim()).filter(Boolean),
      attachments,
      content_type: contentType,
      video_url: contentType === "video" ? (uploadedVideo?.url || directVideoUrl || editingArticle?.video_url) : null,
      video_path: contentType === "video" ? (uploadedVideo?.path || editingArticle?.video_path || null) : null,
      video_name: contentType === "video" ? (uploadedVideo?.name || editingArticle?.video_name || null) : null,
      video_poster: contentType === "video" ? (coverAttachment?.url || articleService.firstImage({ attachments })?.url || null) : null,
      series_name: form.get("seriesName").trim() || null,
      episode_number: form.get("episodeNumber") ? Number(form.get("episodeNumber")) : null,
      duration_seconds: contentType === "video" && form.get("durationSeconds") ? Number(form.get("durationSeconds")) : null,
      published: form.get("published") === "true",
      scheduled_at: scheduledAt,
      published_at: editingArticle?.published_at || scheduledAt || new Date().toISOString(),
    };
    const wasEditing = Boolean(editingArticle);
    const oldVideoPath = editingArticle?.video_path;
    const article = wasEditing
      ? await articleService.updateArticle(editingArticle.id, values)
      : await articleService.publishArticle({ ...values, author_id: session.user.id });
    committed = true;
    if (removedAttachments.length) await articleService.removeFiles(removedAttachments).catch(() => {});
    if (uploadedVideo && oldVideoPath && oldVideoPath !== uploadedVideo.path) {
      await articleService.removeVideo({ path: oldVideoPath }).catch(() => {});
    }
    savingWork = false;
    resetEditor(contentType);
    localStorage.removeItem(savedDraftKey);
    await loadAdminArticles();
    setStatus(wasEditing ? "作品修改已保存。" : values.published ? "作品已发布。" : "草稿已保存。");
    if (values.published && (!scheduledAt || new Date(scheduledAt) <= new Date())) {
      window.location.href = articleService.articleUrl(article);
    }
  } catch (error) {
    if (!committed && newAttachments.length) await articleService.removeFiles(newAttachments).catch(() => {});
    if (!committed && uploadedVideo) await articleService.removeVideo(uploadedVideo).catch(() => {});
    setStatus(`${committed ? "作品已保存，但刷新失败" : "保存失败"}：${error.message}`, true);
  } finally {
    savingWork = false;
    articleForm.inert = false;
    button.disabled = false;
  }
});

document.querySelectorAll("[data-admin-target]").forEach((button) => {
  button.addEventListener("click", () => switchPanel(button.dataset.adminTarget));
});
document.querySelectorAll("[data-new-work]").forEach((button) => {
  button.addEventListener("click", () => openNewWork(button.dataset.newWork));
});
document.querySelectorAll("[data-work-filter]").forEach((button) => {
  button.addEventListener("click", () => {
    workFilter = button.dataset.workFilter;
    document.querySelectorAll("[data-work-filter]").forEach((item) => item.classList.toggle("active", item === button));
    renderArticleList();
  });
});
let adminWorkSearchTimer = null;
adminWorkSearch?.addEventListener("input", () => {
  clearTimeout(adminWorkSearchTimer);
  adminWorkSearchTimer = setTimeout(renderArticleList, 150);
});
adminCategoryFilter?.addEventListener("change", renderArticleList);
adminSeriesFilter?.addEventListener("change", renderArticleList);
adminSortWorks?.addEventListener("change", renderArticleList);
selectVisibleWorks?.addEventListener("click", () => {
  visibleAdminWorks.filter((article) => !article.deleted_at).forEach((article) => selectedWorks.add(article.id));
  renderArticleList();
});
clearSelectedWorks?.addEventListener("click", () => {
  selectedWorks.clear();
  renderArticleList();
});

document.querySelector("#bulkTrashButton").addEventListener("click", async () => {
  const targets = articles.filter((article) => selectedWorks.has(article.id) && !article.deleted_at);
  if (!targets.length) {
    setStatus("请先选择要移入回收站的作品。", true);
    return;
  }
  if (!await confirmAction(`将选中的 ${targets.length} 个作品移入回收站吗？`, true)) return;
  await Promise.all(targets.map((article) => articleService.deleteArticle(article.id)));
  selectedWorks.clear();
  await loadAdminArticles();
  setStatus("选中作品已移入回收站。");
});
articleForm.elements.contentType.forEach((radio) => radio.addEventListener("change", updateEditorMode));
["category", "seriesName", "tags"].forEach((name) => {
  const input = articleForm.elements[name];
  input.addEventListener("input", () => {
    refreshEditorSuggestionPanels();
    if (name === "seriesName") updateEpisodeHelper();
  });
  input.addEventListener("focus", refreshEditorSuggestionPanels);
  input.addEventListener("blur", () => {
    window.setTimeout(() => input.parentElement.querySelectorAll(".admin-suggestion-panel").forEach((panel) => panel.classList.remove("is-open")), 140);
  });
});
articleForm.elements.episodeNumber.addEventListener("input", () => {
  if (hasEpisodeConflict()) setStatus("该集数已被同系列其他视频占用。", true);
});
articleForm.elements.videoFile.addEventListener("change", () => {
  const file = articleForm.elements.videoFile.files[0];
  lastVideoFile = file || null;
  if (!file) {
    renderUploadProgress();
    return;
  }
  renderUploadProgress({ file, status: "waiting", percent: 0, uploadedBytes: 0, totalBytes: file.size });
  const videoError = validateVideoFile(file);
  if (videoError) {
    setStatus(videoError, true);
    return;
  }
  const probe = document.createElement("video");
  probe.preload = "metadata";
  probe.onloadedmetadata = () => {
    articleForm.elements.durationSeconds.value = Math.round(probe.duration) || "";
    URL.revokeObjectURL(probe.src);
  };
  probe.src = URL.createObjectURL(file);
});
cancelVideoUpload?.addEventListener("click", async () => {
  currentVideoUpload?.controller.abort();
  await currentVideoUpload?.uploader.abort();
});
retryVideoUpload?.addEventListener("click", () => {
  if (!lastVideoFile) return;
  retryVideoUpload.hidden = true;
  renderUploadProgress({ file: lastVideoFile, status: "waiting", percent: 0, uploadedBytes: 0, totalBytes: lastVideoFile.size });
});
window.addEventListener("beforeunload", (event) => {
  if (!currentVideoUpload) return;
  event.preventDefault();
  event.returnValue = "";
});
articleForm.elements.content.addEventListener("input", renderMarkdownPreview);

function draftKey() {
  return `hutao-editor-draft-${editingArticle?.id || selectedContentType()}`;
}

function saveLocalDraft() {
  const data = {};
  ["contentType", "title", "slug", "excerpt", "category", "tags", "published", "scheduledAt", "videoUrl", "videoPoster", "seriesName", "episodeNumber", "durationSeconds", "content"]
    .forEach((name) => { data[name] = articleForm.elements[name]?.value || ""; });
  data.coverData = window.adminCover.draft();
  try { localStorage.setItem(draftKey(), JSON.stringify(data)); }
  catch (_) {
    document.querySelector("#autosaveStatus").textContent = "本地存储空间不足，请及时保存作品（封面尚未备份）";
    return;
  }
  document.querySelector("#autosaveStatus").textContent = `已自动保存 ${new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}`;
  document.querySelector("#restoreDraftButton").hidden = false;
}

articleForm.addEventListener("input", () => {
  clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(saveLocalDraft, 700);
});

document.querySelector("#restoreDraftButton").addEventListener("click", () => {
  const raw = localStorage.getItem(draftKey()) || localStorage.getItem(`hutao-editor-draft-${selectedContentType()}`);
  if (!raw) return;
  const draft = JSON.parse(raw);
  Object.entries(draft).forEach(([name, value]) => {
    if (articleForm.elements[name]) articleForm.elements[name].value = value;
  });
  window.adminCover.restore(draft.coverData);
  updateEditorMode();
  renderMarkdownPreview();
  setStatus("本地草稿已恢复。");
});
document.querySelector("#cancelEditButton").addEventListener("click", () => resetEditor(selectedContentType()));
logoutButton.addEventListener("click", async () => {
  await articleService.signOut();
  resetEditor();
  showEditor(null);
  setStatus("已退出登录。");
});

async function initialize() {
  if (!articleService.configured) {
    setStatus("请先在 supabase-config.js 中填写项目地址和 anon key。", true);
    loginForm.querySelector("button").disabled = true;
    return;
  }
  try {
    const session = await articleService.getSession();
    if (session && !showEditor(session)) {
      await articleService.signOut();
      setStatus("当前账号不是站长。", true);
      return;
    }
    if (session) await loadOwnerConsole();
  } catch (error) {
    setStatus(error.message, true);
  }
}

resetEditor();
initialize();
