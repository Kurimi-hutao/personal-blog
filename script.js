const homeMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
let reducedMotion = homeMotionQuery.matches;
const ambientMotions = new Set();
const hasGsap = typeof window.gsap !== "undefined";
const field = document.querySelector("#petalField");
const header = document.querySelector(".site-header");
const windToggle = document.querySelector("#windToggle");
const windLabel = windToggle.querySelector(".wind-label");
const summonButton = document.querySelector("#summonPetals");
const cursor = document.querySelector(".ink-cursor");
const cursorRing = document.querySelector(".ink-cursor-ring");
const cursorDot = document.querySelector(".ink-cursor-dot");
const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
const compactMotion = window.matchMedia("(max-width: 840px), (pointer: coarse)").matches;
const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
const saveData = connection?.saveData === true;
const lowPowerDevice =
  saveData ||
  (Number.isFinite(navigator.deviceMemory) && navigator.deviceMemory <= 4) ||
  (Number.isFinite(navigator.hardwareConcurrency) && navigator.hardwareConcurrency <= 4);

let windActive = false;
let windStrength = 0;
let ownerSession = null;
const pieces = new Set();
const pointer = { x: -1000, y: -1000 };
let lastCursorTrailAt = 0;
let lastTrailPoint = null;
let cursorIdleTimer = 0;

const random = (min, max) => Math.random() * (max - min) + min;
if (hasGsap && !reducedMotion) document.documentElement.classList.add("motion-ready");

function withTimeout(promise, ms = 7000) {
  return Promise.race([
    promise,
    new Promise((_, reject) => window.setTimeout(() => reject(new Error("请求超时")), ms)),
  ]);
}

function readCachedWorks(key) {
  try {
    const cached = JSON.parse(localStorage.getItem(key) || "null");
    if (Array.isArray(cached?.items)) return cached.items;
  } catch {
    localStorage.removeItem(key);
  }
  return [];
}

function writeCachedWorks(key, items) {
  try {
    localStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), items }));
  } catch {}
}

function revealInsertedCards(container) {
  container.querySelectorAll(".reveal").forEach((element) => {
    element.classList.add("is-visible");
  });
}

function createHomepageArticleCard(article, index) {
  const card = document.createElement("article");
  const cover = articleService.firstImage(article);
  card.className = `article-card ${index === 0 ? "featured" : ""} reveal`;

  const visual = document.createElement("div");
  visual.className = `card-visual ${cover ? "article-cover" : index === 0 ? "peach-mountain" : "moon-lake"}`;
  if (cover) {
    const image = document.createElement("img");
    image.src = cover.url;
    image.alt = "";
    image.loading = "lazy";
    visual.appendChild(image);
  } else if (index === 0) {
    const mountain = document.createElement("div");
    mountain.className = "ink-mountain";
    mountain.setAttribute("aria-hidden", "true");
    visual.appendChild(mountain);
  } else {
    const moon = document.createElement("div");
    moon.className = "moon";
    moon.setAttribute("aria-hidden", "true");
    visual.appendChild(moon);
  }

  const badge = document.createElement("span");
  badge.className = "card-index";
  badge.textContent = index === 0 ? "新" : "次";
  visual.prepend(badge);
  const views = document.createElement("span");
  views.className = "cover-view-count";
  views.textContent = `${article.view_count || 0} 次阅读`;
  visual.appendChild(views);

  const content = document.createElement("div");
  content.className = "card-content";
  const meta = document.createElement("div");
  meta.className = "article-meta";
  const category = document.createElement("span");
  category.textContent = article.category || "最新文章";
  const time = document.createElement("time");
  time.dateTime = article.published_at;
  time.textContent = articleService.formatDate(article.published_at);
  meta.append(category, time);

  const title = document.createElement("h3");
  title.textContent = article.title;
  const excerpt = document.createElement("p");
  excerpt.textContent = article.excerpt;
  const link = document.createElement("a");
  link.href = articleService.articleUrl(article);
  link.innerHTML = "展开此卷 <span>→</span>";
  content.append(meta, title, excerpt, link);
  card.append(visual, content);
  return card;
}

