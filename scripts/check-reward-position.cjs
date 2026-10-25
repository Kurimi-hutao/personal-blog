const assert = require('node:assert/strict');
const { chromium } = require('C:/Users/emmmm/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const { installFixtures } = require('./review-fixtures.cjs');
process.env.REVIEW_LOCAL_FILES = '1';
(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  try {
    const context = await browser.newContext({ serviceWorkers: 'block', reducedMotion: 'reduce' });
    await context.route('**/*', route => route.abort());
    await installFixtures(context, { origin: 'http://blog.test' });
    const page = await context.newPage();
    await page.goto('http://blog.test/article.html?slug=review-0');
    await page.locator('.article-reward').waitFor();
    const cases = [
      { label: 'primary monitor', screen: { availLeft: 0, availTop: 0, availWidth: 1920, availHeight: 1040 }, parent: { screenX: 100, screenY: 80, outerWidth: 1200, outerHeight: 800 }, expected: { width: 460, height: 780, left: 730, top: 130 } },
      { label: 'negative-coordinate monitor', screen: { availLeft: -1920, availTop: 40, availWidth: 1920, availHeight: 1040 }, parent: { screenX: -1900, screenY: 60, outerWidth: 1400, outerHeight: 900 }, expected: { width: 460, height: 780, left: -1190, top: 170 } },
      { label: 'small monitor', screen: { availLeft: 0, availTop: 0, availWidth: 800, availHeight: 600 }, parent: { screenX: 0, screenY: 0, outerWidth: 800, outerHeight: 600 }, expected: { width: 460, height: 520, left: 170, top: 40 } },
      { label: 'no monitor origin support', screen: { availLeft: undefined, availTop: undefined, availWidth: 1920, availHeight: 1040 }, parent: { screenX: 200, screenY: 100, outerWidth: 1200, outerHeight: 800 }, expected: { width: 460, height: 780, left: 570, top: 110 } },
    ];
    for (const item of cases) {
      await page.evaluate(({ screen: screenValues, parent }) => {
        for (const [key, value] of Object.entries(screenValues)) Object.defineProperty(screen, key, { configurable: true, value });
        for (const [key, value] of Object.entries(parent)) Object.defineProperty(window, key, { configurable: true, value });
        window.open = (url, name, features) => {
          window.lastPopup = { url, name, features };
          return {
            outerWidth: 484, innerWidth: 460, outerHeight: 860, innerHeight: 780,
            resizeTo(width, height) { window.lastResize = { width, height }; },
            moveTo(left, top) { window.lastMove = { left, top }; },
            focus() {}
          };
        };
      }, item);
      await page.locator('.reward-submit').click();
      const actual = await page.evaluate(() => Object.fromEntries(window.lastPopup.features.split(',').filter(part => /^(width|height|left|top)=/.test(part)).map(part => { const [key, value] = part.split('='); return [key, Number(value)]; })));
      assert.deepEqual(actual, item.expected, item.label);
      const placement = await page.evaluate(() => ({ resize: window.lastResize, move: window.lastMove }));
      assert.deepEqual(placement.resize, { width: item.expected.width + 24, height: item.expected.height + 80 });
      assert.deepEqual(placement.move, { left: item.expected.left - 12, top: item.expected.top - 40 }, 'Reused popup is centered including its browser frame');
      console.log('PASS: ' + item.label);
    }
    await context.close();
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
