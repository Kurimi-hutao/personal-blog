// Browser regressions for compact search, gesture feedback and filter animation cleanup.
const { chromium } = require('C:/Users/emmmm/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const { installFixtures } = require('./review-fixtures.cjs');
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
process.env.REVIEW_LOCAL_FILES = '1';
const out = path.resolve('outputs/interaction-polish-20261019'); fs.mkdirSync(out, { recursive: true });
(async () => {
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const failures = [], results = [];
  async function check(name, run) { try { await run(); results.push({ name, pass: true }); console.log('PASS', name); } catch (e) { failures.push(name); results.push({ name, pass: false, error: e.message }); console.log('FAIL', name, e.message); } }
  try {
    for (const [width, height] of [[320,430],[390,430],[844,390],[1440,600]]) {
      const c = await b.newContext({ viewport: { width, height }, hasTouch: width < 1081, isMobile: width < 600, serviceWorkers: 'block' });
      await c.route('**/*', r => r.abort()); await installFixtures(c);
      const p = await c.newPage(); const errors = []; p.on('pageerror', e => errors.push(e.message));
      await p.goto('http://localhost:8000/articles.html'); await p.locator('.ink-site-loader').waitFor({ state: 'hidden' });
      if (width <= 1080) await p.locator('.menu-toggle').click();
      await p.locator('.site-search-trigger:visible').first().click();
      await p.locator('.site-search-field input').fill('片刻'); await p.waitForTimeout(700);
      await check(`search results fit ${width}x${height}`, async () => {
        const m = await p.locator('.site-search-dialog').evaluate(d => {
          const r = d.querySelector('.site-search-results').getBoundingClientRect(), b = d.getBoundingClientRect();
          return { top: b.top, bottom: b.bottom, client: d.clientHeight, scroll: d.scrollHeight, resultTop: r.top, resultBottom: r.bottom, resultHeight: r.height };
        });
        results.push({ width, height, search: m });
        assert(m.top >= 0 && m.bottom <= height + 1, JSON.stringify(m));
        assert(m.scroll <= m.client + 1, JSON.stringify(m));
        assert(m.resultHeight >= 85 && m.resultBottom <= m.bottom + 1, JSON.stringify(m));
        await p.screenshot({ path: path.join(out, `search-${width}.png`) });
      });
      await p.locator('[data-search-close]').click(); await p.waitForFunction(() => !document.querySelector('.site-search-dialog').open);
      if (width === 390) {
        await p.setViewportSize({ width, height: 844 });
        const target = p.locator('.article-list-card').first(); await target.scrollIntoViewIfNeeded(); await p.waitForTimeout(800);
        const rect = await target.boundingBox(); const x = rect.x + 30, y = Math.max(100, rect.y + 35);
        const cdp = await c.newCDPSession(p);
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y - 45 }] });
        await check('scroll gesture cancels all pressed feedback', async () => assert.equal(await p.locator('.motion-pressing,.mobile-touch-pressed').count(), 0));
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      }
      if (width === 1440) {
        await check('rapid select close preserves trigger focus', async () => {
          await p.evaluate(() => { const api = MotionCore.createAnimatedSelect(document.querySelector('#categoryFilter')); api.open(); api.close(true); });
          await p.waitForTimeout(80);
          assert(await p.locator('.animated-select__trigger').first().evaluate(e => e === document.activeElement));
        });
        await check('completed filter entrance releases animation overrides', async () => {
          await p.evaluate(() => MotionCore.animateListUpdate(document.querySelector('#articleList'), () => {}));
          await p.waitForTimeout(800);
          const filled = await p.locator('#articleList > *').evaluateAll(es => es.flatMap(e => e.getAnimations().filter(a => a.playState === 'finished' && ['both','forwards'].includes(a.effect.getTiming().fill)).map(a => a.effect.getKeyframes())));
          assert.equal(filled.length, 0, 'finished entrance animations still override hover and press styles');
        });
        await check('rapid filters keep the latest result and release reserved height', async () => {
          await p.evaluate(async () => {
            const list = document.querySelector('#articleList');
            const run = value => MotionCore.animateListUpdate(list, () => list.dataset.auditValue = value);
            const first = run('first'); await new Promise(r => setTimeout(r, 170));
            const second = run('second'); await new Promise(r => setTimeout(r, 30));
            const last = run('last'); await Promise.all([first, second, last]);
          });
          assert.equal(await p.locator('#articleList').getAttribute('data-audit-value'), 'last');
          assert.equal(await p.locator('#articleList').evaluate(e => e.style.minHeight), '');
        });
        await p.emulateMedia({ reducedMotion: 'reduce' });
        await p.locator('.animated-select__trigger').first().focus(); await p.keyboard.down(' ');
        await check('reduced motion skips keyboard press animation', async () => assert.equal(await p.locator('.motion-pressing').count(), 0));
        await p.keyboard.up(' ');
      }
      await check(`no script errors ${width}`, async () => assert.deepEqual(errors, []));
      await c.close();
    }
  } finally { await b.close(); fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(results, null, 2)); }
  assert.equal(failures.length, 0, failures.join(', '));
})().catch(e => { console.error(e); process.exitCode = 1; });
