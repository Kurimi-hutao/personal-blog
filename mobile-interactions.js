/* Small mobile interactions; no particle effects or scroll listeners. */
(() => {
  'use strict';
  const compact = matchMedia('(max-width:1080px)');
  const reduce = matchMedia('(prefers-reduced-motion:reduce)');
  const running = new Map();
  const enabled = () => compact.matches && !reduce.matches && !document.hidden;
  const controls = 'button,a,summary,[role="button"],[role="option"]';
  let press = null;
  function cancel(element) { running.get(element)?.cancel(); running.delete(element); }
  function stop(group) {
    [...running].forEach(([element, animation]) => { if (!group || animation.group === group) cancel(element); });
    if (!group) { press?.element.classList.remove('mobile-touch-pressed'); press = null; }
  }
  function play(element, frames, options = {}, group = 'control') {
    if (!enabled() || !element || !element.getClientRects().length) return;
    cancel(element);
    const animation = element.animate(frames, { duration: 220, easing: 'cubic-bezier(.22,1,.36,1)', ...options });
    animation.group = group; running.set(element, animation);
    animation.onfinish = animation.oncancel = () => { if (running.get(element) === animation) running.delete(element); };
  }
  document.addEventListener('mobile-navigation-change', event => {
    stop('menu');
    if (!event.detail.open || !enabled()) return;
    document.querySelectorAll('.nav-primary > a,.nav-secondary,.nav-utilities').forEach((element, i) => {
      play(element, [{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 320, delay: i * 28, fill: 'backwards' }, 'menu');
    });
  });
  const feedback = element => play(element, [{ scale: '.975' }, { scale: '1' }], { duration: 200 });
  const clearPress = (release = false) => {
    if (!press) return;
    const previous = press; press = null;
    previous.element.classList.remove('mobile-touch-pressed');
    if (release && performance.now() - previous.at < 500) feedback(previous.element);
  };
  document.addEventListener('pointerdown', event => {
    clearPress();
    if (!enabled() || !event.isPrimary || event.button !== 0) return;
    const element = event.target.closest(controls);
    if (!element || element.matches(':disabled,[aria-disabled="true"]') || element.closest('[inert]') || element.matches('.comment-image,[data-gallery-src]')) return;
    press = { element, x: event.clientX, y: event.clientY, id: event.pointerId, at: performance.now() };
    element.classList.add('mobile-touch-pressed');
  }, { passive: true });
  document.addEventListener('pointermove', event => {
    if (press?.id === event.pointerId && Math.hypot(event.clientX - press.x,event.clientY - press.y) > 10) clearPress();
  }, { passive: true });
  document.addEventListener('pointerup', event => { if (press?.id === event.pointerId) clearPress(true); }, { passive: true });
  document.addEventListener('pointercancel', () => clearPress(), { passive: true });
  window.addEventListener('blur', () => clearPress());
  document.addEventListener('keydown', event => {
    if (enabled() && !event.repeat && ['Enter',' '].includes(event.key) && event.target.matches(controls) && !event.target.matches(':disabled')) feedback(event.target);
  });
  // Watch only semantic state changes, never animation style mutations.
  const states = new MutationObserver(records => {
    records.forEach(record => {
      const element = record.target;
      if (record.attributeName === 'open' && element.matches('.site-search-dialog,.reading-toc-dialog')) {
        if (!element.open) { cancel(element); return; }
        play(element,[{ opacity: 0,transform: 'translateY(8px)' },{ opacity: 1,transform: 'translateY(0)' }],{ duration: 240 },'dialog');
      }
      if (record.attributeName === 'aria-pressed' && element.matches('#bookmarkArticle,.like-button,.works-toolbar button,.tag-filter-list button,.search-type-filters button')) feedback(element);
    });
  });
  states.observe(document.body,{ subtree: true,attributes: true,attributeFilter: ['open','aria-pressed'] });
  function revealArtwork() {
    if (!enabled() || !document.body.classList.contains('home-page') || !matchMedia('(max-width:900px)').matches) return;
    const dark = document.documentElement.dataset.theme === 'dark';
    const artwork = document.querySelector(dark ? '.spring-night' : '.hero-art');
    if (!artwork) return;
    if (window.gsap) {
      cancel(artwork);
      const tween = gsap.fromTo(artwork,{ opacity: .25,y: 8 },{ opacity: 1,y: 0,duration: .85,ease: 'power2.out',clearProps: 'opacity,transform',onComplete: () => running.delete(artwork) });
      running.set(artwork,{ group: 'artwork',cancel: () => { tween.kill(); gsap.set(artwork,{ clearProps: 'opacity,transform' }); } });
    } else play(artwork,[{ opacity: .25,transform: 'translateY(8px)' },{ opacity: 1,transform: 'translateY(0)' }],{ duration: 850 },'artwork');
  }
  const theme = new MutationObserver(() => { stop('artwork'); revealArtwork(); });
  theme.observe(document.documentElement,{ attributes: true,attributeFilter: ['data-theme'] });
  Promise.resolve(window.InkLottie?.loaded).then(revealArtwork);
  const reset = () => { if (!enabled()) stop(); };
  compact.addEventListener('change',reset); reduce.addEventListener('change',reset);
  document.addEventListener('visibilitychange',reset);
  window.addEventListener('pagehide',() => stop());
})();
