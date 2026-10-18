'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('C:/Users/emmmm/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {installFixtures}=require('./review-fixtures.cjs');
process.env.REVIEW_LOCAL_FILES='1';
const out=path.resolve('outputs/mobile-wuxia-20261018');fs.mkdirSync(out,{recursive:true});
(async()=>{
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
const results=[];
try {
for(const width of [320,390,430,900])for(const theme of ['light','dark']){
 const context=await browser.newContext({viewport:{width,height:844},serviceWorkers:'block',reducedMotion:'no-preference'});
 await context.route('**/*',r=>r.abort());await installFixtures(context);
 await context.addInitScript(t=>{localStorage.setItem('hutao-theme',t);sessionStorage.setItem('hutao-site-intro-seen-v1','1');},theme);
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 for(const file of ['index.html','articles.html','works.html','article.html?slug=review-0']){
  const videos=[];page.on('request',r=>{if(r.url().includes('mobile-wuxia-v3')&&r.url().endsWith('.webm'))videos.push(r.url())});
  await page.goto('http://localhost:8000/'+file,{waitUntil:'domcontentloaded'});
  await page.evaluate(()=>document.fonts.ready);
  await page.locator('.mobile-wuxia-art').first().waitFor({state:'attached'});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'horizontal overflow '+file+' '+width);
  if(file==='index.html'){
   assert.equal(videos.length,0,'home defers animation downloads below fold');
   await page.locator('#about').scrollIntoViewIfNeeded();
  } else if(file.startsWith('article.html')) await page.locator('.has-wuxia-closing').scrollIntoViewIfNeeded();
  await page.waitForFunction(()=>[...document.querySelectorAll('.mobile-wuxia-art video')].some(v=>!v.paused&&v.currentTime>0.05),{timeout:15000});
  assert(await page.locator('.mobile-wuxia-art').first().evaluate(e=>e.inert&&e.getAttribute('aria-hidden')==='true'&&getComputedStyle(e).pointerEvents==='none'));
  if(width===390) {
   await page.waitForTimeout(650);
   await page.screenshot({path:path.join(out,file.split('.')[0]+'-'+theme+'.png')});
   if(file==='index.html') {
    await page.locator('#links').scrollIntoViewIfNeeded();await page.waitForTimeout(650);await page.screenshot({path:path.join(out,'station-'+theme+'.png')});
    await page.locator('#achievements > summary').click();await page.locator('.achievement-copy').scrollIntoViewIfNeeded();await page.waitForTimeout(650);await page.screenshot({path:path.join(out,'checkin-'+theme+'.png')});
    await page.locator('.has-wuxia-closing').scrollIntoViewIfNeeded();await page.waitForTimeout(650);await page.screenshot({path:path.join(out,'footer-'+theme+'.png')});
   }
  }
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.waitForFunction(()=>[...document.querySelectorAll('.mobile-wuxia-art video')].every(v=>v.paused));
  assert(await page.locator('.wuxia-motion-control').isDisabled());
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pagehide')));
  assert(await page.locator('.mobile-wuxia-art video').evaluateAll(vs=>vs.every(v=>v.paused)));
  await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pageshow')));
  await page.setViewportSize({width:1280,height:900});
  assert.equal(await page.locator('.mobile-wuxia-art').count(),0);
  await page.setViewportSize({width,height:844});
  await page.locator('.wuxia-motion-control').waitFor({state:'attached'});
  assert.equal(await page.locator('.wuxia-motion-control').count(),1);
  results.push({width,theme,file,status:'PASS'});
 }
 assert.deepEqual(errors,[]);await context.close();console.log('PASS',width,theme);
}
// Manual pause persists and a WebKit user agent uses a transparent image fallback.
for(const imageMode of [false,true]){
 const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block',...(imageMode?{userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1'}:{})});
 await context.route('**/*',r=>r.abort());await installFixtures(context);
 const page=await context.newPage();
 await page.goto('http://localhost:8000/articles.html');
 const art=page.locator('.mobile-wuxia-chapter');
 await page.waitForFunction(()=>document.querySelector('.mobile-wuxia-chapter').dataset.ready==='true');
 if(imageMode) assert(await art.locator('.wuxia-image-motion').getAttribute('src'));
 else assert(await art.locator('video').evaluate(v=>!v.paused&&v.currentTime>=0));
 await page.locator('.wuxia-motion-control').click();
 assert.equal(await page.evaluate(()=>localStorage.getItem('hutao-wuxia-paused')),'1');
 assert(await page.locator('.mobile-wuxia-art video').evaluateAll(vs=>vs.every(v=>v.paused)));
 await page.reload();
 assert.equal(await art.getAttribute('data-motion'),'paused');
 await context.close();results.push({scenario:imageMode?'image-fallback':'manual-pause',status:'PASS'});
}
fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(results,null,2));
}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});

