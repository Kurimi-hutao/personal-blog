const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('C:/Users/emmmm/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const { installFixtures } = require('./review-fixtures.cjs');

const root = path.resolve(__dirname, '..');
const origin = 'http://blog.test';
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };

(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  try {
    for (const fallback of [false, true]) {
      const context = await browser.newContext({ serviceWorkers: 'block', reducedMotion: 'reduce' });
      try {
        // Serve workspace files and synthetic API responses; never contact the live service.
        await context.route('**/*', async route => {
          const url = new URL(route.request().url());
          if (url.origin !== origin) return route.abort();
          const file = path.resolve(root, '.' + decodeURIComponent(url.pathname));
          if (!file.startsWith(root + path.sep)) return route.abort();
          try {
            await route.fulfill({ body: await fs.readFile(file), contentType: mime[path.extname(file)] || 'application/octet-stream' });
          } catch {
            await route.fulfill({ status: 404, body: '' });
          }
        });
        await installFixtures(context, { origin });
        let fallbackCount = 0;
        if (fallback) {
          await context.route('**/rest/v1/articles?**', async route => {
            const url = new URL(route.request().url());
            if (url.searchParams.get('select').includes('series_name')) {
              fallbackCount++;
              return route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ message: 'column articles.series_name does not exist' }) });
            }
            return route.fallback();
          });
        }
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.goto(origin + '/articles.html');
        await page.locator('.article-list-card').first().waitFor();
        const localSlugs = await page.evaluate(() => (window.LOCAL_ARTICLES || [])
          .filter(item => item.content_type === 'article' && item.published !== false && !item.deleted_at)
          .map(item => item.slug));
        const expectedSlugs = [...new Set([...localSlugs, ...Array.from({ length: 5 }, (_, i) => `review-${i}`)])].sort();
        const slugs = await page.locator('.article-list-card').evaluateAll(cards => cards.map(card => new URL(card.href).searchParams.get('slug')));
        assert.deepEqual(slugs.sort(), expectedSlugs, 'Keep local and remote articles, excluding all published videos');
        assert.equal(await page.locator('#articleResultCount').textContent(), `共找到 ${expectedSlugs.length} 篇文章`);
        await page.locator('#articleSearch').fill('一振入江湖');
        await page.waitForFunction(() => document.querySelector('#articleResultCount').textContent === '共找到 0 篇文章');
        await page.locator('#clearFilters').click();
        await page.waitForFunction(count => document.querySelectorAll('.article-list-card').length === count, expectedSlugs.length);
        await page.goto(origin + '/videos.html');
        await page.locator('.video-card').first().waitFor();
        assert.equal(await page.locator('.video-card').count(), 4, 'Published videos must remain in the video page');
        if (fallback) assert.equal(fallbackCount, 2, 'Both pages must exercise the V6 fallback');
        assert.deepEqual(errors, []);
        console.log(`PASS: ${fallback ? 'V6 fallback' : 'current schema'}: article list, count, search, reset, and video page`);
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
