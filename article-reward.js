(() => {
  function openPaymentWindow(url) {
    const availableWidth = window.screen.availWidth || window.outerWidth;
    const availableHeight = window.screen.availHeight || window.outerHeight;
    // Leave room for the browser frame and OS taskbar on smaller displays.
    const width = Math.min(460, Math.max(100, availableWidth - 32));
    const height = Math.min(780, Math.max(100, availableHeight - 80));
    const left = Math.round(Number.isFinite(window.screen.availLeft)
      ? window.screen.availLeft + (availableWidth - width) / 2
      : window.screenX + (window.outerWidth - width) / 2);
    const top = Math.round(Number.isFinite(window.screen.availTop)
      ? window.screen.availTop + (availableHeight - height) / 2
      : window.screenY + (window.outerHeight - height) / 2);
    const popup = window.open(url, 'blog-reward-payment', `popup,width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`);
    if (popup) {
      try {
        // Named windows can be reused: re-center using their real outer size.
        if (typeof popup.moveTo === 'function') {
          const chromeWidth = Math.max(0, popup.outerWidth - popup.innerWidth);
          const chromeHeight = Math.max(0, popup.outerHeight - popup.innerHeight);
          popup.resizeTo(width + chromeWidth, height + chromeHeight);
          popup.moveTo(Math.round(left - chromeWidth / 2), Math.round(top - chromeHeight / 2));
        }
      } catch { /* Some browsers restrict moving or resizing a popup. */ }
      popup.focus();
    }
    return popup;
  }
  function mount(root) {
    if (root.querySelector('.article-reward')) return;
    const section = document.createElement('section');
    section.className = 'article-reward';
    section.setAttribute('aria-labelledby', 'rewardTitle');
    section.innerHTML = `
      <div class="reward-ending" aria-hidden="true"><span></span>本卷终<span></span></div>
      <div class="reward-copy"><p class="reward-kicker">字里行间 · 感谢相逢</p>
        <h2 id="rewardTitle">一杯咖啡，一份心意</h2>
        <p class="reward-message">如果这篇文章/视频对你有帮助，<br>请我喝杯瑞幸吧</p>
      </div>
      <button type="button" class="reward-submit" aria-label="打赏：请我喝杯瑞幸，在独立窗口选择金额">赏</button>
      <p class="reward-caption">一杯瑞幸，续写下一卷</p>
      <p class="reward-window-note" role="status"></p>`;
    root.append(section);
    section.querySelector('.reward-submit').addEventListener('click', () => {
      const url = new URL('./reward.html', location.href);
      url.searchParams.set('amount', '5.00');
      url.searchParams.set('theme', document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');
      const popup = openPaymentWindow(url.href);
      const note = section.querySelector('.reward-window-note');
      note.replaceChildren();
      if (popup) {
        note.textContent = '心意已展开，请在独立窗口选择金额。';
      } else {
        note.append('浏览器拦截了支付窗口，');
        const retry = document.createElement('a');
        retry.href = url.href;
        retry.target = '_blank';
        retry.rel = 'noopener';
        retry.textContent = '点击打开支付页';
        note.append(retry);
      }
    });
  }
  window.addEventListener('article:rendered', event => mount(event.detail.root));
  const root = document.querySelector('#articleDetail');
  if (root?.querySelector('.article-body')) mount(root);
})();