async function loadSiteVisitCount() {
  const counter = document.querySelector("#siteVisitCount");
  if (!counter || !articleService.configured) {
    if (counter) counter.textContent = "总访问量 · 尚未配置";
    return;
  }
  try {
    const total = await articleService.recordSiteVisit();
    counter.textContent = `总访问量 · ${total.toLocaleString("zh-CN")}`;
  } catch {
    counter.textContent = "总访问量 · 暂不可用";
  }
}

async function loadHomepageArticles() {
  const container = document.querySelector("#latestArticles");
  if (!container || !window.articleService) return;

  if (!articleService.configured) {
    container.dataset.fallbackReason = "not-configured";
    return;
  }

  try {
    const articles = await withTimeout(articleService.listPublished(2, { contentType: "article" }));
    container.replaceChildren();
    if (!articles.length) {
      container.innerHTML = '<p class="article-state">还没有发布文章，第一卷正在酝酿中。</p>';
      return;
    }
    writeCachedWorks("hutao-homepage-articles", articles);
    articles.forEach((article, index) => container.appendChild(createHomepageArticleCard(article, index)));
    revealInsertedCards(container);
    setupInkHoverEffects();
  } catch (error) {
    const cached = readCachedWorks("hutao-homepage-articles");
    if (cached.length) {
      container.replaceChildren();
      cached.slice(0, 2).forEach((article, index) => container.appendChild(createHomepageArticleCard(article, index)));
      revealInsertedCards(container);
      setupInkHoverEffects();
      return;
    }
    const note = document.createElement("p");
    note.className = "article-state";
    note.textContent = "文章暂时读取失败，已保留备用入口。";
    container.appendChild(note);
  }
}

function createHomepageVideoCard(video) {
  const card = document.createElement("a");
  card.className = "home-video-card reveal";
  card.href = articleService.articleUrl(video);
  const visual = document.createElement("div");
  visual.className = "home-video-visual";
  const poster = video.video_poster || articleService.firstImage(video)?.url;
  if (poster) {
    const image = document.createElement("img");
    image.src = poster;
    image.alt = "";
    image.loading = "lazy";
    visual.appendChild(image);
  }
  const play = document.createElement("span");
  play.className = "media-play-button";
  play.textContent = "▶";
  play.setAttribute("aria-hidden", "true");
  const playIcon = document.createElement("span");
  playIcon.className = "media-play-button__icon";
  play.appendChild(playIcon);
  visual.appendChild(play);
  const copy = document.createElement("div");
  const meta = document.createElement("small");
  meta.textContent = `${video.category || "视频"} · ${video.view_count || 0} 次播放`;
  const title = document.createElement("h3");
  title.textContent = video.title;
  const excerpt = document.createElement("p");
  excerpt.textContent = video.excerpt;
  copy.append(meta, title, excerpt);
  card.append(visual, copy);
  return card;
}

async function loadHomepageVideos() {
  const container = document.querySelector("#latestVideos");
  if (!container || !articleService.configured) return;
  try {
    const videos = await withTimeout(articleService.listPublished(2, { contentType: "video" }));
    container.replaceChildren();
    if (!videos.length) {
      container.innerHTML = '<p class="article-state">还没有发布视频，第一段影像正在路上。</p>';
      return;
    }
    writeCachedWorks("hutao-homepage-videos", videos);
    videos.forEach((video) => container.appendChild(createHomepageVideoCard(video)));
    revealInsertedCards(container);
    setupInkHoverEffects();
  } catch (error) {
    const cached = readCachedWorks("hutao-homepage-videos");
    if (cached.length) {
      container.replaceChildren();
      cached.slice(0, 2).forEach((video) => container.appendChild(createHomepageVideoCard(video)));
      revealInsertedCards(container);
      setupInkHoverEffects();
      return;
    }
    const note = document.createElement("p");
    note.className = "article-state";
    note.textContent = "视频暂时读取失败，已保留备用入口。";
    container.appendChild(note);
  }
}

