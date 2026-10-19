/* Animate article contents independently of MotionCore's card/filter transforms. */
(() => {
  'use strict';
  const containers = [...document.querySelectorAll('#latestArticles, #articleList')];
  if (!containers.length) return;
  const reduce = matchMedia('(prefers-reduced-motion:reduce)');
  const seen = new WeakSet(), running = new Set(), observed = new Set();
  const selector = '.article-card:not(.static-fallback), .article-list-card';
  const stop = () => { running.forEach(a => a.cancel()); running.clear(); };
  function animate(card) {
    if (seen.has(card)) return;
    seen.add(card);
    if (reduce.matches || document.hidden) return;
    const cover = card.querySelector('.card-visual, .article-list-cover');
    const copy = card.querySelector('.card-content, .article-list-copy');
    const targets = [cover, ...(copy?.children || [])].filter(Boolean);
    targets.forEach((target, index) => {
      const animation = target.animate([
        { opacity: .15, transform: `translateY(${index ? 12 : 18}px)` },
        { opacity: 1, transform: 'translateY(0)' },
      ], { duration: index ? 480 : 650, delay: Math.min(index * 55, 220), easing: 'cubic-bezier(.22,1,.36,1)' });
      running.add(animation);
      animation.onfinish = animation.oncancel = () => running.delete(animation);
    });
  }
  const observer = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      observer.unobserve(entry.target); observed.delete(entry.target); animate(entry.target);
    });
  }, { threshold: .12, rootMargin: '0px 0px -24px 0px' }) : null;
  const scan = () => containers.forEach(container => container.querySelectorAll(selector).forEach(card => {
    if (seen.has(card)) return;
    if (observer) { observed.add(card); observer.observe(card); } else animate(card);
  }));
  const mutations = new MutationObserver(() => {
    // Retire detached targets when filtering while an entrance is running.
    running.forEach(a => { if (!a.effect?.target?.isConnected) { a.cancel(); running.delete(a); } });
    observed.forEach(card => { if (!card.isConnected) { observer?.unobserve(card); observed.delete(card); } });
    scan();
  });
  const connect = () => { containers.forEach(c => mutations.observe(c, {childList:true})); scan(); };
  reduce.addEventListener('change', () => { if (reduce.matches) stop(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
  window.addEventListener('pagehide', () => { stop(); observer?.disconnect(); observed.clear(); mutations.disconnect(); });
  window.addEventListener('pageshow', event => { if (event.persisted) connect(); });
  connect();
})();
