// iPhone-size checks in Chrome. Safe-area cases are geometry models, not Safari hardware tests.
const {chromium}=require('C:/Users/emmmm/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {installFixtures}=require('./review-fixtures.cjs');
const fs=require('node:fs'),assert=require('node:assert/strict');
const origin=process.env.REVIEW_ORIGIN||'http://127.0.0.1:8015';
const cases=[['iphone16',393,852,3,0,0,0],['iphone16-pro',402,874,3,0,0,0],['iphone16-pro-max',440,956,3,0,0,0],['compact',375,667,2,0,0,0],['browser-bars',393,660,3,0,0,0],['standalone-safe-area',393,852,3,59,34,0],['landscape-safe-area',852,393,3,0,21,59]];
(async()=>{const b=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});fs.mkdirSync('outputs/iphone-publication',{recursive:true});
try{for(const [name,width,height,dpr,top,bottom,side] of cases){
 const c=await b.newContext({viewport:{width,height},deviceScaleFactor:dpr,isMobile:true,hasTouch:true,reducedMotion:'reduce',serviceWorkers:'block'});
 await c.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());await installFixtures(c,{origin});
 await c.route('**/*',r=>['GET','HEAD','OPTIONS'].includes(r.request().method())?r.fallback():r.abort());
 const p=await c.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));
 const ready=async file=>{await p.goto(origin+'/'+file,{waitUntil:'networkidle'});await p.waitForFunction(()=>!document.documentElement.classList.contains('ink-site-loading'));await p.evaluate(()=>document.fonts.ready);if(top||bottom||side)await p.addStyleTag({content:`:root{--mobile-safe-top:${top}px;--mobile-safe-bottom:${bottom}px;--mobile-safe-left:${side}px;--mobile-safe-right:${side}px}`});};
 const fit=async()=>assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'no page overflow');
 const shot=async label=>{if(['iphone16','standalone-safe-area'].includes(name))await p.screenshot({path:`outputs/iphone-publication/${name}-${label}.png`});};
 await ready('index.html');await fit();await shot('home');await p.locator('.menu-toggle').click();await shot('menu');
 for(const control of await p.locator('.site-nav.open a:visible,.nav-utilities button:visible').all()){await control.scrollIntoViewIfNeeded();const r=await control.boundingBox();assert(r.height>=44&&r.width>=44,'44px menu target');}
 await p.locator('.site-search-trigger').click();const d=await p.locator('.site-search-dialog').boundingBox();assert(d.y>=top&&d.y+d.height<=height-bottom+1,'search respects safe area');
 await p.locator('.site-search-field input').fill('片刻');await p.waitForFunction(()=>document.querySelector('.site-search-results').textContent.includes('找到'));await shot('search');await p.keyboard.press('Escape');
 for(const f of ['articles.html','videos.html','works.html']){await ready(f);await fit();await shot(f.split('.')[0]);if(f==='articles.html'){assert(await p.locator('#articleSearch').evaluate(e=>parseFloat(getComputedStyle(e).fontSize)>=16),'input keeps 16px font');const first=await p.locator('.article-list-card').first().boundingBox();if(name==='iphone16')assert(first.y<600,'first article starts within first screen');}}
 await ready('article.html?slug=review-0');await fit();assert(await p.locator('.article-body').evaluate(e=>parseFloat(getComputedStyle(e).fontSize)>=16),'body is at least 16px');await shot('reading');
 const bar=await p.locator('.mobile-reading-bar').boundingBox();assert(bar.height>=66+top,'reading bar clears inset');await p.locator('.reading-toc-trigger').click();await p.locator('.reading-toc-dialog a').nth(1).click();const heading=await p.locator('.article-body h2').nth(1).boundingBox();assert(heading.y>=bar.height-1,'TOC heading below fixed bar');
 await p.locator('#readingTools').scrollIntoViewIfNeeded();if(name==='iphone16')await p.locator('#readingTools').screenshot({path:'outputs/iphone-publication/reading-tools.png'});
 await p.locator('#commentForm').scrollIntoViewIfNeeded();await fit();assert.deepEqual(errors,[]);console.log('PASS '+name);await c.close();
}}finally{await b.close()}})().catch(e=>{console.error(e);process.exit(1)});