function renderAchievements(result) {
  const total = Number(result?.total_days || 0);
  const streak = Number(result?.streak || 0);
  const cards = [...document.querySelectorAll("#achievementCards article")];
  cards[0]?.classList.toggle("unlocked", total >= 1);
  cards[1]?.classList.toggle("unlocked", streak >= 3);
  cards[2]?.classList.toggle("unlocked", total >= 7);
  document.querySelector("#achievementStatus").textContent =
    `累计签到 ${total} 天 · 当前连续 ${streak} 天`;
  const button = document.querySelector("#checkinButton");
  button.textContent = articleService.checkedInToday() ? "查看今日运势" : "今日签到";
  button.disabled = false;
}

const fortuneRanks = ["下下吉", "下吉", "中吉", "上吉", "上上吉"];
const fortuneGoodPool = [
  "写下新的灵感",
  "与故友闲谈",
  "整理旧日收藏",
  "听风看云",
  "开启一局游戏",
  "品一盏清茶",
  "完成搁置的小事",
  "早些休息",
  "去有花木的地方",
  "分享真诚的赞美",
];
const fortuneBadPool = [
  "冲动做决定",
  "与人争一时长短",
  "熬夜逞强",
  "空腹饮浓茶",
  "反复纠结旧事",
  "急于求成",
  "忘记回复消息",
  "临时改变计划",
  "把情绪藏得太深",
  "沉迷下一局",
];
const fortuneVerses = [
  "桃枝轻动，旧愿正在风里悄悄发芽。",
  "山路虽有薄雾，慢行自会遇见清光。",
  "今日宜守心定气，转角处自有好消息。",
  "一瓣桃花落入砚中，寻常小事也能成诗。",
  "风从远山来，带走迟疑，也带来新缘。",
  "不必追赶所有答案，水到之处自成溪。",
  "刀光可避，花期莫负，今日当尽兴而归。",
];

function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function pickFortuneItems(pool, count) {
  const copy = [...pool];
  const selected = [];
  while (selected.length < count && copy.length) {
    selected.push(copy.splice(Math.floor(Math.random() * copy.length), 1)[0]);
  }
  return selected;
}

function getTodayFortune() {
  const key = "hutao-daily-fortune";
  const today = localDateKey();
  try {
    const cached = JSON.parse(localStorage.getItem(key) || "null");
    if (cached?.date === today) return cached;
  } catch {
    localStorage.removeItem(key);
  }

  const fortune = {
    date: today,
    rank: fortuneRanks[Math.floor(Math.random() * fortuneRanks.length)],
    verse: fortuneVerses[Math.floor(Math.random() * fortuneVerses.length)],
    good: pickFortuneItems(fortuneGoodPool, 3),
    bad: pickFortuneItems(fortuneBadPool, 3),
  };
  localStorage.setItem(key, JSON.stringify(fortune));
  return fortune;
}

function showFortune() {
  const dialog = document.querySelector("#fortuneDialog");
  const fortune = getTodayFortune();
  const date = new Date(`${fortune.date}T12:00:00`);
  document.querySelector("#fortuneDate").textContent = new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(date);
  document.querySelector("#fortuneTitle").textContent = fortune.rank;
  document.querySelector("#fortuneVerse").textContent = fortune.verse;

  const renderList = (selector, items) => {
    const list = document.querySelector(selector);
    list.replaceChildren(...items.map((item) => {
      const entry = document.createElement("li");
      entry.textContent = item;
      return entry;
    }));
  };
  renderList("#fortuneGood", fortune.good);
  renderList("#fortuneBad", fortune.bad);

  if (!dialog.open) dialog.showModal();
  if (hasGsap && !reducedMotion) {
    gsap.fromTo(
      ".fortune-scroll",
      { scaleY: 0.72, scaleX: 0.92, y: 24, autoAlpha: 0, transformOrigin: "center top" },
      { scaleY: 1, scaleX: 1, y: 0, autoAlpha: 1, duration: 0.65, ease: "power3.out" },
    );
    gsap.from(".fortune-rank-wrap, .fortune-verse, .fortune-guidance section", {
      y: 18,
      autoAlpha: 0,
      stagger: 0.1,
      duration: 0.5,
      delay: 0.18,
      ease: "power2.out",
    });
  }
  summonPetals();
}

