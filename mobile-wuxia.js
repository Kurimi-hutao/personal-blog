/* Transparent native AE renders; mounted only on compact pages. */
(() => {
  'use strict';
  const compact = matchMedia('(max-width:900px)');
  const reduced = matchMedia('(prefers-reduced-motion:reduce)');
  const base = new URL('./assets/mobile-wuxia-v3/', document.currentScript.src);
  const scenes = new Set();
  const connection = navigator.connection;
  // WebKit receives an alpha WebP animation; other engines use the smaller VP9 video.
  const imageEngine = /AppleWebKit/.test(navigator.userAgent) && !/Chrome|Chromium|Edg|OPR|Android/.test(navigator.userAgent);
  let paused = false, suspended = false, control;
  try { paused = localStorage.getItem('hutao-wuxia-paused') === '1'; } catch {}
  const url = file => new URL(file + '?v=20261019-clarity', base).href;
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      const scene = [...scenes].find(s => s.root === entry.target);
      if (scene) scene.visible = entry.isIntersecting;
    });
    refresh();
  }, { threshold: 0 });
  function permitted() {
    return compact.matches && !reduced.matches && !connection?.saveData && !paused && !suspended && !document.hidden &&
      !document.body.classList.contains('mobile-nav-open') && !document.querySelector('dialog[open]');
  }
  function sync(scene, playing) {
    scene.playing = playing;
    scene.root.dataset.motion = playing ? 'playing' : 'paused';
    scene.root.dataset.renderer = scene.imageMode ? 'image' : 'video';
    if (scene.failed) return;
    if (scene.imageMode) {
      if (playing) {
        const source = url(scene.name + '-motion.webp');
        if (scene.live.getAttribute('src') !== source) scene.live.src = source;
      } else {
        scene.root.dataset.ready = 'false';
        scene.live.removeAttribute('src');
      }
      return;
    }
    if (!playing) { scene.video.pause(); scene.root.dataset.ready = 'false'; return; }
    if (!scene.video.getAttribute('src')) scene.video.src = url(scene.name + '.webm');
    scene.video.play().catch(() => { scene.root.dataset.ready = 'false'; });
  }
  function refresh() {
    let slots = 2;
    scenes.forEach(scene => sync(scene, permitted() && scene.visible && slots-- > 0));
    if (control) {
      const blocked = reduced.matches || connection?.saveData;
      control.disabled = Boolean(blocked);
      control.textContent = blocked ? '画中动效已静止' : paused ? '播放画中动效' : '暂停画中动效';
      control.setAttribute('aria-pressed', String(!paused && !blocked));
    }
  }
  function mount(host, name, kind) {
    if (!host) return;
    const root = document.createElement('div');
    root.className = 'mobile-wuxia-art mobile-wuxia-' + kind;
    root.setAttribute('aria-hidden', 'true'); root.inert = true;
    const poster = document.createElement('img');
    poster.className = 'wuxia-poster'; poster.alt = ''; poster.width = 384; poster.height = name === 'river' ? 135 : 384;
    poster.loading = 'lazy'; poster.decoding = 'async'; poster.fetchPriority = 'low'; poster.src = url(name + '-still.webp');
    const video = document.createElement('video');
    video.muted = true; video.defaultMuted = true; video.loop = true; video.playsInline = true;
    video.preload = 'none'; video.tabIndex = -1; video.disablePictureInPicture = true;
    video.setAttribute('playsinline', ''); video.setAttribute('muted', '');
    const live = document.createElement('img');
    live.className = 'wuxia-image-motion'; live.alt = ''; live.decoding = 'async';
    const scene = { root, name, video, live, imageMode: imageEngine || !video.canPlayType('video/webm; codecs="vp9"'), visible: false, playing: false, failed: false };
    live.onload = () => { if (scene.playing) root.dataset.ready = 'true'; };
    live.onerror = () => { if (live.hasAttribute('src')) { scene.failed = true; root.dataset.ready = 'false'; } };
    video.addEventListener('playing', () => { if (scene.playing) root.dataset.ready = 'true'; else video.pause(); });
    video.addEventListener('error', () => { scene.imageMode = true; root.dataset.ready = 'false'; sync(scene, scene.playing); });
    root.append(poster, video, live); host.append(root); scenes.add(scene); observer.observe(root);
  }
  function remove() {
    scenes.forEach(scene => {
      observer.unobserve(scene.root); scene.video.pause(); scene.video.removeAttribute('src'); scene.video.load();
      scene.live.removeAttribute('src'); scene.root.remove();
    });
    scenes.clear();
    document.querySelectorAll('.wuxia-chapter,.wuxia-about,.wuxia-station,.wuxia-checkin,.has-wuxia-closing').forEach(host =>
      host.classList.remove('wuxia-chapter','wuxia-about','wuxia-station','wuxia-checkin','has-wuxia-closing'));
    document.querySelectorAll('.wuxia-closing-created').forEach(e => e.remove());
    control?.remove(); control = null;
  }
  function reconcile() {
    if (!compact.matches) { remove(); return; }
    if (scenes.size) { refresh(); return; }
    const chapter = document.querySelector('[data-page="articles"] .scene-banner,.works-page .scene-banner');
    if (chapter) { chapter.classList.add('wuxia-chapter'); mount(chapter, document.body.dataset.page === 'works' ? 'parasol-hero' : 'reading', 'chapter'); }
    const portrait = document.querySelector('.home-page .portrait-panel');
    if (portrait) { portrait.classList.add('wuxia-about'); mount(portrait, 'peeking', 'portrait'); }
    const station = document.querySelector('#links .section-heading');
    if (station) { station.classList.add('wuxia-station'); mount(station, 'parasol', 'umbrella'); }
    const checkin = document.querySelector('.achievement-copy');
    if (checkin) { checkin.classList.add('wuxia-checkin'); mount(checkin, 'prayer', 'prayer'); }
    const checkinButton = document.querySelector('#checkinButton');
    if (checkinButton) mount(checkinButton, 'seal', 'seal');
    const footer = document.querySelector('body > footer');
    if (footer) {
      let closing = document.querySelector('.spring-closing');
      if (!closing) { closing = document.createElement('div'); closing.className = 'wuxia-closing-created'; footer.before(closing); }
      closing.classList.add('has-wuxia-closing'); mount(closing, 'river', 'river');
      if (document.body.classList.contains('home-page')) mount(closing, 'resting', 'resting');
      control = document.createElement('button'); control.type = 'button'; control.className = 'wuxia-motion-control';
      control.addEventListener('click', () => {
        paused = !paused;
        try { localStorage.setItem('hutao-wuxia-paused', paused ? '1' : '0'); } catch {}
        document.dispatchEvent(new CustomEvent('mobile-illustration-motion-change', { detail: { paused } }));
        refresh();
      });
      footer.append(control);
    }
    refresh();
  }
  compact.addEventListener('change', reconcile); reduced.addEventListener('change', refresh);
  connection?.addEventListener('change', refresh);
  document.addEventListener('visibilitychange', refresh);
  document.addEventListener('mobile-navigation-change', refresh);
  new MutationObserver(refresh).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  new MutationObserver(records => { if (records.some(r => r.target.matches('dialog'))) refresh(); }).observe(document.body, { attributes: true, subtree: true, attributeFilter: ['open'] });
  window.addEventListener('pagehide', () => { suspended = true; refresh(); });
  window.addEventListener('pageshow', () => { suspended = false; refresh(); });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', reconcile, { once: true });
  else reconcile();
})();

