const { chromium } = require('C:/Users/emmmm/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const requests = [];
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2', '.webp': 'image/webp', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  requests.push(new URL(req.url, 'http://local').pathname);
  const file = path.join(root, decodeURIComponent(new URL(req.url, 'http://local').pathname));
  const target = file.endsWith(path.sep) ? path.join(file, 'index.html') : file;
  fs.readFile(target, (err, data) => {
    res.writeHead(err ? 404 : 200, { 'Content-Type': types[path.extname(target)] || 'application/octet-stream' });
    res.end(err ? 'Not found' : data);
  });
});
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  fs.mkdirSync(path.join(root, 'screenshots/loading'), { recursive: true });
  try {
    for (const width of [390, 1440]) {
      for (const reducedMotion of ['no-preference', 'reduce']) {
        const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion, serviceWorkers: 'block' });
        await context.addInitScript(() => sessionStorage.setItem('hutao-seal-intro', 'seen'));
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        let release;
        const gate = new Promise(resolve => { release = resolve; });
        await page.route('**/assets/fonts/**', async route => { await gate; await route.continue(); });
        await page.route(/https:\/\//, route => route.abort());
        await page.goto(origin, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(1500);
        assert(await page.locator('.ink-site-loader:not(.is-leaving)').isVisible(), `loader must wait for fonts: ${width}/${reducedMotion}`);
        if (reducedMotion === 'no-preference') {
          assert.equal(await page.locator('.ink-site-loader__mark img').evaluate(el => getComputedStyle(el).animationIterationCount), 'infinite');
          const cdp = await context.newCDPSession(page);
          const shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
          fs.writeFileSync(path.join(root, `screenshots/loading/waiting-${width}.png`), Buffer.from(shot.data, 'base64'));
          await cdp.detach();
        }
        release();
        await page.locator('.ink-site-loader').waitFor({ state: 'detached', timeout: 30000 });
        assert.equal(await page.evaluate(() => document.fonts.status), 'loaded');
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
        assert.deepEqual(errors, []);
        if (reducedMotion === 'no-preference') await page.screenshot({ path: path.join(root, `screenshots/loading/ready-${width}.png`) });
        console.log(`PASS slow fonts, existing session, ${width}px, ${reducedMotion}`);
        await context.close();
      }
    }

    // Failed font files must settle to readable fallback rather than trap users.
    const failureContext = await browser.newContext({ serviceWorkers: 'block' });
    const failurePage = await failureContext.newPage();
    await failurePage.route('**/assets/fonts/**', route => route.abort());
    await failurePage.route(/https:\/\//, route => route.abort());
    await failurePage.goto(origin + '/articles.html', { waitUntil: 'domcontentloaded' });
    await failurePage.locator('.ink-site-loader').waitFor({ state: 'detached', timeout: 15000 });
    assert.equal(await failurePage.evaluate(() => document.documentElement.classList.contains('ink-site-loading')), false);
    console.log('PASS font failure releases loader to fallback fonts');
    await failureContext.close();

    for (const width of [390, 1440]) {
      const roomContext = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce', serviceWorkers: 'block' });
      await roomContext.route(/https:\/\//, route => route.abort());
      const roomPage = await roomContext.newPage();
      const missing = [];
      roomPage.on('response', response => { if (response.status() === 404) missing.push(response.url()); });
      await roomPage.goto(origin + '/pet.html', { waitUntil: 'domcontentloaded' });
      await roomPage.locator('.ink-site-loader').waitFor({ state: 'detached', timeout: 30000 });
      await roomPage.locator('#petEntry').waitFor({ state: 'detached', timeout: 15000 });
      for (const scene of ['day', 'night']) {
        for (let i = 0; i < 5 && await roomPage.locator('#petRoom').getAttribute('data-time-scene') !== scene; i++) await roomPage.locator('#sceneToggle').click();
        const background = await roomPage.locator('.room-scenery').evaluate(el => getComputedStyle(el).backgroundImage);
        assert(background.includes('.webp'), `optimized ${scene} background at ${width}px`);
      }
      await roomPage.screenshot({ path: path.join(root, `screenshots/loading/room-night-${width}.png`) });
      assert.deepEqual(missing, []);
      assert.equal(await roomPage.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      console.log(`PASS room day/night optimized assets, ${width}px`);
      await roomContext.close();
    }

    const cacheContext = await browser.newContext({ serviceWorkers: 'allow' });
    await cacheContext.route(/https:\/\//, route => route.abort());
    const cachePage = await cacheContext.newPage();
    await cachePage.goto(origin + '/offline.html');
    await cachePage.evaluate(async () => { await caches.open('hutao-old-test'); await caches.open('unrelated-test'); });
    const start = requests.length;
    await cachePage.goto(origin, { waitUntil: 'domcontentloaded' });
    await cachePage.evaluate(() => navigator.serviceWorker.ready);
    await cachePage.waitForFunction(() => !!navigator.serviceWorker.controller);
    await cachePage.locator('.ink-site-loader').waitFor({ state: 'detached', timeout: 30000 });
    assert(!requests.slice(start).some(url => /pet-cottage|pet-room|pet\.html|admin\.html|videos\.html/.test(url)), 'home install must not prefetch other pages');
    const keys = await cachePage.evaluate(() => caches.keys());
    assert(!keys.includes('hutao-old-test'));
    assert(keys.includes('unrelated-test'));
    await cachePage.reload({ waitUntil: 'domcontentloaded' });
    await cachePage.locator('.ink-site-loader').waitFor({ state: 'detached', timeout: 30000 });
    await cachePage.waitForFunction(async name => {
      const cache = await caches.open(name);
      return (await cache.keys()).some(request => request.url.endsWith('.woff2'));
    }, fs.readFileSync(path.join(root, 'service-worker.js'), 'utf8').match(/const CACHE_NAME = "([^"]+)"/)[1]);
    const repeatStart = requests.length;
    await cachePage.reload({ waitUntil: 'domcontentloaded' });
    await cachePage.locator('.ink-site-loader').waitFor({ state: 'detached', timeout: 30000 });
    assert(!requests.slice(repeatStart).some(url => url.endsWith('.woff2')), 'repeat visit must reuse cached fonts');
    await cacheContext.setOffline(true);
    await cachePage.goto(origin, { waitUntil: 'domcontentloaded' });
    assert.equal(await cachePage.title(), '虎桃不会振刀 | 一卷桃花江湖');
    await cachePage.goto(origin + '/never-cached.html');
    assert.equal(await cachePage.title(), '暂未联网 · 虎桃不会振刀');
    console.log('PASS demand caching, old-cache cleanup, cached fonts, offline navigation');
    await cacheContext.close();
  } finally { await browser.close(); server.close(); }
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
