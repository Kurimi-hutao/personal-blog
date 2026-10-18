// Run: node scripts/check-mobile-botanicals.cjs. All remote data is intercepted.
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
let chromium;try{({chromium}=require('playwright'));}catch{({chromium}=require('C:/Users/emmmm/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));}
const {installFixtures}=require('./review-fixtures.cjs');
process.env.REVIEW_LOCAL_FILES='1';
const output=path.resolve('outputs/mobile-botanicals-20261018');fs.mkdirSync(output,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}:{})});
 const results=[];
 try{for(const width of [320,390,430,900])for(const theme of ['light','dark']){
  const context=await browser.newContext({viewport:{width,height:844},serviceWorkers:'block',reducedMotion:'no-preference'});
  await context.route('**/*',r=>r.abort());await installFixtures(context);
  await context.addInitScript(t=>{localStorage.setItem('hutao-theme',t);sessionStorage.setItem('hutao-site-intro-seen-v1','1')},theme);
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  for(const file of ['index.html','articles.html','works.html','article.html?slug=review-0']){
   await page.goto('http://localhost:8000/'+file,{waitUntil:'domcontentloaded'});
   await page.evaluate(()=>window.InkLottie.loaded);await page.evaluate(()=>document.fonts.ready);
   const root=page.locator('.mobile-peach-garden');await root.waitFor();
   await page.waitForFunction(()=>document.querySelector('.mobile-peach-garden')?.dataset.motion==='playing');
   assert.equal(await root.count(),1);assert.equal(await root.getAttribute('aria-hidden'),'true');
   assert.equal(await root.evaluate(e=>getComputedStyle(e).pointerEvents),'none');
   assert(await page.locator('.mobile-peach-branch').evaluate(e=>e.complete&&e.naturalWidth>0));
   assert.equal(await page.locator('.mobile-peach-petal').count(),4);
   const animations=()=>root.evaluate(e=>e.getAnimations({subtree:true}).map(a=>({state:a.playState,time:a.currentTime,transform:getComputedStyle(a.effect.target).transform})));
   const start=await animations();await page.waitForTimeout(250);const end=await animations();
   assert(end.every((a,i)=>a.time>start[i].time),'each animation advances');
   assert.notEqual(start[0].transform,end[0].transform,'branch moves');
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'no horizontal overflow');
   if(width===390){
    await root.evaluate(e=>e.getAnimations({subtree:true}).forEach((a,i)=>a.currentTime=i?i*2300+1800:2000));
    await page.screenshot({path:path.join(output,file.split('.')[0]+'-'+theme+'.png')});
   }
   await page.emulateMedia({reducedMotion:'reduce'});
   await page.waitForFunction(()=>document.querySelector('.mobile-peach-garden').dataset.motion==='paused');
   assert.equal(await root.getAttribute('data-motion'),'paused');assert((await animations()).every(a=>a.state==='paused'));
   assert.equal(await page.locator('.mobile-peach-fall').isVisible(),false);
   await page.emulateMedia({reducedMotion:'no-preference'});
   await page.waitForFunction(()=>document.querySelector('.mobile-peach-garden').dataset.motion==='playing');
   const menu=page.locator('.menu-toggle');
   if(await menu.isVisible()){
    await menu.click();await page.waitForFunction(()=>document.querySelector('.mobile-peach-garden').dataset.motion==='paused');await page.keyboard.press('Escape');
   }
   await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pagehide')));
   assert.equal(await root.getAttribute('data-motion'),'paused');
   await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pageshow')));
   await page.evaluate(()=>scrollTo(0,document.documentElement.scrollHeight));
   await page.waitForFunction(()=>document.querySelector('.mobile-peach-garden').dataset.motion==='paused');
   await page.evaluate(()=>scrollTo(0,0));
   await page.setViewportSize({width:1440,height:900});await root.waitFor({state:'detached'});assert.equal(await root.count(),0,'desktop removes decoration');
   await page.setViewportSize({width,height:844});await root.waitFor();assert.equal(await root.count(),1,'resize never duplicates');
  }
  assert.deepEqual(errors,[]);results.push({width,theme,status:'PASS'});console.log('PASS peach motion '+width+' '+theme);
  await context.close();
 }fs.writeFileSync(path.join(output,'results.json'),JSON.stringify(results,null,2));}
 finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
