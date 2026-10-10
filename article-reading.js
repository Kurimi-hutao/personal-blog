(function () {
  'use strict';
  const motion = () => matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
  function read(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } }
  function write(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} }

  function setupToc(body) {
    const toc = document.querySelector('#articleToc');
    const headings = [...body.querySelectorAll('h1,h2,h3')];
    if (headings.length < 2) return;
    const details = document.createElement('details');
    details.innerHTML = '<summary>此卷目录</summary>';
    const list = document.createElement('ol');
    headings.forEach((heading, i) => {
      if (!heading.id) heading.id = `chapter-${i + 1}`;
      const li = document.createElement('li');
      li.className = `toc-level-${heading.tagName.slice(1)}`;
      const link = document.createElement('a');
      link.href = `#${heading.id}`;
      link.textContent = heading.textContent;
      li.append(link); list.append(li);
    });
    details.append(list); toc.replaceChildren(details); body.before(toc); toc.hidden = false;
    const wide = matchMedia('(min-width:1400px)');
    details.open = wide.matches;
    wide.addEventListener('change', () => { details.open = wide.matches; });
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'reading-toc-trigger'; button.textContent = '目录';
    button.setAttribute('aria-haspopup', 'dialog');
    const dialog = document.createElement('dialog');
    dialog.className = 'reading-toc-dialog'; dialog.setAttribute('aria-label', '此卷目录');
    dialog.innerHTML = '<header><strong>此卷目录</strong><button type="button" aria-label="关闭目录">×</button></header>';
    dialog.append(list.cloneNode(true)); document.body.append(button, dialog);
    const readingObserver = new IntersectionObserver(entries => { button.hidden = !entries[0].isIntersecting; });
    readingObserver.observe(body);
    button.onclick = () => dialog.showModal();
    dialog.querySelector('button').onclick = () => dialog.close();
    dialog.addEventListener('click', event => {
      if (event.target === dialog) dialog.close();
      const link = event.target.closest('a');
      if (!link) return;
      event.preventDefault(); dialog.close();
      const target = document.getElementById(decodeURIComponent(link.hash.slice(1)));
      target?.scrollIntoView({ behavior: motion(), block: 'start' });
      history.replaceState(null, '', link.hash);
    });
    const observer = new IntersectionObserver(entries => {
      const entry = entries.filter(e => e.isIntersecting).sort((a,b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (!entry) return;
      [toc, dialog].forEach(root => root.querySelectorAll('a').forEach(link => {
        const active = link.hash === `#${entry.target.id}`;
        link.classList.toggle('active', active);
        if (active) link.setAttribute('aria-current', 'location'); else link.removeAttribute('aria-current');
      }));
    }, { rootMargin: '-15% 0px -65% 0px' });
    headings.forEach(heading => observer.observe(heading));
  }

  function setupResume(article) {
    if (article.content_type === 'video') return;
    const body = document.querySelector('#articleDetail .article-body');
    const key = 'hutao-reading-positions';
    const positions = read(key, {});
    const saved = positions[article.id];
    let interacted = false, timer;
    const ratio = () => Math.max(0, Math.min(1, (96 - body.getBoundingClientRect().top) / Math.max(1, body.offsetHeight - innerHeight + 96)));
    function save() {
      if (!interacted || document.documentElement.classList.contains('ink-site-loading')) return;
      const value = ratio();
      const items = read(key, {});
      if (value > .98) delete items[article.id];
      else if (value > .03) items[article.id] = { ratio: value, title: article.title, updatedAt: Date.now() };
      else delete items[article.id];
      write(key, Object.fromEntries(Object.entries(items).sort((a,b) => b[1].updatedAt - a[1].updatedAt).slice(0,100)));
    }
    if (saved?.ratio > .03 && saved.ratio < .98 && !location.hash) {
      const notice = document.createElement('div'); notice.className = 'reading-resume';
      notice.innerHTML = '<span></span><button type="button">继续阅读</button><button type="button">从头阅读</button>';
      notice.querySelector('span').textContent = `上次读到 ${Math.round(saved.ratio * 100)}%`;
      document.querySelector('.article-detail-header').after(notice);
      const [resume, reset] = notice.querySelectorAll('button');
      resume.onclick = async () => {
        await (window.InkLottie?.loaded || document.fonts?.ready);
        notice.remove(); interacted = true;
        const top = scrollY + body.getBoundingClientRect().top - 96 + saved.ratio * Math.max(1, body.offsetHeight - innerHeight + 96);
        scrollTo({ top, behavior: motion() });
      };
      reset.onclick = () => { delete positions[article.id]; write(key, positions); notice.remove(); };
    }
    ['wheel','touchstart','keydown'].forEach(type => window.addEventListener(type, () => { interacted = true; }, { passive: true }));
    window.addEventListener('scroll', () => {
      document.querySelector('#readingProgress').style.transform = `scaleX(${ratio()})`;
      clearTimeout(timer); timer = setTimeout(save, 350);
    }, { passive: true });
    window.addEventListener('pagehide', save);
    document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });
  }
  window.ArticleReading = { setupToc, setupResume };
}());
