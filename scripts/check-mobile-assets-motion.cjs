const{chromium}=require('C:/Users/emmmm/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const{installFixtures}=require('./review-fixtures.cjs');const fs=require('node:fs'),assert=require('node:assert/strict');
process.env.REVIEW_LOCAL_FILES='1';const origin='http://127.0.0.1:8015';
(async()=>{const b=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});fs.mkdirSync('outputs/mobile-assets-motion',{recursive:true});
try{for(const reducedMotion of ['no-preference','reduce']){
 const c=await b.newContext({viewport:{width:393,height:852},deviceScaleFactor:3,isMobile:true,hasTouch:true,reducedMotion,serviceWorkers:'block'});
 await c.route('**/*',r=>new URL(r.request().url()).origin===origin?r.fallback():r.abort());await installFixtures(c,{origin});
 const p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto(origin+'/index.html',{waitUntil:'networkidle'});await p.waitForFunction(()=>!document.documentElement.classList.contains('ink-site-loading'));await p.evaluate(()=>document.fonts.ready);
 assert.match(await p.locator('.hero-art').evaluate(e=>e.currentSrc),/mobile-publication\/homepage-day-02/);
 await p.locator('.hero-art').evaluate(e=>e.decode());await p.screenshot({path:`outputs/mobile-assets-motion/day-${reducedMotion}.png`});
 await p.locator('.menu-toggle').tap();const animated=await p.locator('.nav-primary a').first().evaluate(e=>e.getAnimations().length>0);assert.equal(animated,reducedMotion==='no-preference','menu entrance respects preference');
 await p.waitForTimeout(500);await p.locator('.theme-toggle').tap();assert.match(await p.locator('.spring-night').evaluate(e=>getComputedStyle(e).backgroundImage),/mobile-publication\/homepage-night-02/);await p.locator('.menu-toggle').tap();await p.waitForTimeout(900);await p.screenshot({path:`outputs/mobile-assets-motion/night-${reducedMotion}.png`});
 await p.locator('.menu-toggle').tap();await p.locator('.site-search-trigger').tap();await p.locator('.site-search-field input').fill('片刻');await p.waitForFunction(()=>document.querySelector('.site-search-results').textContent.includes('找到'));await p.locator('[data-search-close]').tap();await p.waitForFunction(()=>!document.querySelector('.site-search-dialog').open);
 const cdp=await c.newCDPSession(p);const r=await p.locator('.menu-toggle').boundingBox(),x=r.x+r.width/2,y=r.y+r.height/2;
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});assert.equal(await p.locator('.mobile-touch-pressed').count()>0,reducedMotion==='no-preference');
 await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y+30}]});assert.equal(await p.locator('.mobile-touch-pressed').count(),0,'swipe cancels press');await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 await p.locator('.menu-toggle').tap();await p.emulateMedia({reducedMotion:'reduce'});assert.equal(await p.locator('.nav-primary a').first().evaluate(e=>e.getAnimations().length),0,'changing motion preference cancels animation');
 await p.keyboard.press('Escape');assert.equal(await p.locator('.site-nav').evaluate(e=>e.classList.contains('open')),false);
 if(reducedMotion==='no-preference'){await p.emulateMedia({reducedMotion:'no-preference'});await p.locator('.menu-toggle').tap();await p.keyboard.press('Escape');assert.equal(await p.locator('.nav-primary a').first().evaluate(e=>e.getAnimations().length),0,'fast close clears menu motion');}
 assert.equal(await p.locator('.ink-click-ripple').count(),0);assert.deepEqual(errors,[]);await c.close();console.log('PASS assets and mobile interactions '+reducedMotion);
 }
 // Test the cover component in isolation, without auth, uploads or publication.
 const c=await b.newContext({serviceWorkers:'block'});await c.route('**/*',r=>new URL(r.request().url()).origin===origin?r.fallback():r.abort());await installFixtures(c,{origin});const p=await c.newPage();
 let html=fs.readFileSync('admin.html','utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'');await c.route(origin+'/admin.html',r=>r.fulfill({body:html,contentType:'text/html'}));
 await p.goto(origin+'/admin.html');await p.addScriptTag({path:'admin-cover.js'});
 for(const name of ['physics','education']){
  await p.locator(`[data-library-cover*="${name}"]`).evaluate(e=>e.click());const selected=await p.evaluate(()=>window.adminCover.selection());assert.match(selected.attachment.url,new RegExp('article-cover-'+name+'-concept.webp'));assert.equal(selected.file,null);await p.locator('#coverPreview').evaluate(e=>e.decode());
 }
 await p.locator('#clearCover').evaluate(e=>e.click());assert.equal(await p.evaluate(()=>window.adminCover.selection().attachment),null);await c.close();console.log('PASS optional cover library selection and reset');
}finally{await b.close()}})().catch(e=>{console.error(e);process.exit(1)});
