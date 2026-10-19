// Synthetic records only; no production content is modified.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
let chromium;try{({chromium}=require('playwright'));}catch{({chromium}=require('C:/Users/emmmm/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));}
const {installFixtures}=require('./review-fixtures.cjs');process.env.REVIEW_LOCAL_FILES='1';
fs.mkdirSync('outputs/cover-followup',{recursive:true});
(async()=>{const b=await chromium.launch({headless:true,...(process.platform==='win32'?{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}:{})});try{
 for(const width of [390,900,1080,1440,1920])for(const theme of ['light','dark']){
  const c=await b.newContext({viewport:{width,height:1000},serviceWorkers:'block',reducedMotion:'reduce'});await c.route('**/*',r=>r.abort());await installFixtures(c);await c.addInitScript(t=>localStorage.setItem('hutao-theme',t),theme);
  if(process.env.REVIEW_OVERLAY)await c.route('http://localhost:8000/**',async r=>{const root=path.resolve(process.env.REVIEW_OVERLAY),file=path.resolve(root,'.'+decodeURIComponent(new URL(r.request().url()).pathname));if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile())return r.fallback();await r.fulfill({body:fs.readFileSync(file),contentType:{'.html':'text/html','.css':'text/css','.js':'text/javascript'}[path.extname(file)]||'application/octet-stream'});});
  const p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
  let fallback;
  for(const file of ['index.html','articles.html']){
   await p.goto('http://localhost:8000/'+file);await p.evaluate(()=>window.InkLottie.loaded);await p.evaluate(()=>document.fonts.ready);
   const selector=file==='index.html'?'#latestArticles .article-card':'.article-list-card';
   await p.waitForFunction(sel=>document.querySelector(sel+':not(.static-fallback)'),selector);
   const cards=p.locator(selector);await cards.first().waitFor();
   if(file==='index.html'&&width>900){for(const card of await cards.all()){const a=await card.boundingBox(),v=await card.locator('.card-visual').boundingBox();assert(v.width>a.width*.45,'desktop cover is squeezed into a narrow sidebar');assert(Math.abs(v.width/v.height-16/9)<.03);assert.equal(await card.locator('img').evaluate(e=>getComputedStyle(e).objectFit),'cover','desktop image leaves letterboxing');}}
   const second=cards.nth(1),image=second.locator('img');assert.equal(await image.count(),1,'uncovered article must have an illustration');
   await image.evaluate(e=>e.decode());assert(await image.evaluate(e=>e.naturalWidth>0));const src=await image.getAttribute('src');
   if(fallback)assert.equal(src,fallback,'same article changes cover across pages');fallback=src;
   assert((await cards.first().locator('img').getAttribute('src')).includes('ink-scroll.webp'),'uploaded cover was replaced');
   const variants=await p.evaluate(()=>new Set(Array.from({length:30},(_,i)=>articleService.fallbackCover({id:'test-'+i}).url)).size);assert(variants>=3,'default covers lack variety');
   await p.evaluate(async()=>{const urls=[...new Set(Array.from({length:30},(_,i)=>articleService.fallbackCover({id:'test-'+i}).url))];await Promise.all(urls.map(url=>{const image=new Image();image.src=url;return image.decode();}));});
   await p.reload();await p.waitForFunction(sel=>document.querySelector(sel+':not(.static-fallback)'),selector);assert.equal(await p.locator(selector).nth(1).locator('img').getAttribute('src'),fallback,'reload shuffled cover');
   assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   if(width===390||width===1440){const area=p.locator(file==='index.html'?'#articles':'.all-articles-grid');await area.scrollIntoViewIfNeeded();await area.screenshot({path:`outputs/cover-followup/${file.split('.')[0]}-${width}-${theme}.png`});}
  }
  assert.deepEqual(errors,[]);console.log(`PASS ${width}px ${theme}: full desktop cover, varied stable fallback, uploaded cover preserved`);await c.close();
 }
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1});
