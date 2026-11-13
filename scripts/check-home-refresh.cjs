const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { installFixtures } = require('./review-fixtures.cjs');
const bundled = path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules');
const { chromium } = require(require.resolve('playwright', { paths: [process.cwd(), bundled] }));

async function run() {
  const chrome = path.join(process.env.ProgramFiles || '', 'Google/Chrome/Application/chrome.exe');
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || (fs.existsSync(chrome) ? chrome : undefined) });
  process.env.REVIEW_LOCAL_FILES = '1';
  try {
    for (const width of [1440, 390]) {
      const context = await browser.newContext({ viewport: { width, height: 844 }, serviceWorkers: 'block' });
      await context.route('**/*', route => route.abort());
      await installFixtures(context);
      let mode = 'offline';
      let reads = 0;
      await context.route('**/rest/v1/articles?**', async route => {
        const params = new URL(route.request().url()).searchParams;
        if (params.get('limit') !== '2') return route.fallback();
        reads++;
        assert.equal(params.get('published'), 'eq.true');
        assert.equal(params.get('deleted_at'), 'is.null');
        assert.equal(params.get('order'), 'published_at.desc');
        if (mode === 'offline') return route.fulfill({ status: 403, json: { code: 'denied' } });
        if (mode === 'slow') await new Promise(resolve => setTimeout(resolve, 9000));
        return route.fallback();
      });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto('http://localhost:8000/index.html');
      const videos = page.locator('#latestVideos');
      const notice = page.locator('[data-cache-for="latestVideos"]');
      await videos.scrollIntoViewIfNeeded();
      await notice.waitFor();
      assert.equal(await videos.locator('h3').count(), 2);
      mode = 'online';
      await notice.getByRole('button').click();
      await videos.locator('[href*="video-0"]').waitFor();
      for (let i = 0; i < 5; i++) {
        const before = reads;
        await page.reload({ waitUntil: 'domcontentloaded' });
        await videos.scrollIntoViewIfNeeded();
        await videos.locator('[href*="video-0"]').waitFor();
        await page.waitForFunction(() => ['latestArticles', 'latestVideos'].every(id => {
          const el = document.getElementById(id);
          return !el.dataset.refreshing && el.querySelector('a[href*="slug="]') && !el.querySelector('.static-fallback');
        }));
        assert.equal(reads - before, 2);
      }
      mode = 'slow';
      await page.reload({ waitUntil: 'domcontentloaded' });
      await videos.scrollIntoViewIfNeeded();
      await videos.locator('[href*="video-0"]').waitFor();
      await notice.waitFor({ timeout: 15000 });
      assert.equal(await videos.getAttribute('aria-busy'), null);
      assert.deepEqual(errors, []);
      await context.close();
      console.log('PASS ' + width + 'x844 cold failure, retry, five refreshes and timeout with cached cards');
    }
  } finally { await browser.close(); }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
