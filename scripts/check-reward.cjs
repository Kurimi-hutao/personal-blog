const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('C:/Users/emmmm/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const { installFixtures } = require('./review-fixtures.cjs');
const origin = 'http://127.0.0.1:8000';
(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  try {
    const context = await browser.newContext({ serviceWorkers: 'block', reducedMotion: 'reduce' });
    await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    await installFixtures(context, { origin });
    if (process.env.REWARD_PUBLISH_ROOT) {
      const overlay = path.resolve(process.env.REWARD_PUBLISH_ROOT);
      await context.route(origin + '/**', async route => {
        const file = new URL(route.request().url()).pathname.slice(1);
        if (!['article.html', 'article-detail.js'].includes(file)) return route.fallback();
        await route.fulfill({ body: await fs.readFile(path.join(overlay, file)), contentType: file.endsWith('.html') ? 'text/html' : 'text/javascript' });
      });
    }
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(origin + '/article.html?slug=review-0');
    await page.locator('.article-reward').waitFor();
    assert.equal(await page.locator('.article-reward').count(), 1);
    assert.equal(await page.locator('input[name=rewardAmount]:checked').inputValue(), '5');
    for (const amount of ['1', '5', '10', 'custom']) {
      await page.locator(`.reward-amounts label:has(input[value="${amount}"])`).click();
      if (amount === 'custom') {
        await page.locator('#rewardCustom').fill('201');
        await page.locator('.reward-submit').click();
        assert.equal(context.pages().length, 1, 'Over-limit amount must not open payment');
        await page.locator('#rewardCustom').fill('0');
        await page.locator('.reward-submit').click();
        assert.equal(context.pages().length, 1, 'Zero must not open payment');
        await page.locator('#rewardCustom').fill('1.001');
        await page.locator('.reward-submit').click();
        assert.equal(context.pages().length, 1, 'Fractional cents must not open payment');
        await page.locator('#rewardCustom').fill('200');
      }
      const popupPromise = page.waitForEvent('popup');
      await page.locator('.reward-submit').click();
      const popup = await popupPromise;
      await popup.waitForLoadState();
      assert.equal(await popup.locator('#paymentAmount').textContent(), `¥${Number(amount === 'custom' ? 200 : amount).toFixed(2)}`);
      await popup.getByRole('button', { name: '支付宝', exact: true }).click();
      assert.match(await popup.locator('#paymentQr').getAttribute('src'), /alipay\.png/);
      await popup.waitForFunction(() => document.querySelector('#paymentQr').naturalWidth > 0);
      assert.match(await popup.locator('#saveQr').getAttribute('download'), /alipay/);
      await popup.getByRole('button', { name: '微信支付' }).click();
      await popup.waitForFunction(() => document.querySelector('#paymentQr').naturalWidth > 0);
      assert.match(await popup.locator('#paymentInstruction').textContent(), /手动输入/);
      if (amount === 'custom') {
        await fs.mkdir(path.join(__dirname, '../outputs/reward'), { recursive: true });
        await popup.screenshot({ path: path.join(__dirname, '../outputs/reward/payment-desktop.png'), fullPage: true });
      }
      await Promise.all([popup.waitForEvent('close'), popup.locator('#closePayment').click()]);
    }
    // Switching away from an invalid custom amount must restore the preset.
    await page.locator('#rewardCustom').fill('300');
    await page.locator('.reward-amounts label:has(input[value="5"])').click();
    assert.equal(await page.locator('#rewardCustom').isDisabled(), true);
    await page.evaluate(() => { window.open = () => null; });
    await page.locator('.reward-submit').click();
    assert.match(await page.locator('.reward-window-note a').getAttribute('href'), /amount=5.00/);
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      await page.locator('.article-reward').scrollIntoViewIfNeeded();
      assert(await page.locator('.article-reward').evaluate(el => el.getBoundingClientRect().right <= innerWidth), `Reward fits ${width}px`);
      await page.screenshot({ path: path.join(__dirname, `../outputs/reward/article-${width}.png`), fullPage: false });
    }
    await page.goto(origin + '/article.html?slug=video-0');
    await page.locator('.article-reward').waitFor();
    assert.equal(await page.locator('.article-reward').count(), 1, 'Video also has reward');
    for (const invalid of ['', '-1', '0', '201', 'NaN', '1.001', 'Infinity']) {
      await page.goto(origin + '/reward.html?amount=' + encodeURIComponent(invalid));
      assert.equal(await page.locator('#invalidAmount').isVisible(), true);
      assert.equal(await page.locator('#paymentContent').isVisible(), false);
    }
    await page.goto(origin + '/reward.html?amount=0.01');
    assert.equal(await page.locator('#paymentAmount').textContent(), '¥0.01');
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Payment fits 320px');
    await page.screenshot({ path: path.join(__dirname, '../outputs/reward/payment-320.png'), fullPage: true });
    assert.deepEqual(errors, []);
    await context.close();
    console.log('PASS: article/video entry, presets, custom bounds/precision, popup, provider switch, download, close, popup blocking, 320/390/1440px layout, invalid URL guard, no JS errors.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