async function setupAchievements() {
  const button = document.querySelector("#checkinButton");
  if (!button) return;
  const cached = JSON.parse(localStorage.getItem("hutao-achievement-state") || "null");
  if (cached) renderAchievements(cached);
  else document.querySelector("#achievementStatus").textContent = "尚未签到，今天就从第一步开始。";
  if (articleService.checkedInToday()) {
    button.textContent = "查看今日运势";
  }
  button.addEventListener("click", async () => {
    if (articleService.checkedInToday()) {
      showFortune();
      return;
    }
    button.disabled = true;
    try {
      const result = articleService.configured
        ? await articleService.checkIn()
        : { total_days: 1, streak: 1 };
      if (!articleService.configured) {
        localStorage.setItem("hutao-last-checkin", localDateKey());
      }
      localStorage.setItem("hutao-achievement-state", JSON.stringify(result));
      renderAchievements(result);
      showFortune();
    } catch (error) {
      document.querySelector("#achievementStatus").textContent = `签到失败：${error.message}`;
      button.disabled = false;
    }
  });
}

function createClickEffect(x, y, source) {
  if (window.MotionCore?.createClickEffect) {
    window.MotionCore.createClickEffect(x, y, source);
    return;
  }
  if (!finePointer || reducedMotion || compactMotion) return;
  const ripple = document.createElement("i");
  ripple.className = "ink-click-ripple";
  ripple.style.setProperty("--click-x", `${x}px`);
  ripple.style.setProperty("--click-y", `${y}px`);
  ripple.style.setProperty("--click-size", "88px");
  ripple.style.setProperty("--click-duration", "380ms");
  document.body.appendChild(ripple);
  window.setTimeout(() => ripple.remove(), 460);
}

function createCursorTrail(x, y) {
  if (reducedMotion) return;
  const now = performance.now();
  if (now - lastCursorTrailAt < 34) return;
  lastCursorTrailAt = now;

  const previous = lastTrailPoint || { x, y };
  const dx = x - previous.x;
  const dy = y - previous.y;
  const distance = Math.hypot(dx, dy);
  const angle = Math.atan2(dy, dx) * 180 / Math.PI;
  lastTrailPoint = { x, y };
  if (distance < 2) return;

  const trail = document.createElement("i");
  trail.className = "ink-cursor-trail";
  trail.style.setProperty("--trail-length", `${Math.min(34, Math.max(12, distance * 0.82))}px`);
  trail.style.setProperty("--trail-width", `${Math.min(6, Math.max(3, 3 + distance * 0.05))}px`);
  document.body.appendChild(trail);

  gsap.set(trail, {
    x: previous.x + random(-1.5, 1.5),
    y: previous.y + random(-1.5, 1.5),
    xPercent: 0,
    yPercent: -50,
    rotation: angle + random(-4, 4),
    scaleX: 0.45,
    scaleY: random(0.82, 1.16),
    opacity: 0.48,
  });
  gsap.to(trail, {
    x: previous.x - dx * 0.12,
    y: previous.y - dy * 0.12 + random(2, 6),
    scaleX: 1,
    scaleY: 0.3,
    opacity: 0,
    duration: 0.66,
    ease: "power2.out",
    onComplete: () => trail.remove(),
  });
}

