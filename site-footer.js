/* Shared registration row for every page in the blog. */
(() => {
  const badgeUrl = new URL('./assets/beian-police.png', document.currentScript.src).href;

  function mountRegistration() {
    let footer = document.querySelector('body > footer');
    if (!footer) {
      const main = document.querySelector('body > main');
      if (!main) return;
      footer = document.createElement('footer');
      main.after(footer);
    }
    if (footer.querySelector('.site-registration')) return;

    footer.classList.add('site-footer');
    const registration = document.createElement('div');
    registration.className = 'site-registration';
    registration.innerHTML = `
      <a href="https://beian.miit.gov.cn/" target="_blank" rel="noopener noreferrer">浙ICP备2026081183号-1</a>
      <a href="https://beian.mps.gov.cn/#/query/webSearch?code=33078202003950" target="_blank" rel="noopener noreferrer">
        <img class="site-registration-badge" alt="" width="16" height="18" />
        <span>浙公网安备33078202003950号</span>
      </a>
    `;
    registration.querySelector('img').src = badgeUrl;
    footer.append(registration);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountRegistration, { once: true });
  } else {
    mountRegistration();
  }
})();
