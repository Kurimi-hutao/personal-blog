(() => {
  const sourceAmount = new URLSearchParams(location.search).get('amount') || '';
  const amount = Number(sourceAmount);
  const valid = /^\d+(?:\.\d{1,2})?$/.test(sourceAmount) && amount >= 0.01 && amount <= 200;
  document.querySelector('#paymentContent').hidden = !valid;
  document.querySelector('#invalidAmount').hidden = valid;
  const formatted = `¥${amount.toFixed(2)}`;
  if (valid) {
    document.querySelector('#paymentAmount').textContent = formatted;
    document.querySelector('#paymentInstruction').textContent = `扫码后请手动输入 ${formatted}。此收款码不会自动填入金额，请核对后再支付。`;
  }
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
