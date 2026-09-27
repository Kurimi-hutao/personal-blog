// Browser integration checks. All persistence is replaced with an in-memory service.
const { chromium } = require('C:/Users/emmmm/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'outputs', 'admin-cover-qa');
fs.mkdirSync(output, { recursive: true });
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => {
  const file = path.resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404).end(); return; }
  res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream');
  fs.createReadStream(file).pipe(res);
});
const service = `
window.savedWorks = []; window.removedFiles = []; window.failSave = false; window.failList = false;
window.articleService = {
 configured:true, isOwner:()=>true, getSession:async()=>({user:{id:'test-owner'}}),
 listAllArticles:async()=>{if(window.failList)throw new Error('fixture refresh failure');return window.savedWorks},
 listPublished:async()=>[], listAllComments:async()=>[],listMessages:async()=>[],getOwnerDashboard:async()=>({}),
 contentLabel:a=>a.content_type==='video'?'视频':'文章', articleUrl:a=>'article.html?slug='+a.slug, formatDate:()=> '2026-09-27',
 firstImage:a=>a.attachments.find(f=>f.type.startsWith('image/')),
 uploadFiles:async files=>files.map(f=>{const id=crypto.randomUUID();return {url:location.origin+'/assets/ink-scroll.webp?cover='+id,path:id,name:f.name,type:f.type,size:f.size}}),
 uploadVideo:async f=>({url:URL.createObjectURL(f),path:'video-path',name:f.name}),
 removeFiles:async files=>window.removedFiles.push(...files), removeVideo:async()=>{},
 publishArticle:async a=>{if(window.failSave)throw new Error('fixture save failure');const item={...a,id:crypto.randomUUID()};window.savedWorks.push(item);return item},
 updateArticle:async(id,a)=>{if(window.failSave)throw new Error('fixture save failure');const item={...a,id};window.savedWorks=window.savedWorks.map(x=>x.id===id?item:x);return item}
};`;
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const checks = [];
  try {
    for (const width of [1440, 390]) {
      const context = await browser.newContext({ viewport: { width, height: 950 }, serviceWorkers: 'block' });
      await context.route('**/*', route => route.request().url().startsWith(origin) ? route.continue() : route.abort());
      await context.route('**/article-service.js*', route => route.fulfill({ contentType: 'text/javascript', body: service }));
      await context.route('**/supabase-config.js', route => route.fulfill({ contentType: 'text/javascript', body: 'window.BLOG_CONFIG={};' }));
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.goto(origin + '/admin.html');
      await page.locator('#editorPanel').waitFor({ state: 'visible' });
      await page.locator('[data-new-work="article"]').first().click();
      const fill = async () => {
        await page.locator('[name="title"]').fill('山河入画');
        await page.locator('[name="slug"]').fill('cover-review');
        await page.locator('[name="excerpt"]').fill('水墨封面测试');
        await page.locator('[name="content"]').fill('记录一帧山河。');
        await page.locator('[name="published"]').selectOption('false', { force: true });
      };
      await fill();
      await page.locator('[name="coverFile"]').setInputFiles(path.join(root, 'assets', 'ink-scroll.webp'));
      await page.waitForFunction(() => window.adminCover.draft().startsWith('data:image/jpeg'));
      await page.waitForFunction(() => JSON.parse(localStorage.getItem('hutao-editor-draft-article') || '{}').coverData);
      const data = await page.evaluate(() => window.adminCover.draft());
      await page.locator('#clearCover').click();
      await page.evaluate(() => { clearTimeout(autosaveTimer); });
      await page.locator('#restoreDraftButton').click();
      assert.equal(await page.evaluate(() => window.adminCover.draft()), data);
      checks.push({ width, check: 'image upload and local draft restoration', pass: true });
      await page.locator('.publish-button').click();
      await page.waitForFunction(() => window.savedWorks.length === 1 && !savingWork);
      let saved = await page.evaluate(() => window.savedWorks[0]);
      assert.equal(saved.attachments[0].role, 'cover');
      assert.equal(saved.video_poster, null);
      await page.evaluate(() => beginEdit(window.savedWorks[0]));
      await page.waitForFunction(() => document.querySelector('#coverPreview').naturalWidth > 0);
      const oldPath = saved.attachments[0].path;
      await page.locator('[name="videoPoster"]').fill('https://example.com/temporary.jpg');
      await page.locator('[name="videoPoster"]').fill(saved.attachments[0].url);
      assert.equal(await page.evaluate(() => window.adminCover.selection().attachment.path), oldPath);
      await page.locator('[name="videoPoster"]').fill(origin + '/assets/ink-hero.webp');
      await page.evaluate(() => { window.failSave = true; });
      await page.locator('.publish-button').click();
      await page.waitForFunction(() => document.querySelector('#adminStatus').textContent.includes('fixture save failure'));
      assert.equal(await page.evaluate(() => window.removedFiles.length), 0);
      assert.equal(await page.evaluate(() => window.savedWorks[0].attachments[0].path), oldPath);
      await page.evaluate(() => { window.failSave = false; });
      await page.locator('.publish-button').click();
      await page.waitForFunction(() => window.removedFiles.length === 1 && !savingWork);
      saved = await page.evaluate(() => window.savedWorks[0]);
      assert.equal(saved.attachments[0].url, origin + '/assets/ink-hero.webp');
      checks.push({ width, check: 'persist, reopen, failed save preserves old cover, replace cleanup', pass: true });
      await page.evaluate(() => beginEdit(window.savedWorks[0]));
      await page.locator('#clearCover').click();
      await page.locator('.publish-button').click();
      await page.waitForFunction(() => window.savedWorks[0].attachments.length === 0 && !savingWork);
      await page.evaluate(() => openNewWork('video'));
      await fill();
      // Generate a real seekable video with different colours; no external media is used.
      const videoBytes = await page.evaluate(async () => {
        const canvas = document.createElement('canvas'); canvas.width = 640; canvas.height = 360;
        const ctx = canvas.getContext('2d'); const stream = canvas.captureStream(12);
        const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' }); const chunks = [];
        recorder.ondataavailable = e => chunks.push(e.data);
        const stopped = new Promise(resolve => recorder.onstop = resolve);
        recorder.start();
        for (const colour of ['#244c3e', '#a33c32', '#edcf97']) {
          ctx.fillStyle = colour; ctx.fillRect(0, 0, 640, 360);
          ctx.fillStyle = '#fff'; ctx.font = '40px serif'; ctx.fillText('山河 · ' + colour, 80, 190);
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        recorder.stop(); await stopped; stream.getTracks().forEach(t => t.stop());
        return Array.from(new Uint8Array(await new Blob(chunks).arrayBuffer()));
      });
      await page.locator('[name="videoFile"]').setInputFiles({ name: 'mountains.webm', mimeType: 'video/webm', buffer: Buffer.from(videoBytes) });
      await page.locator('#loadCoverVideo').click();
      await page.waitForFunction(() => document.querySelector('#coverVideo').readyState >= 2);
      // MediaRecorder streams omit duration; seeking to the end lets Chrome discover it.
      await page.evaluate(() => { const v = document.querySelector('#coverVideo'); v.currentTime = 1e6; });
      await page.waitForFunction(() => Number.isFinite(document.querySelector('#coverVideo').duration));
      await page.locator('#frameSeek').fill('0.2');
      await page.waitForFunction(() => !document.querySelector('#captureCover').disabled);
      await page.locator('#captureCover').click();
      const firstFrame = await page.evaluate(() => window.adminCover.draft());
      await page.locator('#frameSeek').fill('0.8');
      await page.waitForFunction(() => !document.querySelector('#captureCover').disabled);
      await page.locator('#captureCover').click();
      assert.notEqual(await page.evaluate(() => window.adminCover.draft()), firstFrame);
      await page.locator('.cover-editor').scrollIntoViewIfNeeded();
      await page.screenshot({ path: path.join(output, `${width}-video-cover.png`), fullPage: true });
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.locator('.publish-button').click();
      await page.waitForFunction(() => window.savedWorks.length === 2 && !savingWork);
      saved = await page.evaluate(() => window.savedWorks[1]);
      assert.equal(saved.video_poster, saved.attachments[0].url);
      assert.equal(saved.attachments[0].role, 'cover');
      checks.push({ width, check: 'real video seek, capture distinct frames and persist poster; responsive layout', pass: true });
      await page.evaluate(() => openNewWork('video'));
      await page.locator('[name="coverFile"]').setInputFiles({ name: 'invalid.txt', mimeType: 'text/plain', buffer: Buffer.from('not an image') });
      assert.match(await page.locator('#coverStatus').innerText(), /不超过 10 MB/);
      await page.locator('[name="videoUrl"]').fill(origin + '/missing-video.webm');
      await page.locator('#loadCoverVideo').click();
      await page.waitForFunction(() => document.querySelector('#coverStatus').textContent.includes('无法读取视频'));
      assert(await page.locator('#captureCover').isDisabled());
      checks.push({ width, check: 'invalid image and unavailable video show recoverable errors', pass: true });
      await page.evaluate(() => beginEdit(window.savedWorks[1]));
      await page.locator('[name="coverFile"]').setInputFiles(path.join(root, 'assets', 'ink-scroll.webp'));
      await page.waitForFunction(() => window.adminCover.draft());
      const removedBefore = await page.evaluate(() => window.removedFiles.length);
      await page.evaluate(() => { window.failList = true; });
      await page.locator('.publish-button').click();
      await page.waitForFunction(() => document.querySelector('#adminStatus').textContent.includes('作品已保存，但刷新失败'));
      assert.equal(await page.evaluate(() => window.removedFiles.length), removedBefore + 1);
      const currentPath = await page.evaluate(() => window.savedWorks[1].attachments[0].path);
      assert(!(await page.evaluate(() => window.removedFiles.map(f => f.path))).includes(currentPath));
      await page.emulateMedia({ reducedMotion: 'reduce' });
      assert.equal(await page.locator('#editorWorkPanel').evaluate(el => getComputedStyle(el).animationName), 'none');
      assert.deepEqual(errors, []);
      checks.push({ width, check: 'post-save refresh failure retains new cover; reduced motion; no JS errors', pass: true });
      await context.close();
    }
    fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify(checks, null, 2));
    console.log(JSON.stringify(checks, null, 2));
  } finally { await browser.close(); server.close(); }
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
