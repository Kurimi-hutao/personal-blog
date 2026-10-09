const { chromium } = require('C:/Users/emmmm/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const origin = process.env.PET_REVIEW_ORIGIN || 'http://127.0.0.1:8124';
(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 900 }, reducedMotion: 'reduce', serviceWorkers: 'block' });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/assets/models/**', route => route.abort());
    await page.goto(origin + '/pet.html');
    await page.waitForFunction(() => document.querySelector('#modelStatus').classList.contains('is-error') && !document.querySelector('#petEntry'));
    const names = { hutao: '小桃', fireman: '季沧海', zhang: '张起灵' };
    for (const role of Object.keys(names)) {
      if (role !== 'hutao') await page.locator('[data-character="' + role + '"]').click();
      await page.waitForFunction(name => document.querySelector('#profileName').textContent === name && !document.querySelector('#retryModel').disabled, names[role]);
      assert.equal(await page.locator('#petFallback').isVisible(), true);
      assert((await page.locator('#petFallback').getAttribute('src')).endsWith('/' + role + '.png'));
      await page.locator('.status-card summary').click();
      assert.equal(await page.locator('#profileAvatarImage').isVisible(), true);
      await page.locator('.status-card summary').click();
    }
    const button = page.locator('[data-action="pet"]');
    const plate = () => button.locator('b').evaluate(e => getComputedStyle(e).backgroundImage);
    await page.mouse.move(0, 0);assert((await plate()).includes('button_default.png'));
    await button.hover();assert((await plate()).includes('button_hover.png'));
    await page.mouse.down();assert((await plate()).includes('button_pressed.png'));await page.mouse.move(0, 0);await page.mouse.up();
    await button.evaluate(e => e.disabled = true);assert((await plate()).includes('button_disabled.png'));
    const audioDuration = await page.evaluate(() => new Promise((resolve, reject) => {
      const audio = new Audio('./assets/audio/hutao/hutao-feed-01.mp3');
      const timer = setTimeout(() => reject(new Error('Audio metadata timed out')), 8000);
      audio.onloadedmetadata = () => { clearTimeout(timer); resolve(audio.duration); audio.removeAttribute('src'); audio.load(); };
      audio.onerror = () => { clearTimeout(timer); reject(new Error('Audio decoding failed')); };
      audio.load();
    }));
    assert(audioDuration > 0);
    const manifest = JSON.parse(fs.readFileSync('assets/pet-cottage/source-manifest.json', 'utf8'));
    const missing = await page.evaluate(async assets => {
      const checks = await Promise.all(assets.map(async asset => {
        const url = './assets/pet-cottage/ui/' + asset.file.replace(/^png\//, '');
        return (await fetch(url, { method: 'HEAD' })).ok ? null : url;
      }));
      return checks.filter(Boolean);
    }, manifest.assets);
    assert.deepEqual(missing, []);assert.deepEqual(errors, []);
    console.log(JSON.stringify({ uiAssets: manifest.assets.length, fallbackRoles: 3, buttonStates: 4, audioDuration, errors }));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
