const assert = require('node:assert/strict');
const path = require('node:path');
const os = require('node:os');
const fs = require('node:fs');
const bundled = path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules');
const { chromium } = require(require.resolve('playwright', { paths: [process.cwd(), bundled] }));
const { installFixtures } = require('./review-fixtures.cjs');

async function main() {
  const systemChrome = path.join(process.env.ProgramFiles || '', 'Google/Chrome/Application/chrome.exe');
  const executablePath = process.env.CHROME_PATH || (fs.existsSync(systemChrome) ? systemChrome : undefined);
  const browser = await chromium.launch({ executablePath });
  try {
    for (const width of [1440, 390]) {
      const context = await browser.newContext({ viewport: { width, height: 844 }, reducedMotion: 'reduce', serviceWorkers: 'block' });
      process.env.REVIEW_LOCAL_FILES = '1';
      await installFixtures(context);
      const lesson = { id: 'fixture-lesson', slug: 'ai-from-zero-lesson-018', title: '第18课｜课程目录验收' };
      await context.route('**/rest/v1/articles?**', route => {
        if (!new URL(route.request().url()).searchParams.get('slug')?.startsWith('like.')) return route.fallback();
        return route.fulfill({ json: [lesson], headers: { 'access-control-allow-origin': '*' } });
      });
      const page = await context.newPage();
      await page.goto('http://localhost:8000/index.html');
      assert(await page.locator('#readingReturnList a').isVisible());
      await page.evaluate(record => localStorage.setItem('hutao-reading-positions', JSON.stringify({ [record.id]: {...record, ratio:.44, updatedAt:Date.now()} })), lesson);
      await page.reload();
      await page.locator('#readingReturnList img').evaluate(img => img.decode());
      assert.match(await page.locator('#readingReturnList').innerText(), /44%/);
      await page.locator('#courseIndex summary').click();
      await page.locator('#courseList a').waitFor();
      assert.match(await page.locator('#courseList a').innerText(), /18[\s\S]+44%/);
      await page.locator('#linksToggle').scrollIntoViewIfNeeded();
      for (const icon of await page.locator('#stationFavorites img').all()) await icon.evaluate(img => img.decode());
      await page.locator('#stationFavorites img').first().evaluate(img => { img.src = '/missing-logo.png'; });
      await page.waitForFunction(() => document.querySelector('#stationFavorites .friend-logo:empty')?.dataset.initial);
      await page.goto('http://localhost:8000/videos.html');
      await page.locator('.video-title-card').nth(1).waitFor();
      assert.match(await page.locator('.video-title-card').nth(1).innerText(), /未题封面的录像/);
      await context.close();
      console.log('PASS course, resume, station icons and video title card at ' + width);
    }
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
