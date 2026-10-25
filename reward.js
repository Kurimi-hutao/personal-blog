(() => {
  const template = `
    <div class="payment-topline"><span>字里行间 · 感谢相逢</span><span class="payment-seal" aria-hidden="true">谢</span></div>
    <header class="payment-header">
      <div><p class="eyebrow">一杯咖啡，一份心意</p><h2 id="paymentTitle">请我喝杯瑞幸</h2></div>
      <img class="payment-coffee" src="./assets/reward/ink-coffee.webp" width="96" height="112" alt="" aria-hidden="true">
    </header>
    <fieldset class="payment-choices"><legend>选一份心意 <span>最高 200 元</span></legend>
      <div class="payment-presets">
        <label><input type="radio" name="rewardAmount" value="1"><span>¥ <b>1</b></span></label>
        <label><input type="radio" name="rewardAmount" value="5" checked><span>¥ <b>5</b></span></label>
        <label><input type="radio" name="rewardAmount" value="10"><span>¥ <b>10</b></span></label>
        <label><input type="radio" name="rewardAmount" value="custom"><span>自选</span></label>
      </div>
      <div class="payment-custom" id="customAmountBox" hidden><label for="rewardCustom">自选金额（元）</label><input id="rewardCustom" type="number" min="0.01" max="200" step="0.01" inputmode="decimal" placeholder="0.01–200" aria-describedby="invalidAmount" disabled></div>
    </fieldset>
    <p id="invalidAmount" role="alert" hidden>请输入 0.01–200 元之间的金额，最多两位小数。</p>
    <div id="paymentContent">
      <div class="payment-methods" role="group" aria-label="选择支付方式"><button type="button" data-provider="wechat" aria-pressed="true">微信支付</button><button type="button" data-provider="alipay" aria-pressed="false">支付宝</button></div>
      <figure class="payment-qr"><img id="paymentQr" src="./assets/reward/wechat.png" alt="微信收款二维码" width="280" height="280"><figcaption id="paymentCaption">请使用微信扫一扫</figcaption></figure>
      <p class="payment-amount"><span>本次心意</span><strong id="paymentAmount">¥5.00</strong></p>
      <p class="payment-instruction" id="paymentInstruction" aria-live="polite"></p>
      <a class="save-qr" id="saveQr" href="./assets/reward/wechat.png" download="wechat-reward.png">保存收款码 <span aria-hidden="true">↓</span></a>
      <p class="payment-note">手机可保存收款码，在支付 App 中从相册识别。</p>
      <p class="payment-error" id="paymentError" role="alert" hidden>收款码暂时无法加载，请稍后刷新重试。</p>
    </div>
    <button type="button" id="closePayment" class="close-payment">收起心意，继续阅读 <span aria-hidden="true">↗</span></button>
    <footer>一杯瑞幸，续写下一卷</footer>
  `;
  function create(options = {}) {
    const root = document.createElement('main');
    root.className = 'reward-payment payment-card';
    root.innerHTML = template;
    const sourceAmount = options.amount ?? '5.00';
  const radios = [...root.querySelectorAll('[name="rewardAmount"]')];
  const customInput = root.querySelector('#rewardCustom');
  const content = root.querySelector('#paymentContent');
  const invalid = root.querySelector('#invalidAmount');
  const isValid = raw => /^\d+(?:\.\d{1,2})?$/.test(raw) && Number(raw) >= 0.01 && Number(raw) <= 200;
  let chosen = isValid(sourceAmount) && ['1', '5', '10'].includes(String(Number(sourceAmount))) ? String(Number(sourceAmount)) : 'custom';
  if (chosen === 'custom' && isValid(sourceAmount)) customInput.value = sourceAmount;
  function renderAmount(updateUrl = false) {
    const custom = chosen === 'custom';
    root.querySelector('#customAmountBox').hidden = !custom;
    customInput.disabled = !custom;
    radios.forEach(radio => { radio.checked = radio.value === chosen; });
    const raw = custom ? customInput.value : chosen;
    const valid = isValid(raw);
    invalid.hidden = valid;
    content.hidden = !valid;
    customInput.setAttribute('aria-invalid', String(custom && !valid));
    if (valid) {
      const formatted = `¥${Number(raw).toFixed(2)}`;
      root.querySelector('#paymentAmount').textContent = formatted;
      root.querySelector('#paymentInstruction').textContent = `扫码后请手动输入 ${formatted}，核对后再支付。`;
      if (updateUrl && options.syncUrl) {
        const url = new URL(location.href);
        url.searchParams.set('amount', Number(raw).toFixed(2));
        history.replaceState(null, '', url);
      }
    }
  }
  radios.forEach(radio => radio.addEventListener('change', () => {
    if (!radio.checked) return;
    chosen = radio.value;
    renderAmount(true);
    if (chosen === 'custom') customInput.focus();
  }));
  customInput.addEventListener('input', () => renderAmount(true));
  renderAmount();
  const providers = { wechat: '微信', alipay: '支付宝' };
  const image = root.querySelector('#paymentQr');
  const error = root.querySelector('#paymentError');
  image.addEventListener('error', () => { error.hidden = false; });
  image.addEventListener('load', () => { error.hidden = true; });
  root.querySelectorAll('[data-provider]').forEach(button => {
    button.addEventListener('click', () => {
      const provider = button.dataset.provider;
      root.querySelectorAll('[data-provider]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
      image.src = `./assets/reward/${provider}.png`;
      image.alt = `${providers[provider]}收款二维码`;
      root.querySelector('#paymentCaption').textContent = `请使用${providers[provider]}扫一扫`;
      const download = root.querySelector('#saveQr');
      download.href = image.src;
      download.download = `${provider}-reward.png`;
    });
  });

    root.querySelector('#closePayment').addEventListener('click', () => options.onClose?.());
    return root;
  }
  window.RewardPayment = { create };
  const standalone = document.querySelector('#standalonePayment');
  if (standalone) {
    const params = new URLSearchParams(location.search);
    const payment = create({
      amount: params.has('amount') ? params.get('amount') : '5.00',
      syncUrl: true,
      onClose: () => { location.href = './articles.html'; }
    });
    standalone.replaceWith(payment);
  }
})();
