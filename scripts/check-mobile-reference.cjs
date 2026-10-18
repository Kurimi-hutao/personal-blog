// Browser regression: node scripts/check-mobile-reference.cjs
// Synthetic records and all remote requests are intercepted; no production writes.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
let chromium;
try { ({chromium} = require('playwright')); }
catch { ({chromium} = require('C:/Users/emmmm/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')); }
const {installFixtures} = require('./review-fixtures.cjs');
process.env.REVIEW_LOCAL_FILES = '1';
const output = path.resolve('outputs/mobile-reference-20261018');
fs.mkdirSync(output,{recursive:true});
(async () => {
  const browser = await chromium.launch({headless:true,...(process.platform==='win32'?{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}:{})});
  const results=[];
  try {
    for (const width of [320,375,390,430,768,900,1440]) {
      const context=await browser.newContext({viewport:{width,height:844},serviceWorkers:'block',reducedMotion:'reduce'});
      await context.route('**/*',r=>r.abort());
      await installFixtures(context);
      const page=await context.newPage(),errors=[];
      page.on('pageerror',e=>errors.push(e.message));
      const ready=async file=>{
        await page.goto('http://localhost:8000/'+file,{waitUntil:'domcontentloaded'});
        await page.evaluate(()=>window.InkLottie.loaded);
        await page.evaluate(()=>document.fonts.ready);
      };
      const fit=async label=>assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),label+' overflow at '+width);
      for(const theme of ['light','dark']) {
        await context.addInitScript(t=>localStorage.setItem('hutao-theme',t),theme);
        for(const file of ['index.html','articles.html','article.html?slug=review-0','works.html']) {
          await ready(file);
          const type=file.split('.')[0];
          await page.waitForTimeout(150);
          await fit(type+' '+theme);
          if(type==='index') {
            await page.locator('#latestArticles .article-card').first().waitFor();
            const card=page.locator('#latestArticles .article-card').first();
            const v=await card.locator('.card-visual').boundingBox(),c=await card.locator('.card-content').boundingBox();
            if(width>=360&&width<=900)assert(v.x<c.x && Math.abs(v.y-c.y)<2,'home horizontal card');
            if(width===320)assert(v.y<c.y,'narrow stacked card');
            if(width<=900)assert(await page.locator('#latestArticles .article-card').nth(1).locator('.card-visual').isVisible(),'second cover remains visible');
            if(width<=900){await page.locator('.menu-toggle').click();assert(await page.locator('.site-nav.open').isVisible());await page.keyboard.press('Escape');}
          }
          if(type==='articles') {
            await page.locator('.article-list-card').first().waitFor();
            await page.locator('#articleSearch').fill('未题封面');
            await page.waitForFunction(()=>document.querySelectorAll('.article-list-card').length===1);
            assert((await page.locator('.article-list-card h2').innerText()).includes('未题封面'));
            await fit('long title');
            await page.locator('#clearFilters').click();
            await page.waitForFunction(()=>document.querySelectorAll('.article-list-card').length===5);
            await page.locator('.animated-select__trigger').first().click();
            await page.locator('.animated-select__panel').first().waitFor({state:'visible'});
            await page.keyboard.press('Escape');
          }
          if(type==='article') {
            await page.locator('.article-body h2').first().waitFor();
            if(width<=900)assert((await page.locator('.article-body').evaluate(e=>parseFloat(getComputedStyle(e).fontSize)))>=17);
            if(width<=600){await page.locator('.reading-toc-trigger:visible').click();await page.locator('.reading-toc-dialog a').last().click();assert.equal(await page.locator('.reading-toc-dialog').isVisible(),false);}
            await page.locator('#increaseFont').click();await fit('enlarged reading');
            await page.locator('#decreaseFont').click();
            await page.locator('#bookmarkArticle').click();assert.equal(await page.locator('#bookmarkArticle').getAttribute('aria-pressed'),'true');
            await page.locator('#bookmarkArticle').click();
          }
          if(type==='works') {
            const first=page.locator('.work-card').first();
            if(width<=900)for(const card of await page.locator('.work-card').all()) {
              const box=await card.boundingBox(),cover=await card.locator('.work-cover').boundingBox();
              assert(box.width>=Math.min(680,width-40)-2,'project uses the full column');
              assert(Math.abs(cover.width/cover.height-2)<.03,'all project covers stay wide');
            }
            await first.locator('.work-notes summary').click();
            assert(await first.locator('.work-notes').getAttribute('open')!==null);
            await first.locator('.work-notes summary').click();
            const button=page.locator('.works-toolbar button').nth(1);
            await button.click();assert.equal(await button.getAttribute('aria-pressed'),'true');
            await page.locator('.works-toolbar button').first().click();
          }
          if(width===390){
            await page.evaluate(()=>document.activeElement?.blur());
            await page.evaluate(()=>scrollTo(0,0));
            await page.screenshot({path:path.join(output,`${type}-${theme}.png`),fullPage:true});
          }
          await fit(type+' after interactions');
        }
      }
      assert.deepEqual(errors,[],`browser errors at ${width}`);
      results.push({width,themes:['light','dark'],status:'PASS'});
      fs.writeFileSync(path.join(output,'results.json'),JSON.stringify(results,null,2));
      console.log('PASS mobile reference '+width+'px light/dark');
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});

