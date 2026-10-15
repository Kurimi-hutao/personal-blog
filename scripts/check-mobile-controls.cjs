const {chromium}=require('C:/Users/emmmm/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {installFixtures}=require('./review-fixtures.cjs');
const assert=require('node:assert/strict'),fs=require('node:fs');
const origin=process.env.REVIEW_ORIGIN||'http://127.0.0.1:8015';
(async()=>{const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
fs.mkdirSync('outputs/mobile-controls',{recursive:true});
try {for(const [width,height] of [[320,568],[390,844],[844,390],[1440,900]]){
 const context=await browser.newContext({viewport:{width,height},isMobile:width<900,hasTouch:width<900,serviceWorkers:'block',reducedMotion:'reduce'});
 await context.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());await installFixtures(context,{origin});
 await context.route('**/*',r=>['GET','HEAD','OPTIONS'].includes(r.request().method())?r.fallback():r.abort());
 const p=await context.newPage(),errors=[],missing=[];p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(r.url().includes('/mobile-ui/')&&!r.ok())missing.push(r.url())});
 const ready=async f=>{await p.goto(origin+'/'+f,{waitUntil:'networkidle'});await p.waitForFunction(()=>!document.documentElement.classList.contains('ink-site-loading'));await p.evaluate(()=>document.fonts.ready)};
 const fit=async()=>assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'no horizontal overflow');
 await ready('index.html');await fit();
 if(width<1081){
  const primary=p.locator('.hero-actions .ink-button');assert.notEqual(await primary.evaluate(e=>getComputedStyle(e).backgroundColor),'rgba(0, 0, 0, 0)');
  await p.screenshot({path:`outputs/mobile-controls/home-${width}.png`});await p.locator('.menu-toggle').click();
  for(const button of await p.locator('.nav-utilities button').all())assert.notEqual(await button.evaluate(e=>getComputedStyle(e,'::before').maskImage),'none','utility has a real icon');
  await p.screenshot({path:`outputs/mobile-controls/menu-${width}.png`});await p.locator('.site-search-trigger').click();
  await p.locator('.site-search-field input').fill('片刻');await p.waitForFunction(()=>document.querySelector('.site-search-results').textContent.includes('找到'));
  await p.screenshot({path:`outputs/mobile-controls/search-${width}.png`});await p.keyboard.press('Escape');
 }
 await ready('article.html?slug=review-0');await fit();
 if(width<900){
  await p.locator('#readingTools').scrollIntoViewIfNeeded();await p.locator('#bookmarkArticle').click();assert.equal(await p.locator('#bookmarkArticle').getAttribute('aria-pressed'),'true');
  await p.locator('#increaseFont').click();assert.equal(await p.evaluate(()=>document.documentElement.style.getPropertyValue('--article-font-scale')),'1.1');
  await p.locator('#readingTools').screenshot({path:`outputs/mobile-controls/tools-${width}.png`});
  await p.locator('#commentForm').scrollIntoViewIfNeeded();await p.locator('#commentForm').screenshot({path:`outputs/mobile-controls/comment-${width}.png`});await fit();
 }
 for(const file of ['articles.html','videos.html','works.html']){await ready(file);await fit();if(width<900)await p.screenshot({path:`outputs/mobile-controls/${file}-${width}.png`});}
 assert.deepEqual(errors,[]);assert.deepEqual(missing,[]);console.log(`PASS mobile control system ${width}x${height}`);await context.close();
}}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