function setupFlowingLandscape() {
  if (!hasGsap || compactMotion || lowPowerDevice) return;
  const hero = document.querySelector(".hero");
  const far = document.querySelector(".landscape-far");
  const near = document.querySelector(".landscape-near");
  const mists = document.querySelectorAll(".landscape-mist");
  if (!hero || !far || !near) return;

  const motion = gsap.timeline({ repeat: -1, yoyo: true, defaults: { ease: "sine.inOut" } });
  ambientMotions.add(motion);
  motion
    .to(far, { xPercent: -2.2, yPercent: 1.2, scaleX: 1.025, duration: 16 }, 0)
    .to(near, { xPercent: 2.8, yPercent: -1.5, scaleX: 1.035, duration: 13 }, 0)
    .to(mists, { xPercent: (index) => index ? 16 : -12, autoAlpha: (index) => index ? 0.28 : 0.5, duration: 11, stagger: 1.2 }, 0);

  const visibilityObserver = new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting && !document.hidden && !reducedMotion) motion.resume();
    else motion.pause();
  }, { threshold: 0.05 });
  visibilityObserver.observe(hero);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden || reducedMotion) motion.pause();
    else if (hero.getBoundingClientRect().bottom > 0) motion.resume();
  });
}

function setupAmbientInk() {
  if (!hasGsap || compactMotion || lowPowerDevice) return;
  const drifts = gsap.utils.toArray(".ink-drift");
  if (!drifts.length) return;

  drifts.forEach((drift, index) => {
    ambientMotions.add(gsap.to(drift, {
      xPercent: index % 2 ? -18 : 20,
      yPercent: index % 2 ? 14 : -12,
      rotation: index % 2 ? "+=9" : "-=8",
      scale: index === 1 ? 1.28 : 1.08,
      opacity: index === 1 ? 0.34 : 0.44,
      duration: 14 + index * 3,
      repeat: -1,
      yoyo: true,
      ease: "sine.inOut",
    }));
  });
}

function createPiece(options = {}) {
  if (reducedMotion || compactMotion || lowPowerDevice || !hasGsap || pieces.size > 28) return;

  const piece = document.createElement("span");
  const isPetal = options.type ? options.type === "petal" : Math.random() > 0.28;
  piece.className = `falling-piece ${isPetal ? "petal" : "leaf"}`;
  field.appendChild(piece);
  pieces.add(piece);

  const startX = options.x ?? random(-20, window.innerWidth + 20);
  const duration = options.duration ?? random(8, 16);
  const drift = random(-100, 150) + windStrength * random(0.6, 1.3);
  const rotation = random(180, 780) * (Math.random() > 0.5 ? 1 : -1);

  gsap.set(piece, {
    x: startX,
    y: options.y ?? -40,
    rotation: random(0, 180),
    scale: random(0.65, 1.3),
    opacity: random(0.45, 0.9),
  });

  const sway = gsap.to(piece, {
    x: `+=${drift}`,
    duration,
    ease: "sine.inOut",
  });

  const fall = gsap.to(piece, {
    y: window.innerHeight + 80,
    rotation: `+=${rotation}`,
    duration,
    ease: "none",
    onComplete: () => {
      sway.kill();
      pieces.delete(piece);
      piece.remove();
    },
  });

  piece._fallTween = fall;
  piece.addEventListener("pointerdown", (event) => {
    event.stopPropagation();
    burstPiece(piece);
  });
}

