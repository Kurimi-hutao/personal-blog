(() => {
  const params = new URLSearchParams(location.search);
  const sourceAmount = params.has('amount') ? params.get('amount') : '5.00';
  const radios = [...document.querySelectorAll('[name="rewardAmount"]')];
  const customInput = document.querySelector('#rewardCustom');
  const content = document.querySelector('#paymentContent');
  const invalid = document.querySelector('#invalidAmount');
  const isValid = raw => /^\d+(?:\.\d{1,2})?$/.test(raw) && Number(raw) >= 0.01 && Number(raw) <= 200;
  let chosen = isValid(sourceAmount) && ['1', '5', '10'].includes(String(Number(sourceAmount))) ? String(Number(sourceAmount)) : 'custom';
  if (chosen === 'custom' && isValid(sourceAmount)) customInput.value = sourceAmount;
  function renderAmount(updateUrl = false) {
    const custom = chosen === 'custom';
    document.querySelector('#customAmountBox').hidden = !custom;
    customInput.disabled = !custom;
    radios.forEach(radio => { radio.checked = radio.value === chosen; });
    const raw = custom ? customInput.value : chosen;
    const valid = isValid(raw);
    invalid.hidden = valid;
    content.hidden = !valid;
    customInput.setAttribute('aria-invalid', String(custom && !valid));
    if (valid) {
      const formatted = `¥${Number(raw).toFixed(2)}`;
      document.querySelector('#paymentAmount').textContent = formatted;
      document.querySelector('#paymentInstruction').textContent = `扫码后请手动输入 ${formatted}，核对后再支付。`;
      if (updateUrl) {
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
  const image = document.querySelector('#paymentQr');
  const error = document.querySelector('#paymentError');
  image.addEventListener('error', () => { error.hidden = false; });
  image.addEventListener('load', () => { error.hidden = true; });
  document.querySelectorAll('[data-provider]').forEach(button => {
    button.addEventListener('click', () => {
      const provider = button.dataset.provider;
      document.querySelectorAll('[data-provider]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
      image.src = `./assets/reward/${provider}.png`;
      image.alt = `${providers[provider]}收款二维码`;
      document.querySelector('#paymentCaption').textContent = `请使用${providers[provider]}扫一扫`;
      const download = document.querySelector('#saveQr');
      download.href = image.src;
      download.download = `${provider}-reward.png`;
    });
  });
  document.querySelector('#closePayment').addEventListener('click', () => {
    window.close();
    document.querySelector('#closeNote').textContent = '若窗口未关闭，请手动关闭此标签页，回到文章继续阅读。';
  });
})();
