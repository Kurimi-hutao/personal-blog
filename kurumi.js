(() => {
  'use strict';
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const lightbox = document.querySelector('#imageLightbox');
  const lightboxImage = lightbox.querySelector('img');
  const header = document.querySelector('.site-header');
  const hero = document.querySelector('.kurumi-page-hero');
  const media = document.querySelector('.kurumi-hero-media');
  const video = media.querySelector('video');
  const control = document.querySelector('.kurumi-motion-toggle');
  const connection = navigator.connection;
  let visible = !('IntersectionObserver' in window);
  let suspended = false;
  let failed = false;
  let requested = false;
  let userPaused = false;
  let intro;
  try { userPaused = localStorage.getItem('hutao-wuxia-paused') === '1'; } catch {}

  const permitted = () => !reduced.matches && !connection?.saveData && !userPaused &&
    !document.hidden && !suspended && visible && !failed &&
    !document.body.classList.contains('mobile-nav-open') && !document.querySelector('dialog[open]');

  function refresh() {
    const blocked = reduced.matches || connection?.saveData || failed;
    const playing = permitted();
    media.dataset.motion = playing ? 'playing' : 'paused';
    control.hidden = false;
    control.disabled = Boolean(blocked);
    control.textContent = blocked ? '画中动效已静止' : userPaused ? '播放画中动效' : '暂停画中动效';
    control.setAttribute('aria-pressed', String(!userPaused && !blocked));
    if (requested === playing) return;
    requested = playing;
    if (!playing) { video.pause(); return; }
    // Poster supplies the complete first paint. Reduced/data-saving mode makes no video request.
    if (!video.hasAttribute('src')) video.src = video.dataset.src;
    video.play().catch(() => {
      if (!permitted()) return;
      requested = false;
      userPaused = true;
      refresh();
    });
  }

  video.muted = true;
  video.addEventListener('playing', () => {
    if (permitted()) media.dataset.ready = 'true';
    else video.pause();
  });
  video.addEventListener('error', () => {
    failed = true;
    media.dataset.ready = 'false';
    refresh();
  });
  control.addEventListener('click', () => {
    userPaused = !userPaused;
    try { localStorage.setItem('hutao-wuxia-paused', userPaused ? '1' : '0'); } catch {}
    document.dispatchEvent(new CustomEvent('mobile-illustration-motion-change', { detail: { paused: userPaused } }));
    refresh();
  });
  document.addEventListener('mobile-illustration-motion-change', event => {
    userPaused = Boolean(event.detail.paused);
    refresh();
  });
  window.addEventListener('storage', event => {
    if (event.key !== 'hutao-wuxia-paused') return;
    userPaused = event.newValue === '1';
    refresh();
  });
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      visible = entries.some(entry => entry.isIntersecting);
      refresh();
    }, { threshold: 0.05 });
    observer.observe(hero);
  }
  if ('MutationObserver' in window) {
    new MutationObserver(refresh).observe(document.body, { attributes: true, attributeFilter: ['class'] });
    new MutationObserver(refresh).observe(lightbox, { attributes: true, attributeFilter: ['open'] });
  }
  reduced.addEventListener('change', () => {
    if (reduced.matches && intro) {
      intro.progress(1).kill();
      intro = null;
    }
    refresh();
  });
  connection?.addEventListener('change', refresh);
  document.addEventListener('visibilitychange', refresh);
  document.addEventListener('mobile-navigation-change', refresh);
  window.addEventListener('pagehide', () => { suspended = true; refresh(); });
  window.addEventListener('pageshow', () => { suspended = false; refresh(); });
  window.addEventListener('scroll', () => header.classList.toggle('scrolled', window.scrollY > 30), { passive: true });

  document.querySelectorAll('[data-gallery-src]').forEach(button => {
    button.addEventListener('click', () => {
      lightboxImage.style.opacity = '0';
      lightboxImage.onload = () => { lightboxImage.style.opacity = '1'; };
      lightboxImage.onerror = () => { lightboxImage.style.opacity = '1'; };
      lightboxImage.src = button.dataset.gallerySrc;
      lightboxImage.alt = button.dataset.galleryAlt;
      lightbox.showModal();
      document.documentElement.classList.add('gallery-dialog-open');
      if (lightboxImage.complete) lightboxImage.style.opacity = '1';
      refresh();
    });
  });
  let closing = false;
  function closeGallery() {
    if (closing || !lightbox.open) return;
    closing = true;
    const animation = reduced.matches ? null : lightbox.animate([{ opacity: 1 }, { opacity: 0, transform: 'translateY(8px)' }], { duration: 180, fill: 'forwards' });
    Promise.resolve(animation?.finished).catch(() => {}).then(() => {
      lightbox.close(); animation?.cancel(); closing = false;
      document.documentElement.classList.remove('gallery-dialog-open');
    });
  }
  lightbox.addEventListener('cancel', event => { event.preventDefault(); closeGallery(); });
  lightbox.querySelector('.lightbox-close').addEventListener('click', closeGallery);
  lightbox.addEventListener('click', event => { if (event.target === lightbox) closeGallery(); });
  lightbox.addEventListener('close', refresh);

  // MotionCore owns gallery reveals; avoid competing observers and hidden text.
  if (window.gsap && !reduced.matches) {
    intro = window.gsap.timeline({ defaults: { ease: 'power2.out', clearProps: 'transform,opacity' } })
      .from('.kurumi-page-hero-copy h1', { y: 12, opacity: .7, duration: .6 })
      .from('.kurumi-page-hero-copy > p', { y: 8, opacity: .7, duration: .45 }, '-=.35');
  }
  refresh();
})();