function burstPiece(piece) {
  if (!piece.isConnected) return;
  const rect = piece.getBoundingClientRect();
  pieces.delete(piece);
  gsap.killTweensOf(piece);
  piece.remove();

  for (let i = 0; i < 6; i += 1) {
    const dot = document.createElement("i");
    dot.style.cssText = `
      position: fixed;
      z-index: 16;
      left: ${rect.left + rect.width / 2}px;
      top: ${rect.top + rect.height / 2}px;
      width: ${random(2, 5)}px;
      height: ${random(2, 5)}px;
      border-radius: 50%;
      background: ${piece.classList.contains("petal") ? "#b95c5b" : "#48513f"};
      pointer-events: none;
    `;
    document.body.appendChild(dot);
    gsap.to(dot, {
      x: random(-48, 48),
      y: random(-45, 40),
      scale: 0,
      opacity: 0,
      duration: random(0.5, 0.9),
      ease: "power2.out",
      onComplete: () => dot.remove(),
    });
  }
}

function summonPetals() {
  for (let i = 0; i < 18; i += 1) {
    window.setTimeout(
      () =>
        createPiece({
          type: "petal",
          x: random(window.innerWidth * 0.15, window.innerWidth * 0.85),
          y: random(-120, -20),
          duration: random(5, 9),
        }),
      i * 55,
    );
  }
}

function setWind(active) {
  windActive = active;
  windStrength = active ? 170 : 0;
  windToggle.setAttribute("aria-pressed", String(active));
  windLabel.textContent = active ? "风起" : "风止";

  if (hasGsap && !reducedMotion) {
    gsap.to(".wind-icon", {
      rotation: active ? 12 : 0,
      x: active ? 3 : 0,
      duration: 0.35,
    });
  }
}

function nudgeNearbyPieces() {
  if (!hasGsap || reducedMotion) return;
  pieces.forEach((piece) => {
    const rect = piece.getBoundingClientRect();
    const dx = rect.left - pointer.x;
    const dy = rect.top - pointer.y;
    const distance = Math.hypot(dx, dy);
    if (distance < 90) {
      const force = (90 - distance) / 90;
      gsap.to(piece, {
        x: `+=${(dx || 1) * force * 0.5}`,
        rotation: `+=${random(-70, 70)}`,
        duration: 0.45,
        overwrite: "auto",
      });
    }
  });
}

window.addEventListener("pointermove", (event) => {
  pointer.x = event.clientX;
  pointer.y = event.clientY;
  nudgeNearbyPieces();
});

window.addEventListener("pointerdown", (event) => {
  if (event.button !== 0) return;
  createClickEffect(event.clientX, event.clientY, event.target);
});

window.addEventListener(
  "scroll",
  () => {
    header.classList.toggle("scrolled", window.scrollY > 40);
  },
  { passive: true },
);

windToggle.addEventListener("click", () => setWind(!windActive));
summonButton.addEventListener("click", summonPetals);

function renderGuestbook(messages) {
  const list = document.querySelector("#guestbookList");
  list.replaceChildren();
  messages.forEach((message) => {
    const item = document.createElement("article");
    const header = document.createElement("div");
    const name = document.createElement("strong");
    name.textContent = message.visitor_name;
    const time = document.createElement("time");
    time.dateTime = message.created_at;
    time.textContent = articleService.formatDate(message.created_at);
    const meta = document.createElement("span");
    meta.className = "guestbook-meta";
    meta.appendChild(time);
    if (articleService.isOwner(ownerSession)) {
      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.className = "guestbook-delete";
      deleteButton.textContent = "删除";
      deleteButton.setAttribute("aria-label", `删除 ${message.visitor_name} 的留言`);
      deleteButton.addEventListener("click", () => removeGuestbookMessage(message, deleteButton));
      meta.appendChild(deleteButton);
    }
    header.append(name, meta);
    const body = document.createElement("p");
    body.textContent = message.body;
    item.append(header, body);
    list.appendChild(item);
  });
}

async function removeGuestbookMessage(message, button) {
  if (!window.confirm(`确定删除 ${message.visitor_name} 的这条留言吗？`)) return;
  const note = document.querySelector("#formNote");
  button.disabled = true;
  note.textContent = "正在拂去这笔墨迹……";
  try {
    await articleService.deleteMessage(message.id);
    note.textContent = "留言已删除。";
    await loadGuestbook();
  } catch (error) {
    note.textContent = `删除失败：${error.message}`;
    button.disabled = false;
  }
}

