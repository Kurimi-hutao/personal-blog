const videoList = document.querySelector("#videoList");
const videoSearch = document.querySelector("#videoSearch");
const videoCategory = document.querySelector("#videoCategory");
const clearVideoFilters = document.querySelector("#clearVideoFilters");

let videos = [];
let videoFilterTimer = null;
let videoFiltersReady = false;

function renderVideoState(title, detail) {
  videoList.replaceChildren();
  const state = document.createElement("div");
  state.className = "hutao-state article-state";
  const heading = document.createElement("strong");
  heading.textContent = title;
  const copy = document.createElement("span");
  copy.textContent = detail;
  state.append(heading, copy);
  videoList.appendChild(state);
}

function withTimeout(promise, message) {
  return Promise.race([
    promise,
    new Promise((_, reject) => window.setTimeout(() => reject(new Error(message)), 10000)),
  ]);
}

function createVideoCard(video) {
  const link = document.createElement("a");
  link.className = "video-card reveal";
  link.href = articleService.articleUrl(video);

  const visual = document.createElement("div");
  visual.className = "video-card-visual";
  const poster = video.video_poster || articleService.firstImage(video)?.url;
  const fallback = document.createElement("span");
  fallback.className = "video-no-poster";
  fallback.textContent = "影像未题图";
  visual.appendChild(fallback);
  if (poster) {
    const image = document.createElement("img");
    image.src = poster;
    image.alt = "";
    image.loading = "lazy";
    image.addEventListener("load", () => { fallback.hidden = true; });
    image.addEventListener("error", () => { image.remove(); fallback.hidden = false; });
    visual.appendChild(image);
  }
  const play = document.createElement("span");
  play.className = "media-play-button";
  play.setAttribute("aria-hidden", "true");
  const playIcon = document.createElement("span");
  playIcon.className = "media-play-button__icon";
  play.appendChild(playIcon);
  visual.appendChild(play);

  const copy = document.createElement("div");
  copy.className = "video-card-copy";
  const meta = document.createElement("p");
  const series = video.series_name
    ? ` · ${video.series_name}${video.episode_number ? ` 第 ${video.episode_number} 集` : ""}`
    : "";
  meta.textContent = `${video.category || "视频"} · ${articleService.formatDate(video.published_at)}${series}`;
  const title = document.createElement("h2");
  title.textContent = video.title || "未题视频";
  const excerpt = document.createElement("p");
  excerpt.textContent = video.excerpt || "这段影像还没有写下简介。";
  const stats = document.createElement("span");
  const duration = video.duration_seconds
    ? ` · ${Math.floor(video.duration_seconds / 60)}:${String(video.duration_seconds % 60).padStart(2, "0")}`
    : "";
  stats.textContent = `${video.view_count || 0} 次播放 · ${video.like_count || 0} 人点赞${duration}`;

  copy.append(title, meta, excerpt, stats);
  link.append(visual, copy);
  return link;
}

function filteredVideos() {
  const keyword = videoSearch.value.trim().toLowerCase();
  const category = videoCategory.value;
  return videos.filter((video) => {
    const title = video.title || "";
    const excerpt = video.excerpt || "";
    return (
      (!keyword || title.toLowerCase().includes(keyword) || excerpt.toLowerCase().includes(keyword)) &&
      (!category || video.category === category)
    );
  });
}

function renderVideoDom(filtered) {
  videoList.replaceChildren();
  if (!filtered.length) {
    renderVideoState("未寻得合卷视频", "换一个关键词或分类再试试，新的影像会在这里归档。");
    return;
  }
  filtered.forEach((video) => videoList.appendChild(createVideoCard(video)));
}

function renderVideos(options = {}) {
  const filtered = filteredVideos();
  const render = () => renderVideoDom(filtered);
  if (options.immediate || !videoFiltersReady || !window.MotionCore?.animateListUpdate) {
    render();
    return;
  }
  window.MotionCore.animateListUpdate(videoList, render);
}

function scheduleRenderVideos(delay = 150) {
  window.clearTimeout(videoFilterTimer);
  videoFilterTimer = window.setTimeout(() => renderVideos(), delay);
}

async function loadVideos() {
  if (!articleService.configured) {
    renderVideoState("视频卷宗暂未开启", "当前视频服务尚未完成配置，页面结构已就绪，不会再停留在读取状态。");
    return;
  }

  try {
    videos = await withTimeout(articleService.listPublished(null, { contentType: "video" }), "视频服务响应超时");
    videoCategory.querySelectorAll("option:not(:first-child)").forEach((option) => option.remove());
    [...new Set(videos.map((video) => video.category).filter(Boolean))].forEach((category) => {
      const option = document.createElement("option");
      option.value = category;
      option.textContent = category;
      videoCategory.appendChild(option);
    });
    window.MotionCore?.setupCustomSelects?.(document.querySelector(".article-filters"));
    videoFiltersReady = true;
    renderVideos({ immediate: true });
  } catch (error) {
    renderVideoState("视频读取暂时受阻", error.message || "稍后再试，或检查视频服务配置。");
  }
}

videoSearch.addEventListener("input", () => scheduleRenderVideos(150));
videoCategory.addEventListener("change", () => renderVideos());
clearVideoFilters.addEventListener("click", () => {
  videoSearch.value = "";
  videoCategory.value = "";
  videoCategory.dispatchEvent(new Event("change", { bubbles: true }));
  renderVideos();
});

loadVideos();
