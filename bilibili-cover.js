/* Keep the original Bilibili thumbnail synchronized with a video URL.
   Only the signed-in blog owner requests lightweight metadata from Supabase. */
(() => {
  "use strict";
  const form = document.querySelector("#articleForm");
  const videoUrlInput = form.elements.videoUrl;
  const hint = document.querySelector("#bilibiliCoverHint");
  const cache = new Map();
  let timer = null;

  function extractBvid(rawUrl) {
    try {
      const url = new URL(rawUrl);
      if (url.protocol !== "https:") return null;
      const pageHost = ["www.bilibili.com", "bilibili.com", "m.bilibili.com"].includes(url.hostname);
      const playerHost = url.hostname === "player.bilibili.com";
      const match = pageHost && url.pathname.match(/^\/video\/(BV[a-zA-Z0-9]{10})(?:\/|$)/);
      const bvid = match?.[1] ||
        (playerHost && url.pathname === "/player.html" ? url.searchParams.get("bvid") : null);
      return bvid && /^BV[a-zA-Z0-9]{10}$/.test(bvid) ? bvid : null;
    } catch {
      return null;
    }
  }

  function setHint(message) {
    hint.textContent = message;
    hint.hidden = !message;
  }

  async function resolve() {
    clearTimeout(timer);
    const bvid = form.elements.contentType.value === "video"
      ? extractBvid(videoUrlInput.value.trim()) : null;
    if (!bvid) {
      setHint("");
      return;
    }
    if (!window.adminCover.canApplyBilibiliCover()) {
      setHint("已保留你选择的自定义封面。");
      return;
    }
    setHint("正在读取 B站视频原始封面……");
    if (!cache.has(bvid)) {
      const pending = articleService.fetchBilibiliCover(bvid);
      cache.set(bvid, pending);
      pending.catch(() => { if (cache.get(bvid) === pending) cache.delete(bvid); });
    }
    try {
      const data = await cache.get(bvid);
      if (extractBvid(videoUrlInput.value.trim()) !== bvid ||
          form.elements.contentType.value !== "video") return;
      if (window.adminCover.applyBilibiliCover(data.coverUrl)) {
        setHint("已匹配 B站原始封面，可手动替换。");
        if (Number.isFinite(data.durationSeconds) && data.durationSeconds > 0
            && !form.elements.durationSeconds.value) {
          form.elements.durationSeconds.value = String(Math.round(data.durationSeconds));
        }
      } else {
        setHint("已保留你选择的自定义封面。");
      }
    } catch {
      if (extractBvid(videoUrlInput.value.trim()) === bvid) {
        setHint("暂时无法获取 B站封面。可在下方手动填写封面图片地址。");
      }
    }
  }

  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(() => { void resolve(); }, 650);
  }

  videoUrlInput.addEventListener("input", schedule);
  window.BilibiliCover = { extractBvid, schedule, resolve };
})();
