(() => {
  let dialog;
  let activeTrigger;
  let closing = false;
  let scrollState;
  const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function lockScroll() {
    const body = document.body;
    const keys = ['position', 'top', 'left', 'width', 'paddingRight'];
    scrollState = { x: window.scrollX, y: window.scrollY, overflow: document.documentElement.style.overflow, values: Object.fromEntries(keys.map(key => [key, body.style[key]])) };
    const gap = Math.max(0, window.innerWidth - document.documentElement.clientWidth);
    const padding = parseFloat(getComputedStyle(body).paddingRight) || 0;
    document.documentElement.style.overflow = 'hidden';
    body.style.position = 'fixed';
    body.style.top = `-${scrollState.y}px`;
    body.style.left = `-${scrollState.x}px`;
    body.style.width = '100%';
    body.style.paddingRight = `${padding + gap}px`;
  }
  function unlockScroll() {
    if (!scrollState) return;
    Object.assign(document.body.style, scrollState.values);
    document.documentElement.style.overflow = scrollState.overflow;
    window.scrollTo({ left: scrollState.x, top: scrollState.y, behavior: 'instant' });
    scrollState = null;
  }
  function closeDialog() {
    if (!dialog?.open || closing) return;
    closing = true;
    dialog.classList.add('is-closing');
    const finish = () => { if (dialog.open) dialog.close(); };
    if (reducedMotion()) finish();
    else dialog.animate([{ opacity: 1, transform: 'translateY(0) scale(1)' }, { opacity: 0, transform: 'translateY(8px) scale(.985)' }], { duration: 140, easing: 'ease-in', fill: 'forwards' }).finished.then(finish, finish);
  }
  function ensureDialog() {
    if (dialog) return dialog;
    dialog = document.createElement('dialog');
    dialog.id = 'articleRewardDialog';
    dialog.className = 'reward-dialog';
    dialog.setAttribute('aria-labelledby', 'paymentTitle');
    dialog.innerHTML = `<div class="reward-dialog-bar"><span>一杯心意</span><button type="button" class="reward-dialog-close" aria-label="关闭打赏卡片">×</button></div><div class="reward-dialog-scroll"></div>`;
    const payment = window.RewardPayment.create({ onClose: closeDialog });
    dialog.querySelector('.reward-dialog-scroll').append(payment);
    dialog.querySelector('.reward-dialog-close').addEventListener('click', closeDialog);
    dialog.addEventListener('cancel', event => { event.preventDefault(); closeDialog(); });
    dialog.addEventListener('keydown', event => {
      if (event.key !== 'Tab') return;
      const controls = [...dialog.querySelectorAll('button:not([disabled]), a[href], input:not([disabled])')].filter(element => element.getClientRects().length && (element.type !== 'radio' || element.checked));
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    });
    let startedOutside = false;
    const outside = event => { const rect = dialog.getBoundingClientRect(); return event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom; };
    dialog.addEventListener('pointerdown', event => { startedOutside = event.target === dialog && outside(event); });
    dialog.addEventListener('click', event => { if (startedOutside && event.target === dialog && outside(event)) closeDialog(); startedOutside = false; });
    dialog.addEventListener('close', () => {
      dialog.getAnimations().forEach(animation => animation.cancel());
      dialog.classList.remove('is-closing');
      closing = false;
      unlockScroll();
      activeTrigger?.focus({ preventScroll: true });
    });
    document.body.append(dialog);
    return dialog;
  }
  function openDialog(trigger) {
    const panel = ensureDialog();
    if (panel.open) return;
    activeTrigger = trigger;
    lockScroll();
    panel.showModal();
    panel.querySelector('.reward-dialog-scroll').scrollTop = 0;
    panel.querySelector('.reward-dialog-close').focus({ preventScroll: true });
    if (!reducedMotion()) panel.animate([{ opacity: 0, transform: 'translateY(12px) scale(.98)' }, { opacity: 1, transform: 'translateY(0) scale(1)' }], { duration: 220, easing: 'cubic-bezier(.2,.7,.2,1)' });
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
      <button type="button" class="reward-submit" aria-label="打赏：请我喝杯瑞幸" aria-haspopup="dialog" aria-controls="articleRewardDialog">赏</button>
      <p class="reward-caption">一杯瑞幸，续写下一卷</p>`;
    root.append(section);
    const trigger = section.querySelector('.reward-submit');
    trigger.addEventListener('click', () => openDialog(trigger));
  }
  window.addEventListener('article:rendered', event => mount(event.detail.root));
  const root = document.querySelector('#articleDetail');
  if (root?.querySelector('.article-body')) mount(root);
})();
