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
  const cup = '<svg viewBox="0 0 64 64" fill="none" aria-hidden="true"><path d="M14 24h32v15c0 11-6 16-16 16S14 50 14 39V24Z" stroke="currentColor" stroke-width="2"/><path d="M46 28h4a8 8 0 0 1 0 16h-5M9 59h44M24 16c-6-7 5-8 0-15M36 16c-6-7 5-8 0-15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
  function mount(root) {
    if (root.querySelector('.article-reward')) return;
    const section = document.createElement('section');
    section.className = 'article-reward';
    section.setAttribute('aria-labelledby', 'rewardTitle');
    section.innerHTML = `
      <div class="reward-illustration">${cup}<span>一杯心意</span></div>
      <div class="reward-copy"><p class="reward-kicker">卷尾小憩 · THANK YOU</p>
        <h2 id="rewardTitle">如果这篇文章/视频对你有帮助，<br>请我喝杯瑞幸吧</h2>
        <p>创作路上，感谢你的每一份心意。</p>
      </div>
      <form class="reward-form">
        <fieldset><legend class="sr-only">选择打赏金额</legend>
          <div class="reward-amounts">
            <label><input type="radio" name="rewardAmount" value="1"><span>¥ <b>1</b></span></label>
            <label><input type="radio" name="rewardAmount" value="5" checked><span>¥ <b>5</b></span></label>
            <label><input type="radio" name="rewardAmount" value="10"><span>¥ <b>10</b></span></label>
            <label><input type="radio" name="rewardAmount" value="custom"><span>自选金额</span></label>
          </div>
          <div class="reward-custom" hidden><label for="rewardCustom">自选金额（元）</label>
            <input id="rewardCustom" type="number" min="0.01" max="200" step="0.01" inputmode="decimal" placeholder="0.01–200" aria-describedby="rewardLimit" disabled>
          </div>
        </fieldset>
        <p id="rewardLimit" class="reward-limit">随心打赏，最高 200 元</p>
        <button type="submit" class="reward-submit">请我喝杯瑞幸 <span aria-hidden="true">↗</span></button>
        <p class="reward-window-note" role="status"></p>
      </form>`;
    root.append(section);
    const form = section.querySelector('form');
    const customBox = section.querySelector('.reward-custom');
    const customInput = section.querySelector('#rewardCustom');
    form.addEventListener('change', event => {
      if (!event.target.matches('input[name="rewardAmount"]')) return;
      const custom = form.elements.rewardAmount.value === 'custom';
      customBox.hidden = !custom;
      customInput.disabled = !custom;
      customInput.required = custom;
      if (custom) customInput.focus();
    });
    form.addEventListener('submit', event => {
      event.preventDefault();
      const selected = form.elements.rewardAmount.value;
      const amount = Number(selected === 'custom' ? customInput.value : selected);
      if (!Number.isFinite(amount) || amount < 0.01 || amount > 200 || Math.abs(amount * 100 - Math.round(amount * 100)) > 1e-7) {
        customInput.setCustomValidity('请输入 0.01–200 元之间的金额，最多两位小数。');
        customInput.reportValidity();
        return;
      }
      const url = new URL('./reward.html', location.href);
      url.searchParams.set('amount', amount.toFixed(2));
      const popup = openPaymentWindow(url.href);
      const note = section.querySelector('.reward-window-note');
      note.replaceChildren();
      if (popup) {
        note.textContent = '支付窗口已打开，扫码后请手动输入所选金额。';
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
    customInput.addEventListener('input', () => customInput.setCustomValidity(''));
  }
  window.addEventListener('article:rendered', event => mount(event.detail.root));
  const root = document.querySelector('#articleDetail');
  if (root?.querySelector('.article-body')) mount(root);
})();
