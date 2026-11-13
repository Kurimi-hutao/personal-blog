(function () {
  'use strict';
  const base = new URL('./assets/visual-refresh/', document.currentScript.src);
  const url = (name) => new URL(name, base).href;

  function state(container, { kind = 'search', title, detail = '', action, onAction } = {}) {
    if (!container) return;
    container.removeAttribute('aria-busy');
    const node = document.createElement('div');
    node.className = `ink-state ink-state--${kind}`;
    const image = document.createElement('img');
    image.src = kind === 'comments'
      ? new URL('./assets/comment-ui/comment-empty.webp', document.baseURI).href
      : url(({ search: 'empty-search', error: 'load-error' }[kind] || 'empty-search') + '.webp');
    image.alt = '';
    image.width = 240;
    image.height = 168;
    image.decoding = 'async';
    const heading = document.createElement('strong');
    heading.textContent = title;
    const copy = document.createElement('p');
    copy.textContent = detail;
    node.append(image, heading, copy);
    if (action && onAction) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'text-button';
      button.textContent = action;
      button.addEventListener('click', onAction);
      node.append(button);
    }
    container.replaceChildren(node);
    return node;
  }

  function loading(container, label = '正在翻阅……', count = 3) {
    if (!container) return;
    container.setAttribute('aria-busy', 'true');
    const wrap = document.createElement('div');
    wrap.className = 'ink-loading';
    const status = document.createElement('p');
    status.className = 'ink-loading__label';
    status.textContent = label;
    const cards = document.createElement('div');
    cards.className = 'ink-loading__cards';
    cards.setAttribute('aria-hidden', 'true');
    for (let index = 0; index < count; index++) {
      const card = document.createElement('div');
      card.className = 'ink-loading__card';
      card.innerHTML = '<i></i><b></b><span></span><span></span>';
      cards.append(card);
    }
    wrap.append(status, cards);
    container.replaceChildren(wrap);
  }

  function videoCover(visual, video) {
    const card = document.createElement('span');
    card.className = 'video-no-poster video-title-card';
    card.setAttribute('aria-hidden', 'true');
    card.textContent = video.title || '影像手记';
    visual.append(card);
    const urls = [...new Set([video.video_poster, window.articleService.firstImage(video)?.url].filter(Boolean))];
    if (!urls.length) return;
    const image = document.createElement('img');
    image.alt = '';
    image.loading = 'lazy';
    image.decoding = 'async';
    image.referrerPolicy = 'no-referrer';
    image.onload = () => { card.hidden = true; };
    let attemptedRestore = false;
    image.onerror = async () => {
      if (urls.length) { image.src = urls.shift(); return; }
      if (!attemptedRestore) {
        attemptedRestore = true;
        const restored = await window.articleService.resolveBilibiliThumbnail(video);
        if (restored && restored !== image.src) { image.src = restored; return; }
      }
      card.hidden = false;
      image.remove();
    };
    image.src = urls.shift();
    visual.append(image);
  }

  function stamp(target) {
    if (!target) return;
    target.querySelector('.ink-success-stamp')?.remove();
    const seal = document.createElement('img');
    seal.src = url('seal-hutao.webp');
    seal.alt = '';
    seal.className = 'ink-success-stamp';
    seal.width = 42;
    seal.height = 44;
    target.append(seal);
    window.setTimeout(() => seal.remove(), 1300);
  }

  function decorate() {
    const icons = {
      '#articles .section-heading h2': 'scroll',
      '#videos .section-heading h2': 'lantern',
      '#messageForm label:last-of-type > span': 'brush',
      '#checkinButton': 'seal',
      '#bookmarkArticle': 'bookmark',
      '.site-search-dialog .site-search-shell > header strong': 'scroll',
    };
    for (const [selector, icon] of Object.entries(icons)) {
      document.querySelectorAll(selector).forEach((element) => {
        element.classList.add('ink-icon-label');
        element.style.setProperty('--ink-label-icon', `url("${url(`icon-${icon}.webp`)}")`);
      });
    }
  }
  window.InkAssets = { state, loading, stamp, videoCover };
  if (document.readyState !== 'complete') document.addEventListener('DOMContentLoaded', decorate, { once: true });
  else decorate();
}());
