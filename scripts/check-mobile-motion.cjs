// Real touch input in isolated browser contexts; public service writes are blocked.
const { chromium } = require('C:/Users/emmmm/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const { installFixtures } = require('./review-fixtures.cjs');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const origin = process.env.REVIEW_ORIGIN || 'http://127.0.0.1:8015';
const out = path.resolve('outputs/mobile-motion'); fs.mkdirSync(out, { recursive: true });

async function prepare(browser, viewport, reducedMotion = 'no-preference', mobile = true) {
  const context = await browser.newContext({ viewport, hasTouch: mobile, isMobile: mobile, reducedMotion, serviceWorkers: 'block' });
  await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  await installFixtures(context, { origin });
  await context.route('**/*', route => ['GET', 'HEAD', 'OPTIONS'].includes(route.request().method()) ? route.fallback() : route.abort());
  return context;
}
async function ready(page, file) {
  await page.goto(`${origin}/${file}`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => !document.documentElement.classList.contains('ink-site-loading'));
  await page.locator('.ink-site-loader').waitFor({ state: 'detached' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
}
async function trackRipples(page) {
  await page.evaluate(() => {
    window.auditRipples = 0;
    new MutationObserver(entries => entries.forEach(entry => entry.addedNodes.forEach(node => {
      if (node.nodeType === 1 && node.matches('.ink-click-ripple')) window.auditRipples++;
    }))).observe(document.body, { childList: true });
  });
}
async function visibleDockRects(page) {
  return page.evaluate(() => [...document.querySelectorAll('.mobile-control-dock button')].map(element => {
    const r = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return { text: element.textContent, x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom,
      visible: r.width > 0 && style.visibility !== 'hidden' && style.display !== 'none' };
  }).filter(item => item.visible));
}

(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const results = [];
  try {
    for (const [width, height] of [[320,568], [375,812], [390,844], [430,932], [844,390]]) {
      const context = await prepare(browser, { width, height });
      const page = await context.newPage(); const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await ready(page, 'index.html'); await trackRipples(page);
      const searchTarget = await page.locator('.site-search-trigger').boundingBox();
      assert(searchTarget.width >= 44 && searchTarget.height >= 44, 'header search target is at least 44px');
      const cdp = await context.newCDPSession(page);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 110, y: 140 }] });
      assert.equal(await page.evaluate(() => window.auditRipples), 0, 'touch-down alone creates no effect');
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 110, y: 80 }] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      assert.equal(await page.evaluate(() => window.auditRipples), 0, 'scroll gesture creates no effect');
      await page.waitForTimeout(350); await page.evaluate(() => scrollTo(0,0)); await page.waitForTimeout(350);
      await page.touchscreen.tap(30,110);
      assert.equal(await page.evaluate(() => window.auditRipples), 1, 'one tap creates exactly one ripple');
      if (width === 390) await page.screenshot({ path: path.join(out, 'tap-feedback.png') });
      await page.waitForTimeout(650);
      assert.equal(await page.locator('.ink-click-ripple, .ink-click-core, .click-petal').count(), 0, 'particles are cleaned up');
      await page.evaluate(() => scrollTo(0,0)); await page.waitForTimeout(350);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 30, y: 110 }] });
      await page.waitForTimeout(560);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      assert.equal(await page.evaluate(() => window.auditRipples), 1, 'long presses create no click particles');
      await page.locator('#summonPetals').tap();
      assert(await page.locator('.manual-petal').count() > 0, 'phone petal action gives visible feedback');
      assert(await page.locator('.manual-petal').count() <= 8, 'phone petal count is bounded');
      assert.equal(await page.locator('.manual-petal').first().evaluate(element => getComputedStyle(element).pointerEvents), 'none');
      await page.waitForFunction(() => !document.querySelector('.manual-petal'), null, { timeout: 4000 });
      await page.evaluate(() => scrollTo(0, 0)); await page.waitForTimeout(350);
      await page.locator('.menu-toggle').tap(); await page.waitForTimeout(300);
      assert.equal(await page.locator('main').evaluate(element => element.inert), true);
      const menuTargets = await page.locator('.site-nav a, .mobile-nav-dismiss').evaluateAll(elements => elements.map(element => {
        const r = element.getBoundingClientRect(); return { text: element.textContent, top: r.top, bottom: r.bottom, height: r.height, width: r.width };
      }));
      for (const target of menuTargets) {
        assert(target.height >= 44 && target.width >= 44, `navigation touch target: ${target.text}`);
        assert(target.top >= 70 && target.bottom <= height, `navigation fits viewport: ${target.text}`);
      }
      await page.keyboard.press('Tab');
      assert.equal(await page.evaluate(() => !!document.activeElement.closest('.site-header')), true, 'menu focus stays in header/navigation');
      await page.screenshot({ path: path.join(out, `menu-${width}.png`) });
      await page.locator('.mobile-nav-dismiss').tap();
      assert.equal(await page.locator('main').evaluate(element => element.inert), false);
      await page.locator('.site-search-trigger').tap();
      await page.locator('.site-search-field input').fill('片刻');
      await page.waitForFunction(() => document.querySelector('.site-search-results').textContent.includes('找到'));
      if (width <= 430) await page.setViewportSize({ width, height: 430 });
      await page.waitForTimeout(200);
      const search = await page.evaluate(() => {
        const dialog = document.querySelector('.site-search-dialog'), results = document.querySelector('.site-search-results');
        const r = results.getBoundingClientRect(), d = dialog.getBoundingClientRect();
        return { top: d.top, bottom: d.bottom, viewport: innerHeight, client: dialog.clientHeight, scroll: dialog.scrollHeight,
          resultTop: r.top, resultBottom: r.bottom, resultHeight: r.height };
      });
      assert(search.top >= 0 && search.bottom <= search.viewport, 'search stays inside the reduced viewport');
      assert(search.scroll <= search.client + 1, 'search shell does not clip results');
      assert(search.resultHeight >= 85, 'search retains a usable result region with the keyboard');
      await page.screenshot({ path: path.join(out, `search-compact-${width}.png`) });
      await page.locator('[data-search-close]').tap();
      await page.waitForFunction(() => !document.querySelector('.site-search-dialog').open);
      await page.setViewportSize({ width, height });

      await ready(page, 'article.html?slug=review-0');
      await page.locator('.article-body h2').nth(1).scrollIntoViewIfNeeded();
      await page.waitForTimeout(450);
      assert.equal(await page.locator('.reading-toc-trigger').evaluate(element => {
        const r = element.getBoundingClientRect(); return document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2) === element;
      }), true, 'TOC remains tappable while scrolling down through the article');
      await page.evaluate(() => scrollBy(0,-24)); await page.waitForTimeout(450);
      const controls = await visibleDockRects(page);
      assert(controls.some(item => item.text === '目录'), 'TOC joins the shared dock');
      for (let i = 0; i < controls.length; i++) {
        const a = controls[i]; assert(a.height >= 44 && a.width >= 44 && a.bottom <= height, 'dock button fits and is tappable');
        for (const b of controls.slice(i + 1)) assert(a.right <= b.x || b.right <= a.x || a.bottom <= b.y || b.bottom <= a.y, 'dock buttons never overlap');
      }
      await page.screenshot({ path: path.join(out, `reading-${width}.png`) });
      await page.locator('.reading-toc-trigger').tap();
      assert.equal(await page.locator('.mobile-control-dock').evaluate(element => getComputedStyle(element).visibility), 'hidden');
      await page.locator('.reading-toc-dialog a').nth(1).tap();
      assert.equal(await page.locator('.reading-toc-dialog').evaluate(element => element.open), false);
      await page.waitForTimeout(500);
      const targetTop = await page.locator('.article-body h2').nth(1).evaluate(element => element.getBoundingClientRect().top);
      assert(targetTop >= 0 && targetTop < height, 'selected heading is reachable below the header');
      for (const file of ['articles.html','videos.html','works.html','kurumi.html']) {
        await ready(page, file);
        await page.screenshot({ path: path.join(out, `${file}-${width}.png`) });
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${file} overflows`);
        if (file === 'kurumi.html') {
          await page.locator('[data-gallery-src]').nth(1).tap();
          await page.locator('#imageLightbox img').evaluate(image => image.decode());
          const close = await page.locator('#imageLightbox .lightbox-close').boundingBox();
          assert(close.width >= 44 && close.height >= 44 && close.y >= 0 && close.y + close.height <= height, 'gallery close stays visible in portrait and landscape');
          await page.screenshot({ path: path.join(out, `gallery-${width}.png`) });
          await page.locator('#imageLightbox .lightbox-close').tap();
        }
      }
      if (width === 390) {
        await ready(page, 'pet.html');
        await page.locator('#petEntry').waitFor({ state: 'detached', timeout: 15000 });
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'pet room fits');
        await page.screenshot({ path: path.join(out, 'pet-390.png') });
        await ready(page, 'articles.html');
        await page.locator('.theme-toggle').tap();
        await page.locator('.scene-banner').evaluate(async element => {
          const url = getComputedStyle(element, '::before').backgroundImage.match(/url\("([^"]+)"\)/)?.[1];
          if (url) { const image = new Image(); image.src = url; await image.decode(); }
        });
        await page.waitForTimeout(450);
        await page.screenshot({ path: path.join(out, 'articles-dark-390.png') });
        await page.locator('.menu-toggle').tap(); await page.waitForTimeout(300);
        await page.screenshot({ path: path.join(out, 'menu-dark-390.png') });
      }
      assert.deepEqual(errors, [], 'no page errors');
      results.push({ width, height, menuTargets, search, controls });
      await context.close(); console.log(`PASS touch, menu, search, reading dock and layouts: ${width}x${height}`);
    }
    for (const [mode, mobile] of [['reduce',true], ['no-preference',false]]) {
      const context = await prepare(browser, { width: mobile ? 390 : 1440, height: 844 }, mode, mobile);
      const page = await context.newPage(); await ready(page, 'index.html'); await trackRipples(page);
      if (mobile) await page.touchscreen.tap(110,140); else await page.mouse.click(110,140);
      assert.equal(await page.evaluate(() => window.auditRipples), mobile ? 0 : 1, 'reduced motion and desktop click count');
      if (mobile) {
        await page.locator('#summonPetals').tap();
        assert.equal(await page.locator('.manual-petal').count(), 0);
        assert.match(await page.locator('.petal-feedback-toast').innerText(), /减少动态效果/);
      }
      if (!mobile) assert.equal(await page.locator('.mobile-nav-dismiss').isVisible(), false);
      await context.close();
    }
    fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify({ passed: true, results }, null, 2));
    console.log('PASS reduced motion and desktop compatibility');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
