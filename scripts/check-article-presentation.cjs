// Browser checks use local fixtures and block every production request.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
let chromium;try{({chromium}=require('playwright'));}catch{({chromium}=require('C:/Users/emmmm/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));}
const {installFixtures}=require('./review-fixtures.cjs');process.env.REVIEW_LOCAL_FILES='1';
const out=path.resolve('outputs/article-presentation');fs.mkdirSync(out,{recursive:true});
(async()=>{const b=await chromium.launch({headless:true,...(process.platform==='win32'?{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}:{})});try{
for(const width of (process.env.REVIEW_WIDTHS ? process.env.REVIEW_WIDTHS.split(',').map(Number) : [320,390,768,1080,1440,1920]))for(const theme of ['light','dark']){
 const c=await b.newContext({viewport:{width,height:960},serviceWorkers:'block',hasTouch:width<=900});await c.route('**/*',r=>r.abort());await installFixtures(c);await c.addInitScript(t=>localStorage.setItem('hutao-theme',t),theme);
 if(process.env.REVIEW_OVERLAY)await c.route('http://localhost:8000/**',async r=>{const root=path.resolve(process.env.REVIEW_OVERLAY),file=path.resolve(root,'.'+decodeURIComponent(new URL(r.request().url()).pathname));if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile())return r.fallback();await r.fulfill({body:fs.readFileSync(file),contentType:{'.html':'text/html','.css':'text/css','.js':'text/javascript'}[path.extname(file)]||'application/octet-stream'});});
 await c.addInitScript(() => { window.articleMotionFrames=[]; const original=Element.prototype.animate; Element.prototype.animate=function(frames,options){if(this.matches('.card-visual, .article-list-cover'))window.articleMotionFrames.push({className:this.className,frames,options});return original.call(this,frames,options);}; });
 const p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
 for(const file of ['index.html','articles.html']){
  await p.goto('http://localhost:8000/'+file);await p.evaluate(()=>window.InkLottie.loaded);await p.evaluate(()=>document.fonts.ready);
  const home=file==='index.html',sel=home?'#latestArticles .article-card':'.article-list-card',cover=home?'.card-visual':'.article-list-cover';
  await p.waitForFunction(s=>document.querySelector(s+':not(.static-fallback)'),sel);
  const first=p.locator(sel).first();await first.scrollIntoViewIfNeeded();
  await p.waitForFunction(() => window.articleMotionFrames.length>0);
  await p.waitForTimeout(1000);
  for(const card of await p.locator(sel).all()){
   const visual=await card.locator(cover).boundingBox(),copy=await card.locator(home?'.card-content':'.article-list-copy').boundingBox();
   const ratio=width<=900?2:16/9;assert(Math.abs(visual.width/visual.height-ratio)<.035,'cover ratio');
   if(width<=900)assert(visual.y+visual.height<=copy.y+1,'mobile copy overlaps image');
   assert.equal(await card.evaluate(e=>getComputedStyle(e).backgroundColor),'rgba(0, 0, 0, 0)','heavy card panel remains');
  }
  if(width>900){await first.hover();await p.waitForTimeout(350);const transform=await first.locator('img').evaluate(e=>getComputedStyle(e).transform);assert.notEqual(transform,'none','desktop has no hover feedback');await p.mouse.move(0,0);}
  assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'horizontal overflow');
  if(!home){await p.locator('#articleSearch').fill('未题封面');await p.waitForFunction(()=>document.querySelectorAll('.article-list-card').length===1);await p.locator('#clearFilters').click();await p.waitForFunction(()=>document.querySelectorAll('.article-list-card').length===5);}
  if(width===390||width===1440){await p.locator('.site-header').evaluate(e=>e.style.visibility='hidden');const area=p.locator(home?'#articles':'.all-articles-grid');await area.scrollIntoViewIfNeeded();await p.waitForTimeout(1000);await area.screenshot({path:path.join(out,`${home?'home':'archive'}-${width}-${theme}.png`)});}
 }
 await p.emulateMedia({reducedMotion:'reduce'});await p.goto('http://localhost:8000/articles.html');await p.waitForFunction(()=>document.querySelector('.article-list-card img'));await p.locator('.article-list-card').first().scrollIntoViewIfNeeded();await p.waitForTimeout(150);assert.equal(await p.evaluate(()=>window.articleMotionFrames.length),0,'reduced motion still animates cover');
 await p.locator('.article-list-card').first().click();await p.waitForURL('**/article.html?slug=review-0');await p.locator('.article-body h2').first().waitFor();assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 if(width===390||width===1440)await p.locator('.article-detail-header').screenshot({path:path.join(out,`reading-${width}-${theme}.png`)});
 assert.deepEqual(errors,[]);console.log(`PASS ${width}px ${theme}: layout, entrance, hover, filtering, reduced motion, reading link`);await c.close();
}
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1});
