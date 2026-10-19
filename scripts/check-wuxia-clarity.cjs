'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require('C:/Users/emmmm/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const { installFixtures } = require('./review-fixtures.cjs');
process.env.REVIEW_LOCAL_FILES = '1';
const out = 'outputs/mobile-wuxia-clarity-20261019';
fs.mkdirSync(out, { recursive: true });
(async () => {
 const browser = await chromium.launch({headless:true, executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 try {
  for (const imageMode of [true, false]) for (const width of [320,390,430,900]) {
   const context = await browser.newContext({viewport:{width,height:844},deviceScaleFactor:3,serviceWorkers:'block',
    ...(imageMode ? {userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1'} : {})});
   await context.route('**/*',r=>r.abort()); await installFixtures(context);
   await context.addInitScript(()=>sessionStorage.setItem('hutao-site-intro-seen-v1','1'));
   const page = await context.newPage();
   for (const file of ['works.html','articles.html','index.html']) {
    await page.goto('http://localhost:8000/'+file);
    await page.evaluate(()=>document.fonts.ready);
    if (file==='index.html') await page.locator('#about').scrollIntoViewIfNeeded();
    const art = page.locator(file==='index.html'?'.mobile-wuxia-portrait':'.mobile-wuxia-chapter');
    await page.waitForFunction(selector=>document.querySelector(selector)?.dataset.ready==='true',file==='index.html'?'.mobile-wuxia-portrait':'.mobile-wuxia-chapter');
    assert.equal(await art.locator('.wuxia-poster').evaluate(e=>getComputedStyle(e).opacity),'0','poster must disappear during alpha playback');
    assert.equal(await art.evaluate(e=>[...e.children].filter(c=>getComputedStyle(c).opacity==='1').length),1,'only one rendered layer while playing');
    if(imageMode) assert(await art.locator('.wuxia-image-motion').evaluate(e=>e.naturalWidth>=e.clientWidth*2),'retina image resolution');
    if(file!=='index.html') {
     const boxes=await page.evaluate(()=>{
      const a=document.querySelector('.mobile-wuxia-chapter').getBoundingClientRect();
      return [...document.querySelectorAll('.scene-banner h1,.scene-banner p')].map(e=>{const b=e.getBoundingClientRect();return a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top});
     });
     assert(boxes.every(x=>!x),'character must leave text clear');
    }
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    if(width===390) await page.screenshot({path:`${out}/${file.split('.')[0]}-${imageMode?'image':'video'}.png`});
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.waitForFunction(selector=>document.querySelector(selector)?.dataset.ready==='false',file==='index.html'?'.mobile-wuxia-portrait':'.mobile-wuxia-chapter');
    await page.waitForFunction(selector=>getComputedStyle(document.querySelector(selector+' .wuxia-poster')).opacity==='1',file==='index.html'?'.mobile-wuxia-portrait':'.mobile-wuxia-chapter',{timeout:2000});
    assert.equal(await art.evaluate(e=>[...e.children].filter(c=>getComputedStyle(c).opacity==='1').length),1,'only the poster while paused');
    await page.emulateMedia({reducedMotion:'no-preference'});
   }
   await context.close(); console.log('PASS clarity',imageMode?'image':'video',width);
  }
 } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1});
