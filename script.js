const homeMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
let reducedMotion = homeMotionQuery.matches;
const hasGsap = typeof window.gsap !== "undefined";
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

let lastSummonAt = -Infinity;
let summonLevel = 0;
let previousWindX = null;
let ownerSession = null;
const manualPetals = new Set();
let petalNoticeTimer;
let lastCursorTrailAt = 0;
let lastTrailPoint = null;
let cursorIdleTimer = 0;

const random = (min, max) => Math.random() * (max - min) + min;
if (hasGsap && !reducedMotion) document.documentElement.classList.add("motion-ready");

function revealInsertedCards(container) {
  container.querySelectorAll(".reveal").forEach((element) => {
    element.classList.add("is-visible");
  });
}

function createHomepageArticleCard(article, index) {
  const card = document.createElement("article");
  const cover = articleService.articleCover(article);
  card.className = `article-card ${index === 0 ? "featured" : ""} reveal`;

  const visual = document.createElement("div");
  visual.className = `card-visual ${cover ? "article-cover" : index === 0 ? "peach-mountain" : "moon-lake"}`;
  if (cover) {
    const image = document.createElement("img");
    image.src = cover.url;
    image.alt = "";
    image.loading = "lazy";
    image.addEventListener("error", () => { image.src = articleService.fallbackCover(article).url; }, { once: true });
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

function loadHomepageArticles() {
  return loadHomeFeed("article", "latestArticles", createHomepageArticleCard);
}

function createHomepageVideoCard(video) {
  const card = document.createElement("a");
  card.className = "home-video-card reveal";
  card.href = articleService.articleUrl(video);
  const visual = document.createElement("div");
  visual.className = "home-video-visual";
  window.InkAssets.videoCover(visual, video);
  const play = document.createElement("span");
  play.className = "media-play-button";
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

function loadHomepageVideos() {
  return loadHomeFeed("video", "latestVideos", createHomepageVideoCard);
}

async function loadHomeFeed(type, id, createCard) {
  const container = document.getElementById(id);
  if (!container || container.dataset.refreshing) return;
  const key = "hutao-homepage-" + type + "s";
  const cache = window.ContentCache;
  const snapshot = JSON.parse(document.getElementById("homeFeedSnapshot").textContent);
  const entry = [{ savedAt: snapshot.savedAt, items: snapshot[type] }, cache?.read(key), cache?.read(type + "s"), cache?.read(key, { legacy: true })]
    .filter(Boolean).sort((a, b) => b.savedAt - a.savedAt)[0];
  const label = type === "article" ? "文章" : "视频";
  function render(items) {
    if (!items.length) {
      window.InkAssets?.state(container, { title: "暂无已发布的" + label });
      return;
    }
    container.replaceChildren(...items.slice(0, 2).map(createCard));
    revealInsertedCards(container);
    setupInkHoverEffects();
  }

  container.dataset.refreshing = "true";
  const retry = () => loadHomeFeed(type, id, createCard);
  try {
    cache?.clearNotice(container);
    if (entry) render(entry.items);
    else window.InkAssets?.loading(container, "正在翻阅" + label + "……", 2);
    const items = await articleService.readPublicFeed(2, { contentType: type, home: true }, 8000);
    if (!entry || JSON.stringify(items) !== JSON.stringify(entry.items.slice(0, 2))) render(items);
    cache?.write(key, items);
  } catch (error) {
    if (["localhost", "127.0.0.1"].includes(location.hostname)) {
      console.debug("首页读取受阻", type, error?.code || error?.name || "network");
    }
    if (entry && cache) cache.notice(container, retry, entry.savedAt);
    else window.InkAssets?.state(container, {
      kind: 'error', title: label + "暂时未能展开", detail: "连接暂时不可用，可以重新读取。",
      action: "重新读取", onAction: retry,
    });
  } finally {
    container.removeAttribute("aria-busy");
    delete container.dataset.refreshing;
  }
}

function renderAchievements(result) {
  const total = Number(result?.total_days || 0);
  const streak = Number(result?.streak || 0);
  const cards = [...document.querySelectorAll("#achievementCards article")];
  cards[0]?.classList.toggle("unlocked", total >= 1);
  cards[1]?.classList.toggle("unlocked", streak >= 3);
  cards[2]?.classList.toggle("unlocked", total >= 7);
  [Math.min(total, 1), Math.min(streak, 3), Math.min(total, 7)].forEach((value, index) => {
    const goal = [1, 3, 7][index];
    const label = cards[index]?.querySelector('.achievement-progress');
    if (label) label.textContent = `${value >= goal ? '已解锁' : '尚未解锁'} · ${value} / ${goal} 天`;
  });
  const trail = document.querySelector('#checkinTrail');
  if (trail) trail.replaceChildren(...Array.from({ length: 7 }, (_, index) => {
    const day = document.createElement('li');
    day.className = index < Math.min(streak, 7) ? 'visited' : '';
    day.textContent = String(index + 1);
    day.setAttribute('aria-label', `第 ${index + 1} 日${day.className ? '，已达成' : '，待达成'}`);
    return day;
  }));
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
  dialog.scrollTop = 0;
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
  let cached = null;
  try { cached = JSON.parse(localStorage.getItem("hutao-achievement-state") || "null"); } catch {}
  renderAchievements(cached);
  if (!cached) document.querySelector("#achievementStatus").textContent = "尚未签到，今天就从第一步开始。";
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
      window.InkAssets?.stamp(document.querySelector('.fortune-rank-wrap'));
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

function summonPetals(event) {
  if (document.hidden) return;
  if (reducedMotion) {
    showPetalNotice('桃花已送达 · 已按你的偏好减少动态效果');
    return;
  }
  const now = performance.now();
  summonLevel = now - lastSummonAt < 1300 ? Math.min(3, summonLevel + 1) : 0;
  lastSummonAt = now;
  const limit = lowPowerDevice ? 10 : compactMotion ? 24 : 40;
  const count = Math.min(limit, (lowPowerDevice ? 6 : compactMotion ? 12 : 20) + summonLevel * 3);
  const rect = (event?.currentTarget || summonButton).getBoundingClientRect();
  const originX = rect.width ? rect.left + rect.width / 2 : innerWidth * .62;
  const originY = rect.height ? Math.min(rect.top, innerHeight * .65) : innerHeight * .25;

  for (let i = 0; i < count; i++) {
    if (manualPetals.size >= limit) {
      const oldest = manualPetals.values().next().value;
      oldest.getAnimations().forEach(animation => animation.cancel());
      oldest.remove();
      manualPetals.delete(oldest);
    }
    const petal = document.createElement('span');
    petal.className = 'manual-petal';
    petal.style.width = petal.style.height = `${random(24, 42)}px`;
    petal.setAttribute('aria-hidden', 'true');
    petal.style.backgroundImage = `url('./assets/spring-ink/small/petal-${1 + Math.floor(random(0, 8))}-144.webp')`;
    document.body.append(petal);
    manualPetals.add(petal);
    const x = originX + random(-16, 16);
    const drift = random(-150, 150) * (1 + summonLevel * .12);
    const bottom = Math.min(innerHeight - 24, originY + random(260, 480));
    const animation = petal.animate([
      { transform: `translate3d(${x}px,${originY}px,0) rotate(-20deg) scale(.6)`, opacity: .7 },
      { transform: `translate3d(${x + drift * .65}px,${originY - random(22, 46)}px,0) rotate(45deg)`, opacity: .85, offset: .23 },
      { transform: `translate3d(${x + drift}px,${bottom}px,0) rotate(${random(120, 240)}deg) scale(.7)`, opacity: 0 },
    ], { duration: 3100 + i * 70, delay: i * 28, easing: 'ease-in-out', fill: 'both' });
    const remove = () => { petal.remove(); manualPetals.delete(petal); };
    animation.finished.then(remove, remove);
  }
}

function showPetalNotice(message) {
  let notice = document.querySelector('.petal-feedback-toast');
  if (!notice) { notice = document.createElement('span'); notice.className = 'petal-feedback-toast'; notice.setAttribute('role', 'status'); document.body.append(notice); }
  notice.textContent = message; notice.hidden = false;
  clearTimeout(petalNoticeTimer); petalNoticeTimer = setTimeout(() => { notice.hidden = true; }, 2200);
}


window.addEventListener('pointermove', event => {
  if (!manualPetals.size || reducedMotion) { previousWindX = null; return; }
  if (previousWindX !== null) {
    const drift = Math.max(-22, Math.min(22, event.clientX - previousWindX));
    manualPetals.forEach(petal => { petal.style.translate = `${drift}px 0`; });
  }
  previousWindX = event.clientX;
}, { passive: true });

window.addEventListener("pointerdown", (event) => {
  if (window.MotionCore?.ready) return;
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

windToggle.classList.add('wind-toggle--summon');
windToggle.removeAttribute('aria-pressed');
windToggle.setAttribute('aria-label', '唤一场桃花');
windToggle.title = '唤一场桃花';
windLabel.textContent = '桃花';
windToggle.addEventListener('click', summonPetals);
summonButton.addEventListener("click", summonPetals);

function renderGuestbook(messages) {
  const list = document.querySelector("#guestbookList");
  list.replaceChildren();
  if (!messages.length && window.InkAssets) {
    InkAssets.state(list, { kind: 'comments', title: '纸墨已备，等你留一笔', detail: '这里还没有留言，写下第一句江湖问候吧。' });
    return;
  }
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
    window.InkAssets?.state(document.querySelector('#guestbookList'), { kind: 'error', title: '留言暂时未能展开', detail: '稍后再试，旧日的墨迹仍在等你。', action: '重新读取', onAction: loadGuestbook });
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
  if (button.disabled) return;
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
    window.InkAssets?.stamp(note);
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

// Paper-edge hover feedback is shared CSS; no separate pointer tracking here.
function setupInkHoverEffects() {}

function setupLinksToggle() {
  const section = document.querySelector(".links-section");
  const button = document.querySelector("#linksToggle");
  const panel = document.querySelector("#linksCollapsible");
  if (!section || !button || !panel) return;
  const favorites = document.querySelector("#stationFavorites");
  if (favorites) {
    const groups = [...panel.querySelectorAll(".friend-group")];
    favorites.replaceChildren(...groups.flatMap(group => [...group.querySelectorAll(".friend-card")].slice(0, 2).map(link => link.cloneNode(true))));
  }
  section.querySelectorAll('.friend-logo img').forEach(image => {
    const logo = image.parentElement;
    const label = image.closest('.friend-card').querySelector('strong').textContent.trim();
    logo.dataset.initial = Array.from(label)[0] || '驿';
    logo.setAttribute('aria-hidden', 'true');
    image.addEventListener('error', () => image.remove(), { once: true });
    if (image.complete && !image.naturalWidth) image.remove();
  });
  panel.querySelectorAll(".friend-group").forEach(group => {
    group.addEventListener("toggle", () => {
      const count = group.querySelectorAll(".friend-card").length;
      group.querySelector(".station-group-note").textContent = `${count} 处 · ${group.open ? "收起" : "展开"}`;
    });
  });

  let expanded = !panel.hidden;
  let activeTransition = null;
  const resetPanel = () => {
    panel.style.removeProperty("height");
    panel.style.removeProperty("overflow");
    panel.style.removeProperty("opacity");
  };
  const closeGroups = () => panel.querySelectorAll("details").forEach(group => { group.open = false; });

  const setExpanded = (open, returnFocus = false) => {
    // Use explicit state so rapid clicks cannot race the closing animation.
    expanded = open;
    section.classList.toggle("is-expanded", open);
    button.setAttribute("aria-expanded", String(open));
    button.textContent = open ? "收起分类入口 ↑" : "按分类找去处 ↓";
    panel.inert = !open;

    const previousHeight = panel.hidden ? 0 : panel.getBoundingClientRect().height;
    activeTransition?.cancel();
    activeTransition = null;

    if (reducedMotion || typeof panel.animate !== "function") {
      panel.hidden = !open;
      resetPanel();
      if (!open) closeGroups();
    } else {
      panel.hidden = false;
      panel.style.height = `${previousHeight}px`;
      panel.style.overflow = "hidden";
      const nextHeight = open ? panel.scrollHeight : 0;
      const animation = panel.animate([
        { height: `${previousHeight}px`, opacity: open ? 0.6 : 1 },
        { height: `${nextHeight}px`, opacity: open ? 1 : 0.6 },
      ], {
        duration: open ? 260 : 220,
        easing: "cubic-bezier(.22, 1, .36, 1)",
        fill: "forwards",
      });
      activeTransition = animation;
      animation.finished.then(() => {
        if (activeTransition !== animation) return;
        activeTransition = null;
        animation.cancel();
        panel.hidden = !open;
        resetPanel();
        if (!open) closeGroups();
      }).catch(() => {}); // Expected for an interrupted animation.
    }
    if (returnFocus) {
      button.focus({ preventScroll: true });
      button.scrollIntoView({ behavior: reducedMotion ? "instant" : "smooth", block: "nearest" });
    }
  };
  button.addEventListener("click", () => setExpanded(!expanded));
  document.querySelector("#linksCollapseBottom")?.addEventListener("click", () => setExpanded(false, true));
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
        if (event.target.closest?.("a, button, input, textarea, select, summary, [role=button], [role=option]")) return;
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


}

function runWhenIdle(task, timeout = 1600) {
  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(() => task(), { timeout });
    return;
  }
  window.setTimeout(task, Math.min(timeout, 600));
}

async function loadCourseIndex() {
  const list = document.querySelector('#courseList');
  let positions = {};
  try { positions = JSON.parse(localStorage.getItem('hutao-reading-positions')) || {}; } catch {}
  function render(rows) {
    const lessons = rows.filter(row => articleService.lessonNumber(row) !== null)
      .sort((a, b) => articleService.lessonNumber(a) - articleService.lessonNumber(b));
    list.replaceChildren();
    for (const lesson of lessons) {
      const link = document.createElement('a');
      link.href = articleService.articleUrl(lesson);
      const number = document.createElement('small');
      number.textContent = String(articleService.lessonNumber(lesson)).padStart(2, '0');
      const title = document.createElement('span');
      title.textContent = lesson.title;
      link.append(number, title);
      const ratio = positions[lesson.id]?.ratio;
      if (ratio > 0 && ratio <= 1) {
        const progress = document.createElement('small');
        progress.textContent = `已读 ${Math.round(ratio * 100)}%`;
        link.append(progress);
      }
      list.append(link);
    }
    if (!lessons.length) list.textContent = '课程目录暂无已发布文章。';
  }
  const cached = window.ContentCache.read('course-index');
  if (cached) render(cached.items);
  window.ContentCache.clearNotice(list);
  try {
    const rows = await articleService.readPublicFeed(null, { lessons: true, contentType: 'article' });
    render(rows);
    window.ContentCache.write('course-index', rows);
  } catch {
    if (cached) window.ContentCache.notice(list, loadCourseIndex, cached.savedAt);
    else window.InkAssets.state(list, { kind: 'error', title: '课程目录暂时无法读取', action: '重新读取', onAction: loadCourseIndex });
  }
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

const courseDetails = document.querySelector('#courseIndex');
courseDetails.addEventListener('toggle', function onOpen() {
  if (!courseDetails.open) return;
  courseDetails.removeEventListener('toggle', onOpen);
  void loadCourseIndex();
});
runWhenIdle(loadHomepageArticles, 1200);
runWhenNear(".home-videos-section", loadHomepageVideos);
runWhenIdle(loadSiteVisitCount, 2400);
runWhenNear(".message-section", initializeGuestbook, "420px 0px");
setupAchievements();
setupInkHoverEffects();
setupLinksToggle();

function applyHomeMotionPreference() {
  reducedMotion = homeMotionQuery.matches;
  document.documentElement.classList.toggle("cursor-ready", hasGsap && !reducedMotion && finePointer && !lowPowerDevice);
  if (reducedMotion || document.hidden) {
    manualPetals.forEach(node => { node.getAnimations().forEach(animation => animation.cancel()); node.remove(); });
    manualPetals.clear();
  }
  if ((!reducedMotion && !document.hidden) || !hasGsap) return;
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
