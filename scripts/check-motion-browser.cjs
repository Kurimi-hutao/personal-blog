// Live DOM interaction smoke test at desktop/mobile viewports.
// Run after installing playwright + Chromium: node scripts/check-motion-browser.cjs
'use strict';
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'outputs', 'motion-lifecycle');
const mime = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json',
  '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2', '.ico': 'image/x-icon',
};
const server = http.createServer((req, res) => {
  let target;
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    target = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!target.startsWith(root + path.sep)) throw Error('outside root');
  } catch {
    res.writeHead(400); res.end('Bad request'); return;
  }
  fs.readFile(target, (err, data) => {
    res.writeHead(err ? 404 : 200, { 'Content-Type': mime[path.extname(target)] || 'application/octet-stream' });
    res.end(err ? 'Not found' : data);
  });
});
async function ready(page) {
  await page.waitForFunction(() => window.InkLottie && window.InkLottie.ready);
  await page.evaluate(() => window.InkLottie.loaded);
  await page.waitForFunction(() => !document.querySelector('.ink-site-loader') &&
    !document.documentElement.classList.contains('ink-site-loading'));
}
async function fits(page, label) {
  const metrics = await page.evaluate(() => ({
    viewport: innerWidth, width: document.documentElement.scrollWidth,
  }));
  assert(metrics.width <= metrics.viewport + 1, label + ' horizontal overflow: ' + JSON.stringify(metrics));
}
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch({ headless: true });
  fs.mkdirSync(output, { recursive: true });
  try {
    for (const width of [390, 1440]) {
      const context = await browser.newContext({
        viewport: { width, height: width === 390 ? 844 : 900 },
        reducedMotion: 'no-preference', serviceWorkers: 'block',
      });
      await context.route(/https?:\/\/(?!127\.0\.0\.1)/, route => route.abort());
      await context.addInitScript(() => {
        window.__loaderInsertions = 0;
        new MutationObserver(records => {
          for (const record of records) for (const node of record.addedNodes) {
            if (node.nodeType === 1 && (node.matches?.('.ink-site-loader') ||
              node.querySelector?.('.ink-site-loader'))) window.__loaderInsertions++;
          }
        }).observe(document, { childList: true, subtree: true });
      });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(origin + '/index.html', { waitUntil: 'domcontentloaded' });
      await ready(page);
      assert.equal(await page.evaluate(() => window.__loaderInsertions), 1, 'first navigation shows exactly one seal');
      await fits(page, 'home ' + width);
      const toggle = page.locator('#linksToggle');
      await toggle.scrollIntoViewIfNeeded();
      await page.evaluate(() => {
        const b = document.querySelector('#linksToggle');
        b.click(); b.click(); b.click();
      });
      await page.waitForTimeout(350);
      assert.equal(await toggle.getAttribute('aria-expanded'), 'true');
      assert(await page.locator('#linksCollapsible').isVisible(), 'station expands after rapid clicks');
      await fits(page, 'station expanded ' + width);
      await page.locator('#linksCollapseBottom').click();
      await page.waitForTimeout(280);
      assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
      assert.equal(await page.locator('#linksCollapsible').isVisible(), false);
      assert(await toggle.evaluate(el => document.activeElement === el), 'bottom collapse restores focus');
      await page.screenshot({ path: path.join(output, 'home-' + width + '.png') });
      if (width < 600) {
        await page.locator('.menu-toggle').click();
        assert(await page.locator('.site-nav').evaluate(el => el.classList.contains('open')), 'mobile nav opens');
        await page.keyboard.press('Escape');
        assert(await page.locator('.site-nav').evaluate(el => !el.classList.contains('open')), 'mobile nav closes');
      }
      await page.goto(origin + '/articles.html', { waitUntil: 'domcontentloaded' });
      await ready(page);
      assert.equal(await page.evaluate(() => window.__loaderInsertions), 0, 'second page suppresses ink seal');
      await fits(page, 'articles ' + width);
      await page.goto(origin + '/index.html', { waitUntil: 'domcontentloaded' });
      await ready(page);
      assert.equal(await page.evaluate(() => window.__loaderInsertions), 0, 'return home suppresses ink seal');
      await fits(page, 'return home ' + width);
      assert.deepEqual(errors, [], 'browser errors at ' + width);
      console.log('PASS browser ink motion ' + width + 'px');
      await context.close();
    }
    const reduced = await browser.newContext({
      viewport: { width: 390, height: 844 },
      reducedMotion: 'reduce', serviceWorkers: 'block',
    });
    await reduced.route(/https?:\/\/(?!127\.0\.0\.1)/, route => route.abort());
    await reduced.addInitScript(() => {
      window.__loaderInsertions = 0;
      new MutationObserver(records => {
        for (const record of records) for (const node of record.addedNodes) {
          if (node.nodeType === 1 && node.matches?.('.ink-site-loader')) window.__loaderInsertions++;
        }
      }).observe(document, { childList: true, subtree: true });
    });
    const reducedPage = await reduced.newPage();
    await reducedPage.goto(origin + '/index.html', { waitUntil: 'domcontentloaded' });
    await ready(reducedPage);
    assert.equal(await reducedPage.evaluate(() => window.__loaderInsertions), 0, 'reduce-motion skips overlay');
    console.log('PASS reduced-motion skips overlay');
    await reduced.close();
  } finally {
    await browser.close();
    server.close();
  }
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });