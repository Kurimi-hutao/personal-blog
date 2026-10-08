const { chromium } = require('C:/Users/emmmm/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const { installFixtures } = require('./review-fixtures.cjs');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const origin = process.env.VISUAL_REVIEW_ORIGIN || 'http://127.0.0.1:8000';
const output = 'screenshots/visual-refresh';
fs.mkdirSync(output, { recursive: true });
const results = [];

(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  try {
    for (const width of [1440, 390, 320]) {
      const context = await browser.newContext({ viewport: { width, height: 920 }, serviceWorkers: 'block', reducedMotion: 'reduce' });
      await installFixtures(context, { origin });
      await context.route('**/rest/v1/comments**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
      const errors = [];
      context.on('page', page => page.on('pageerror', e => errors.push(e.message)));
      const page = await context.newPage();
      for (const name of ['articles', 'videos', 'works']) {
        await page.goto(`${origin}/${name}.html`);
        await page.evaluate(() => document.fonts.ready);
        await page.evaluate(() => { document.documentElement.dataset.theme = 'dark'; });
        await page.waitForTimeout(350);
        const visual = await page.locator('.scene-banner').evaluate(el => ({
          image: getComputedStyle(el, '::before').backgroundImage,
          filter: getComputedStyle(el, '::before').filter,
          width: el.getBoundingClientRect().width,
        }));
        assert(visual.image.includes(width <= 700 ? 'night-mobile.webp' : 'night.webp'));
        assert.equal(visual.filter, 'none');
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
        await page.screenshot({ path: `${output}/${name}-${width}-night.png` });
        await page.evaluate(() => { document.documentElement.dataset.theme = 'light'; });
        await page.screenshot({ path: `${output}/${name}-${width}-day.png` });
        if (name !== 'works') {
          const input = name === 'articles' ? '#articleSearch' : '#videoSearch';
          await page.fill(input, 'no-matching-result-xyz');
          await page.waitForSelector('.ink-state--search');
          await page.locator('.ink-state').scrollIntoViewIfNeeded();
          await page.screenshot({ path: `${output}/${name}-${width}-empty.png` });
          await page.getByRole('button', { name: '清除筛选', exact: true }).last().click();
          await page.waitForSelector(name === 'articles' ? '.article-list-card' : '.video-card');
          assert.equal(await page.locator(input).inputValue(), '');
        }
        results.push({ width, name, nightAsset: visual.image, overflow: false });
      }
      await page.goto(`${origin}/article.html?slug=review-0`);
      await page.waitForSelector('#commentList .ink-state--comments');
      assert((await page.locator('#bookmarkArticle').evaluate(el => getComputedStyle(el, '::before').backgroundImage)).includes('icon-bookmark.webp'));
      await page.locator('#commentList').scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${output}/comments-${width}.png` });
      assert.equal(await page.locator('.ink-site-loader').count(), 0);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await page.goto(`${origin}/index.html`);
      for (const [selector, icon] of [['#articles .section-heading h2', 'scroll'], ['#videos .section-heading h2', 'lantern'], ['#messageForm label:last-of-type > span', 'brush'], ['#checkinButton', 'seal']]) {
        assert((await page.locator(selector).evaluate(el => getComputedStyle(el, '::before').backgroundImage)).includes(`icon-${icon}.webp`));
      }
      await page.locator('.message-section').scrollIntoViewIfNeeded();
      await page.waitForSelector('#guestbookList .ink-state--comments');
      assert.equal(await page.locator('.ink-site-loader').count(), 0);
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
      await page.locator('.site-search-trigger').click();
      await page.fill('.site-search-field input', 'no-matching-result-xyz');
      await page.waitForSelector('.site-search-results .ink-state--search');
      await page.screenshot({ path: `${output}/search-${width}.png` });
      const icon = await page.locator('link[rel="apple-touch-icon"]').getAttribute('href');
      assert(icon.includes('home-icon-180.png'));
      assert.equal((await page.request.get(origin + '/assets/visual-refresh/favicon.ico')).status(), 200);
      assert.deepEqual(errors, []);
      await context.close();
    }

    // Real request failure -> illustrated retry -> loaded content, with no backend writes.
    const context = await browser.newContext({ viewport: { width: 1100, height: 900 }, serviceWorkers: 'block' });
    await installFixtures(context, { origin });
    let failure = true;
    let delay = 0;
    await context.route('**/rest/v1/articles**', async route => {
      if (failure) return route.fulfill({ status: 503, contentType: 'application/json', body: '{"message":"test unavailable"}' });
      if (delay) await new Promise(resolve => setTimeout(resolve, delay));
      return route.fallback();
    });
    const page = await context.newPage();
    await page.goto(`${origin}/articles.html`);
    await page.waitForSelector('.ink-state--error');
    await page.locator('.ink-state').scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${output}/load-error.png` });
    failure = false;
    delay = 1000;
    await page.getByRole('button', { name: '重新翻阅' }).click();
    await page.waitForSelector('.ink-loading');
    await page.screenshot({ path: `${output}/loading.png` });
    await page.waitForSelector('.article-list-card');
    delay = 0;
    assert.equal(await page.locator('#articleList').getAttribute('aria-busy'), null);

    await page.goto(`${origin}/index.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.ink-site-loader');
    await page.screenshot({ path: `${output}/seal-intro.png` });
    await page.waitForSelector('.ink-site-loader', { state: 'detached', timeout: 2000 });
    await page.reload();
    assert.equal(await page.locator('.ink-site-loader').count(), 0);
    assert.equal(await page.locator('body').evaluate(el => el.classList.contains('motion-home-opening')), false);
    results.push({ retry: 'passed', reducedMotion: 'passed', introOnce: 'passed', icons: 'passed' });
    await context.close();
    fs.writeFileSync(`${output}/results.json`, JSON.stringify(results, null, 2));
    console.log(JSON.stringify(results, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
