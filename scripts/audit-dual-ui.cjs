// Local visual review: synthetic content, isolated storage, no external requests.
const { chromium } = require('C:/Users/emmmm/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const { installFixtures } = require('./review-fixtures.cjs');
const fs = require('node:fs'), path = require('node:path');
process.env.REVIEW_LOCAL_FILES = '1';
const out = path.resolve('outputs/dual-ui-20261019');
fs.mkdirSync(out, { recursive: true });
(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const results = [];
  try {
    for (const width of (process.env.AUDIT_WIDTHS || '390,1440').split(',').map(Number)) {
      const height = width < 600 ? 844 : 900;
      const ctx = await browser.newContext({ viewport: { width, height }, isMobile: width < 600, hasTouch: width < 1081, serviceWorkers: 'block' });
      await ctx.route('**/*', r => r.abort());
      await installFixtures(ctx);
      await ctx.route('**/rest/v1/rpc/visitor_check_in', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ total_days: 7, streak: 3 }) }));
      const p = await ctx.newPage(); p.setDefaultTimeout(10000);
      let errors = []; p.on('pageerror', e => errors.push(e.message));
      const files = process.env.AUDIT_SUBSITES ? ['zhengshen-atlas/','zhengshen-atlas/potential/','zhengshen-atlas/calculator/','next-generation-letter/'] : ['index.html','articles.html','article.html?slug=review-0','videos.html','article.html?slug=video-0','works.html','kurumi.html','pet.html','404.html','admin.html'];
      for (const file of files) {
        errors = [];
        await p.goto('http://localhost:8000/' + file, { waitUntil: 'load' });
        await p.locator('.ink-site-loader').waitFor({ state: 'hidden', timeout: 20000 });
        if (await p.locator('#petEntrySkip').isVisible()) await p.locator('#petEntrySkip').click();
        await p.evaluate(() => document.fonts.ready);
        await p.waitForTimeout(900);
        const name = file.includes('video-0') ? 'video-detail' : file.split('.')[0].replaceAll('/', '-');
        const row = { file, width, errors };
        row.layout = await p.evaluate(() => ({ width: document.documentElement.scrollWidth, broken: [...document.images].filter(e => e.complete && !e.naturalWidth && e.getAttribute('src')).map(e => e.getAttribute('src')) }));
        await p.screenshot({ path: path.join(out, `${name}-${width}.png`) });
        if (file === 'index.html') {
          for (const id of ['articles','videos','links','about','message']) {
            const el = p.locator('#' + id); if (!await el.count()) continue;
            await el.scrollIntoViewIfNeeded(); await p.waitForTimeout(850);
            await p.screenshot({ path: path.join(out, `home-${id}-${width}.png`) });
          }
        }
        await p.evaluate(() => scrollTo(0,0)); await p.waitForTimeout(300);
        if (file === 'index.html' || file === 'articles.html') {
          if (width <= 1080) { await p.locator('.menu-toggle').click(); await p.waitForTimeout(300); await p.screenshot({ path: path.join(out, `menu-${name}-${width}.png`) }); }
          await p.locator('.site-search-trigger:visible').first().click();
          await p.locator('.site-search-field input').fill('山'); await p.waitForTimeout(700);
          row.search = await p.locator('.site-search-dialog').evaluate(e => ({ dialog: e.clientHeight, scroll: e.scrollHeight, shell: e.firstElementChild.clientHeight, shellScroll: e.firstElementChild.scrollHeight, resultHeight: e.querySelector('.site-search-results').clientHeight }));
          await p.screenshot({ path: path.join(out, `search-${name}-${width}.png`) });
          await p.locator('[data-search-close]').click();
          await p.waitForFunction(() => !document.querySelector('.site-search-dialog').open);
        }
        if (file === 'articles.html' || file === 'videos.html') {
          const select = p.locator('.animated-select__trigger').first();
          await select.click(); await p.waitForTimeout(400);
          await p.screenshot({ path: path.join(out, `select-${name}-${width}.png`) });
          await p.keyboard.press('Escape');
        }
        await p.evaluate(() => document.documentElement.dataset.theme = 'dark'); await p.waitForTimeout(350);
        await p.screenshot({ path: path.join(out, `${name}-dark-${width}.png`) });
        await p.evaluate(() => document.documentElement.dataset.theme = 'light');
        results.push(row); fs.writeFileSync(path.join(out, (process.env.AUDIT_SUBSITES ? 'subsites-' : 'results-') + width + '.json'), JSON.stringify(results.filter(r => r.width === width), null, 2));
        if (row.errors.length || row.layout.width > width + 1 || row.layout.broken.length) process.exitCode = 1;
        console.log(JSON.stringify(row));
      }
      await ctx.close();
    }
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
