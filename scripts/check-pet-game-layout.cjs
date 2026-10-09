const { chromium } = require('C:/Users/emmmm/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert = require('node:assert/strict'), fs = require('node:fs');
const origin = process.env.PET_REVIEW_ORIGIN || 'http://127.0.0.1:8124';
const out = 'screenshots/pet-game-layout'; fs.mkdirSync(out, { recursive: true });
(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const results = [];
  try {
    for (const width of [1000, 320, 390, 768, 1100, 1440, 1920]) {
      const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: 'reduce', serviceWorkers: 'block' });
      const page = await context.newPage(), errors = []; page.on('pageerror', e => errors.push(e.message));
      await page.goto(origin + '/pet.html');
      await page.waitForFunction(() => !document.querySelector('#petEntry'));
      await page.evaluate(() => document.fonts.ready);
      const bounds = id => page.locator('#' + id).evaluate(e => [e, e.querySelector('img'), e.querySelector('.button-label')].map(n => {
        const r = n.getBoundingClientRect(); return { x: r.x + scrollX, y: r.y + scrollY, width: r.width, height: r.height };
      }));
      const shifts = [];
      for (const [id, count] of [['motionToggle', 2], ['soundToggle', 2], ['sceneToggle', 5]]) {
        const before = await bounds(id);
        for (let i = 0; i < count; i++) {
          await page.locator('#' + id).click(); const after = await bounds(id);
          for (let n = 0; n < before.length; n++) for (const key of ['x', 'y', 'width', 'height']) {
            if (Math.abs(before[n][key] - after[n][key]) > .5) shifts.push({ id, part: n, key, before: before[n][key], after: after[n][key] });
          }
        }
      }
      const layout = await page.evaluate(() => {
        const escaped = [];
        for (const button of document.querySelectorAll('.action-grid button')) {
          const slot = button.getBoundingClientRect();
          for (const node of button.children) {
            const r = node.getBoundingClientRect();
            if (r.left < slot.left - .5 || r.right > slot.right + .5) escaped.push({ action: button.dataset.action, element: node.tagName, width: r.width, slot: slot.width });
          }
        }
        return { escaped, overflow: document.documentElement.scrollWidth > innerWidth };
      });
      const row = { width, shifts, ...layout, errors }; results.push(row); console.log(JSON.stringify(row));
      await page.locator('#dailyTab').click();
      assert.equal(await page.locator('#dailyPanel').isVisible(), true);
      assert.equal(await page.locator('#companionsPanel').isVisible(), false);
      await page.locator('#dailyTab').press('ArrowLeft');
      assert.equal(await page.locator('#companionsTab').getAttribute('aria-selected'), 'true');
      assert.equal(await page.locator('#companionsPanel').isVisible(), true);
      for (let n = 0; n < 5 && await page.locator('#petRoom').getAttribute('data-time-scene') !== 'day'; n++) await page.locator('#sceneToggle').click();
      await page.evaluate(() => { document.documentElement.dataset.theme = 'light'; scrollTo(0, 0); });
      await page.mouse.move(0, 0); await page.waitForTimeout(1200);
      await page.screenshot({ path: out + '/' + width + '-day.png', fullPage: true });
      if (width === 390 || width === 1440) {
        for (let n = 0; n < 5 && await page.locator('#petRoom').getAttribute('data-time-scene') !== 'night'; n++) await page.locator('#sceneToggle').click();
        await page.evaluate(() => { document.documentElement.dataset.theme = 'dark'; scrollTo(0, 0); });
        await page.mouse.move(0, 0); await page.waitForTimeout(1200);
        await page.screenshot({ path: out + '/' + width + '-night.png', fullPage: true });
        await page.locator('#dailyTab').click(); await page.mouse.move(0, 0); await page.waitForTimeout(1200);
        await page.locator('.room-journal').screenshot({ path: out + '/' + width + '-tasks.png' });
      }
      await context.close();
    }
    fs.writeFileSync(out + '/results.json', JSON.stringify(results, null, 2));
    assert(results.every(r => !r.shifts.length && !r.escaped.length && !r.overflow && !r.errors.length), 'Buttons must remain within their slots and every setting state must keep identical geometry');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
