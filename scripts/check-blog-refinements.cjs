// Isolated browser checks: synthetic records, no writes to the live service.
const { chromium } = require('C:/Users/emmmm/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const { installFixtures, records } = require('./review-fixtures.cjs');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const origin = process.env.REVIEW_ORIGIN || 'http://127.0.0.1:8015';
const out = path.resolve('outputs/blog-refinements'); fs.mkdirSync(out, { recursive: true });

(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const results = [];
  try {
    for (const width of [375, 390, 768, 1440]) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, serviceWorkers: 'block', reducedMotion: 'reduce' });
      await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
      await installFixtures(context, { origin });
      await context.route('**/*', route => ['GET', 'HEAD', 'OPTIONS'].includes(route.request().method()) ? route.fallback() : route.abort());
      await context.addInitScript(() => {
        localStorage.setItem('hutao-reading-positions', JSON.stringify({ 'review-0': { slug: 'review-0', title: '山行记', ratio: .42, updatedAt: Date.now() } }));
      });
      for (const file of ['index.html', 'articles.html', 'videos.html', 'works.html', 'article.html?slug=review-0', 'kurumi.html']) {
        const page = await context.newPage(); const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.goto(`${origin}/${file}`, { waitUntil: 'networkidle' });
        await page.waitForFunction(() => !document.documentElement.classList.contains('ink-site-loading'));
        await page.evaluate(() => document.fonts.ready);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${file} overflows at ${width}`);
        assert.deepEqual(errors, [], `${file} script errors`);
        if (file === 'index.html') {
          assert.equal(await page.locator('.hero-actions .ink-button').getAttribute('href'), './articles.html');
          assert.match(await page.locator('#readingReturnList').innerText(), /42%/);
          await page.locator('#homeBookmarks').click();
          assert.equal(await page.locator('[data-search-bookmarks]').getAttribute('aria-pressed'), 'true');
          await page.locator('[data-search-close]').click();
          await page.waitForFunction(() => !document.querySelector('.site-search-dialog').open);
          await page.locator('.site-search-trigger').click();
          await page.locator('.site-search-field input').fill('图鉴');
          await page.waitForFunction(() => document.querySelector('.site-search-results').textContent.includes('永劫无间征神图鉴'));
          assert.equal(await page.locator('.site-search-results a').first().getAttribute('href'), './zhengshen-atlas/');
          await page.locator('[data-search-type="article"]').click();
          await page.waitForFunction(() => document.querySelector('.site-search-results').textContent.includes('未寻得'));
          await page.locator('[data-search-type="all"]').click();
          await page.locator('.site-search-field input').fill('片刻');
          await page.waitForFunction(() => document.querySelector('.search-more'));
          await page.locator('.search-more').click();
          await page.waitForFunction(() => document.querySelectorAll('.site-search-results a').length > 8);
          await page.locator('[data-search-close]').click();
          await page.waitForFunction(() => !document.querySelector('.site-search-dialog').open);
          await page.evaluate(() => scrollTo(0, 0));
          const resources = await page.evaluate(() => performance.getEntriesByType('resource'));
          assert(!resources.some(item => item.name.endsWith('/brand-tigerhat.png') || item.name.includes('/blog-serif/')));
          results.push({ width, bytes: resources.reduce((total, item) => total + item.transferSize, 0), fontRequests: resources.filter(item => item.name.includes('.woff')).length });
        }
        if (file === 'works.html') {
          await page.locator('.work-notes summary').first().click();
          assert.match(await page.locator('.work-notes').first().innerText(), /创作目标/);
        }
        await page.screenshot({ path: path.join(out, `${file.split('?')[0]}-${width}.png`) });
        await page.close();
      }
      // Populate cache first, then fail the service and confirm recovery via retry.
      for (const [file, id, card] of [['articles.html', '#articleList', '.article-list-card'], ['videos.html', '#videoList', '.video-card']]) {
        const page = await context.newPage();
        await page.goto(`${origin}/${file}`, { waitUntil: 'networkidle' });
        await page.waitForSelector(card);
        await page.route('**/rest/v1/articles*', route => route.abort());
        await page.reload({ waitUntil: 'networkidle' });
        await page.waitForSelector('.content-cache-notice');
        assert(await page.locator(card).count() > 0, 'cached cards stay available');
        await page.unroute('**/rest/v1/articles*');
        await page.locator('.content-cache-notice button').click();
        await page.waitForFunction(() => !document.querySelector('.content-cache-notice'));
        await page.waitForSelector(card);
        await page.close();
      }
      await context.close();
      console.log(`Desktop/mobile feature checks passed: ${width}px`);
    }
    // A slow font must not block navigation or reading indefinitely.
    const context = await browser.newContext({ serviceWorkers: 'block', reducedMotion: 'reduce' });
    await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    await context.route('**/*.woff2', async route => { await new Promise(resolve => setTimeout(resolve, 2500)); await route.continue().catch(() => {}); });
    const page = await context.newPage();
    await page.goto(`${origin}/works.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !document.documentElement.classList.contains('ink-site-loading'), null, { timeout: 1800 });
    assert.equal(await page.evaluate(() => document.fonts.status), 'loading');
    await page.waitForLoadState('networkidle');
    await page.route('**/rest/v1/articles*', route => route.abort());
    await page.locator('.site-search-trigger').click();
    await page.locator('.site-search-field input').fill('桌宠');
    await page.waitForFunction(() => document.querySelector('.site-search-results').textContent.includes('桌宠小屋'));
    await page.waitForFunction(() => document.querySelector('.search-status').textContent.includes('暂时无法读取'));
    await page.locator('[data-search-close]').click();
    await page.waitForFunction(() => !document.querySelector('.site-search-dialog').open);
    await page.evaluate(() => { document.documentElement.dataset.theme = 'dark'; });
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: path.join(out, 'works-dark.png') });
    await context.close();
    fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify({ passed: true, results }, null, 2));
    console.log('Slow fonts, offline works search, cache retry and all viewport checks passed.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
