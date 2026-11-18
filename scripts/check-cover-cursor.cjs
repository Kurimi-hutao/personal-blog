const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { installFixtures } = require('./review-fixtures.cjs');
const bundled = path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules');
const { chromium, devices } = require(require.resolve('playwright', { paths: [process.cwd(), bundled] }));

const origin = 'http://localhost:8000';
const posterHost = 'https://uhcmzlhzrgyjnvqnnpss.supabase.co';
const posterPath = '/storage/v1/object/public/article-attachments/bilibili-covers/BV1V2J16ME7Z.jpg';
const video = {
  id: 'cover-cursor-fixture',
  slug: 'isaac-newton-bilibili-video',
  title: 'Isaac Newton',
  category: '视频',
  published_at: '2026-11-13T01:00:00Z',
  content_type: 'video',
  video_url: 'https://www.bilibili.com/video/BV1V2J16ME7Z/',
  video_poster: posterHost + posterPath,
};
const coverSelector = 'img[src*="/assets/video-covers/isaac-newton-bilibili-video.webp"]';

async function run() {
  const chrome = path.join(process.env.ProgramFiles || '', 'Google/Chrome/Application/chrome.exe');
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || (fs.existsSync(chrome) ? chrome : undefined) });
  process.env.REVIEW_LOCAL_FILES = '1';
  try {
    const results = await Promise.allSettled([
      (async () => {
        const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' });
        await desktop.route('**/*', route => route.abort());
        await installFixtures(desktop);
        await desktop.addInitScript(() => {
          Object.defineProperty(navigator, 'hardwareConcurrency', { value: 8 });
          Object.defineProperty(navigator, 'deviceMemory', { value: 8 });
        });
        const page = await desktop.newPage();
        for (const route of ['/', '/videos.html']) {
          await page.goto(origin + route);
          const cursorVisible = () => page.evaluate(() => {
            const native = getComputedStyle(document.elementFromPoint(1, 105)).cursor !== 'none';
            const overlay = document.querySelector('.ink-cursor');
            const styles = overlay && getComputedStyle(overlay);
            return native || (styles?.display !== 'none' && styles?.visibility === 'visible' && Number(styles?.opacity) > 0);
          });
          assert.equal(await cursorVisible(), true, route + ' before movement');
          await page.mouse.move(35, 115);
          await page.mouse.move(1, 105);
          await page.waitForFunction(() => document.documentElement.classList.contains('cursor-ready'));
          await page.waitForTimeout(1800);
          assert.equal(await cursorVisible(), true, route + ' after the pointer stops');
          await page.emulateMedia({ reducedMotion: 'reduce' });
          await page.waitForFunction(() => !document.documentElement.classList.contains('cursor-ready'));
          assert.equal(await cursorVisible(), true, route + ' with reduced motion');
          await page.emulateMedia({ reducedMotion: 'no-preference' });
          await page.waitForFunction(() => !matchMedia('(prefers-reduced-motion: reduce)').matches);
          assert.equal(await cursorVisible(), true, route + ' before the pointer moves again');
          await page.mouse.move(10, 127);
          await page.waitForFunction(() => document.documentElement.classList.contains('cursor-ready'));
          await page.evaluate(() => window.dispatchEvent(new Event('blur')));
          await page.waitForFunction(() => !document.documentElement.classList.contains('cursor-ready'));
          assert.equal(await cursorVisible(), true, route + ' after losing window focus');
        }
        await desktop.close();
      })(),
      (async () => {
        const mobile = await browser.newContext({ ...devices['iPhone 13'], serviceWorkers: 'block' });
        await mobile.route('**/*', route => route.abort());
        await installFixtures(mobile);
        await mobile.route(posterHost + '/rest/v1/articles?**', route => {
          const params = new URL(route.request().url()).searchParams;
          if (params.get('content_type') !== 'eq.video') return route.fallback();
          return route.fulfill({ json: [video], headers: { 'access-control-allow-origin': '*' } });
        });
        const page = await mobile.newPage();
        for (const [route, section] of [['/', '#latestVideos'], ['/videos.html', '#videoList']]) {
          await page.goto(origin + route);
          await page.locator(section).scrollIntoViewIfNeeded();
          const card = page.locator(section).getByRole('link', { name: /Isaac Newton/ }).first();
          await card.locator(coverSelector).waitFor({ timeout: 8000 });
          await page.waitForFunction(selector => [...document.querySelectorAll(selector)]
            .some(image => image.naturalWidth > 0 && image.style.opacity === '1'), coverSelector);
          assert.equal(await page.evaluate(() => document.documentElement.classList.contains('cursor-ready')), false);
        }
        await mobile.close();
      })(),
    ]);
    const failures = results.filter(result => result.status === 'rejected');
    if (failures.length) throw new AggregateError(failures.map(result => result.reason), 'Browser checks failed');
  } finally {
    await browser.close();
  }
  console.log('PASS: desktop cursor lifecycle and mobile video covers with third-party images blocked');
}

run().catch(error => { console.error(error); process.exitCode = 1; });