async function loadGuestbook() {
  if (!articleService.configured) return;
  try {
    renderGuestbook(await articleService.listMessages());
  } catch (error) {
    document.querySelector("#formNote").textContent = `留言读取失败：${error.message}`;
  }
}

async function initializeGuestbook() {
  if (!articleService.configured) return;
  try {
    ownerSession = await articleService.getSession();
  } catch {
    ownerSession = null;
  }
  await loadGuestbook();
}

document.querySelector("#messageForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const note = document.querySelector("#formNote");
  const form = event.currentTarget;
  const button = form.querySelector("button");
  const values = new FormData(form);
  const name = values.get("name").trim();
  button.disabled = true;
  note.textContent = "正在落印……";
  try {
    await articleService.createMessage({
      visitor_name: name,
      body: values.get("message").trim(),
      visitor_token: articleService.getVisitorToken(),
    });
    note.textContent = `${name}的墨迹，已留在这卷江湖里。`;
    form.reset();
    await loadGuestbook();
  } catch (error) {
    note.textContent = `留言失败：${error.message}`;
  } finally {
    button.disabled = false;
  }

  if (hasGsap && !reducedMotion) {
    gsap.fromTo(note, { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: 0.45 });
  }
});

const lightbox = document.querySelector("#imageLightbox");
const lightboxImage = lightbox.querySelector("img");
const fortuneDialog = document.querySelector("#fortuneDialog");

document.querySelectorAll("[data-gallery-src]").forEach((button) => {
  button.addEventListener("click", () => {
    lightboxImage.src = button.dataset.gallerySrc;
    lightboxImage.alt = button.dataset.galleryAlt;
    lightbox.showModal();
  });
});

lightbox.querySelector(".lightbox-close").addEventListener("click", () => lightbox.close());
lightbox.addEventListener("click", (event) => {
  if (event.target === lightbox) lightbox.close();
});

fortuneDialog.querySelector(".fortune-close").addEventListener("click", () => fortuneDialog.close());
fortuneDialog.addEventListener("click", (event) => {
  if (event.target === fortuneDialog) fortuneDialog.close();
});

function setupInkHoverEffects() {
  if (!finePointer || reducedMotion) return;
  const targets = document.querySelectorAll(
    ".article-card, .home-video-card, .portal-card, .achievement-cards article",
  );
  targets.forEach((target) => {
    if (target.classList.contains("ink-reactive")) return;
    target.classList.add("ink-reactive");
    target.addEventListener("pointermove", (event) => {
      const rect = target.getBoundingClientRect();
      target.style.setProperty("--ink-x", `${event.clientX - rect.left}px`);
      target.style.setProperty("--ink-y", `${event.clientY - rect.top}px`);
      target.style.setProperty("--ink-opacity", "1");
    });
    target.addEventListener("pointerleave", () => {
      target.style.setProperty("--ink-opacity", "0");
    });
  });

}

function setupLinksToggle() {
  const section = document.querySelector(".links-section");
  const button = document.querySelector("#linksToggle");
  if (!section || !button) return;
  button.addEventListener("click", () => {
    const open = !section.classList.contains("is-expanded");
    section.classList.toggle("is-expanded", open);
    button.setAttribute("aria-expanded", String(open));
    button.textContent = open ? "收起入口" : "展开全部入口";
  });
}

