// Isolated UI regression: synthetic content, no production requests or writes.
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
let chromium;
try { ({chromium} = require('playwright')); }
catch { ({chromium} = require('C:/Users/emmmm/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')); }
const {installFixtures} = require('./review-fixtures.cjs');
process.env.REVIEW_LOCAL_FILES = '1';
const out = path.resolve('outputs/mobile-redesign');
fs.mkdirSync(out, {recursive: true});
(async () => {
  const browser = await chromium.launch({headless: true, ...(process.platform === 'win32' ? {executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe'} : {})});
  try {
    for (const width of [320, 390, 430, 900, 1080, 1440]) {
      for (const theme of ['light', 'dark']) {
        const context = await browser.newContext({viewport: {width, height: 844}, serviceWorkers: 'block'});
        await context.addInitScript(t => localStorage.setItem('hutao-theme', t), theme);
        await context.route('**/*', r => r.abort());
        await installFixtures(context);
        // Optional overlay validates the exact task-only files staged on main.
        if (process.env.REVIEW_OVERLAY) await context.route('http://localhost:8000/**', async route => {
          const root = path.resolve(process.env.REVIEW_OVERLAY);
          const file = path.resolve(root, '.' + decodeURIComponent(new URL(route.request().url()).pathname));
          if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return route.fallback();
          const mime = {'.html':'text/html','.js':'text/javascript','.css':'text/css'};
          await route.fulfill({body: fs.readFileSync(file), contentType: mime[path.extname(file)] || 'application/octet-stream'});
        });
        const page = await context.newPage(), errors = [];
        page.on('pageerror', e => errors.push(e.message));
        const ready = async file => {
          await page.goto('http://localhost:8000/' + file);
          await page.evaluate(() => window.InkLottie.loaded);
          await page.evaluate(() => document.fonts.ready);
        };
        const fit = async () => assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `overflow ${width} ${theme}`);
        await ready('index.html');
        await page.locator('#latestArticles .article-card').first().waitFor();
        await page.waitForFunction(() => document.querySelector('#latestArticles .article-card:not(.static-fallback)'));
        if (width === 1440 && process.env.REVIEW_OVERLAY) {
          const geometry = () => [...document.querySelectorAll('#links .friend-card')].map(e => {
            const r = e.getBoundingClientRect(), s = getComputedStyle(e);
            return [r.x,r.y,r.width,r.height,s.fontSize,s.backgroundColor];
          });
          const before = await page.evaluate(geometry);
          await page.locator('link[href*="mobile-redesign.css"]').evaluate(e => e.disabled = true);
          assert.deepEqual(await page.evaluate(geometry), before, 'mobile station design changed desktop geometry');
          await page.locator('link[href*="mobile-redesign.css"]').evaluate(e => e.disabled = false);
        }
        if (width <= 1080) {
          // Preserve original utility coordinates: taps there after closing must hit page content.
          for (const close of ['escape', 'toggle', 'link']) {
            await page.locator('.menu-toggle').click();
            const points = await page.locator('.nav-utilities button').evaluateAll(es => es.map(e => {
              const r = e.getBoundingClientRect(); return {x: r.x + r.width / 2, y: r.y + r.height / 2};
            }));
            if (close === 'escape') await page.keyboard.press('Escape');
            if (close === 'toggle') await page.locator('.menu-toggle').click();
            if (close === 'link') await page.locator('.nav-secondary a[href="#links"]').click();
            await page.waitForTimeout(250);
            assert(await page.locator('.site-nav').evaluate(e => e.inert));
            for (const pt of points) {
              assert(await page.evaluate(pt => !document.elementFromPoint(pt.x, pt.y)?.closest('.site-nav'), pt), 'closed utility still captures a tap');
            }
            // Focusing a closed button must fail as well.
            await page.locator('.nav-utilities .theme-toggle').evaluate(e => e.focus());
            assert(await page.evaluate(() => !document.activeElement.closest('.site-nav')), 'closed utility takes keyboard focus');
          }
          await page.evaluate(() => scrollTo(0,0));
          await page.waitForTimeout(350);
          // Rapid toggles and responsive transitions must not leave either mode inert.
          await page.locator('.menu-toggle').click();
          await page.locator('.menu-toggle').click();
          await page.setViewportSize({width: 1440, height: 844});
          await page.waitForFunction(() => !document.querySelector('.site-nav').inert);
          await page.setViewportSize({width, height: 844});
          await page.waitForFunction(() => document.querySelector('.site-nav').inert);
          // Visible controls remain functional.
          await page.locator('.menu-toggle').click();
          await page.locator('.nav-utilities .theme-toggle').click();
          assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), theme === 'dark' ? 'light' : 'dark');
          await page.locator('.nav-utilities .theme-toggle').click();
          await page.keyboard.press('Escape');
        }
        if (width <= 900) {
          const cards = page.locator('#latestArticles .article-card');
          for (const card of await cards.all()) {
            const cover = await card.locator('.card-visual').boundingBox(), copy = await card.locator('.card-content').boundingBox();
            assert(cover.y + cover.height <= copy.y + 1);
            assert(Math.abs(cover.width / cover.height - 2) < .05);
          }
          await page.locator('#articles').scrollIntoViewIfNeeded();
          if (width === 390) await page.locator('#articles').screenshot({path: path.join(out, `articles-${theme}.png`)});
          assert.equal(await page.locator('#stationFavorites .friend-card').count(), 6);
          await page.locator('#linksToggle').click();
          await page.locator('.friend-group').first().locator('summary').click();
          await page.waitForTimeout(350);
          assert(await page.locator('.friend-group .friend-card').first().isVisible());
          await fit();
          if (width === 390) await page.locator('#links').screenshot({path: path.join(out, `station-${theme}.png`)});
          await page.locator('#linksCollapseBottom').click();
          await page.waitForTimeout(300);
          assert(await page.locator('#linksCollapsible').isHidden());
        }
        // Homepage and archive playback controls are round at every viewport.
        for (const file of ['index.html', 'videos.html']) {
          await ready(file);
          const play = page.locator('.media-play-button').first();
          await page.waitForFunction(() => {
            const e = document.querySelector('.media-play-button');
            return e && getComputedStyle(e).borderRadius === '50%';
          });
          const style = await play.evaluate(e => {const s = getComputedStyle(e);return {radius:s.borderRadius,w:s.width,h:s.height};});
          assert.equal(style.radius, '50%'); assert.equal(style.w, style.h);
          await fit();
          if (width === 390 || width === 1440) {
            const card = page.locator(file === 'index.html' ? '.home-video-card' : '.video-card').first();
            await card.scrollIntoViewIfNeeded(); await page.waitForTimeout(400);
            await card.screenshot({path:path.join(out, `play-${file.split('.')[0]}-${width}-${theme}.png`)});
          }
        }
        assert.deepEqual(errors, []);
        console.log(`PASS ${width}px ${theme}: navigation, layout, playback`);
        await context.close();
      }
    }
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
