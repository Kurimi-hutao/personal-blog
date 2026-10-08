const { chromium } = require('C:/Users/emmmm/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const { installFixtures } = require('./review-fixtures.cjs');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  try {
    for (const width of [1440, 768, 390]) {
      const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: 'reduce', serviceWorkers: 'block' });
      await context.route('http://cover.test/**', async route => {
        const file = path.join(__dirname, '..', decodeURIComponent(new URL(route.request().url()).pathname));
        const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png' };
        if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return route.fulfill({ status: 404, body: '' });
        await route.fulfill({ body: fs.readFileSync(file), contentType: mime[path.extname(file)] || 'application/octet-stream' });
      });
      await installFixtures(context, { origin: 'http://cover.test' });
      const page = await context.newPage();
      await page.goto('http://cover.test/index.html', { waitUntil: 'domcontentloaded' });
      await page.locator('.article-cover img').first().waitFor();
      for (const [w, h] of [[600, 600], [1200, 300], [300, 1200]]) {
        const results = await page.locator('.article-card').evaluateAll(async (cards, size) => {
          const results = [];
          for (const card of cards) {
            const visual = card.querySelector('.card-visual');
            visual.classList.add('article-cover');
            let img = visual.querySelector('img');
            if (!img) { img = document.createElement('img'); visual.append(img); }
            img.src = 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${size[0]}" height="${size[1]}"><rect width="100%" height="100%" fill="tomato"/></svg>`);
            await img.decode();
            const a = visual.getBoundingClientRect(), b = img.getBoundingClientRect();
            results.push({ cover: [a.width, a.height], image: [b.width, b.height], aligned: Math.abs(a.x-b.x)<1 && Math.abs(a.y-b.y)<1, fit: getComputedStyle(img).objectFit });
          }
          return results;
        }, [w, h]);
        for (const result of results) {
          assert(result.aligned && result.cover.every((v, i) => Math.abs(v-result.image[i])<1) && result.fit === 'cover', JSON.stringify({ width, source: [w,h], ...result }));
        }
      }
      console.log(`PASS: ${width}px, square / landscape / portrait, all homepage cards`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