if (hasGsap) {
  if (finePointer && !lowPowerDevice) {
    document.documentElement.classList.add("cursor-ready");
    const cursorX = gsap.quickTo(cursor, "x", { duration: 0.12, ease: "power3.out" });
    const cursorY = gsap.quickTo(cursor, "y", { duration: 0.12, ease: "power3.out" });

    window.addEventListener("pointermove", (event) => {
      if (reducedMotion) return;
      cursorX(event.clientX);
      cursorY(event.clientY);
      createCursorTrail(event.clientX, event.clientY);
      cursor.classList.remove("is-idle");
      gsap.to(cursor, { autoAlpha: 1, duration: 0.15, overwrite: "auto" });
      window.clearTimeout(cursorIdleTimer);
      cursorIdleTimer = window.setTimeout(() => {
        cursor.classList.add("is-idle");
        gsap.to(cursor, { autoAlpha: 0, duration: 0.45, overwrite: "auto" });
      }, 1200);
    });

    document.addEventListener("pointerover", (event) => {
      if (reducedMotion) return;
      const interactive = event.target.closest("a, button, input, textarea, .falling-piece");
      gsap.to(cursorRing, {
        scale: interactive ? 1.55 : 1,
        rotation: interactive ? 18 : 0,
        borderColor: interactive ? "var(--cinnabar)" : "var(--ink)",
        duration: 0.25,
        overwrite: "auto",
      });
      gsap.to(cursorDot, {
        scale: interactive ? 0.72 : 1,
        backgroundColor: interactive ? "var(--cinnabar)" : "var(--ink)",
        duration: 0.2,
        overwrite: "auto",
      });
    });

    document.documentElement.addEventListener("mouseleave", () => {
      if (reducedMotion) return;
      lastTrailPoint = null;
      gsap.to(cursor, { autoAlpha: 0, duration: 0.2 });
    });
  }

  ambientMotions.add(gsap.to(".scroll-cue i", {
    scaleY: 0.45,
    transformOrigin: "top",
    repeat: -1,
    yoyo: true,
    duration: 1.25,
    ease: "sine.inOut",
  }));

  window.setInterval(() => {
    if (!document.hidden) createPiece();
  }, 750);

  for (let i = 0; i < 9; i += 1) {
    window.setTimeout(createPiece, i * 280);
  }
}

function runWhenIdle(task, timeout = 1600) {
  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(() => task(), { timeout });
    return;
  }
  window.setTimeout(task, Math.min(timeout, 600));
}

function runWhenNear(selector, task, rootMargin = "320px 0px") {
  const target = document.querySelector(selector);
  if (!target || !("IntersectionObserver" in window)) {
    task();
    return;
  }

  let completed = false;
  const observer = new IntersectionObserver((entries) => {
    if (completed || !entries.some((entry) => entry.isIntersecting)) return;
    completed = true;
    observer.disconnect();
    task();
  }, { rootMargin, threshold: 0 });

  observer.observe(target);
}

runWhenIdle(loadHomepageArticles, 1200);
runWhenNear(".home-videos-section", loadHomepageVideos);
runWhenIdle(loadSiteVisitCount, 2400);
runWhenNear(".message-section", initializeGuestbook, "420px 0px");
setupAchievements();
setupInkHoverEffects();
setupFlowingLandscape();
setupAmbientInk();
setupLinksToggle();

function applyHomeMotionPreference() {
  reducedMotion = homeMotionQuery.matches;
  document.documentElement.classList.toggle("cursor-ready", !reducedMotion && finePointer && !lowPowerDevice);
  ambientMotions.forEach((motion) => motion.paused(reducedMotion || document.hidden));
  if (!reducedMotion || !hasGsap) return;
  pieces.forEach((piece) => { gsap.killTweensOf(piece); piece.remove(); });
  pieces.clear();
  document.querySelectorAll(".ink-cursor-trail").forEach((trail) => {
    gsap.killTweensOf(trail);
    trail.remove();
  });
  window.clearTimeout(cursorIdleTimer);
  gsap.killTweensOf([cursor, cursorRing, cursorDot, ".wind-icon"]);
  gsap.set(cursor, { autoAlpha: 0 });
  lastTrailPoint = null;
}
homeMotionQuery.addEventListener("change", applyHomeMotionPreference);
document.addEventListener("visibilitychange", applyHomeMotionPreference);
applyHomeMotionPreference();
