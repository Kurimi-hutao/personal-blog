// Local visual review only. Remote requests are blocked or served by fixtures.
const { chromium } = require('C:/Users/emmmm/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const { installFixtures } = require('./review-fixtures.cjs');
const fs = require('node:fs'), path = require('node:path');
const root = path.resolve(__dirname, '..'), origin = 'http://localhost:8137';
const mime = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.woff2':'font/woff2','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.json':'application/json'};
(async()=>{
 const browser = await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const out = path.join(root,'screenshots/comment-ui-review'); fs.mkdirSync(out,{recursive:true});
 try {
  for (const [width,theme] of [[320,'light'],[390,'light'],[1440,'light'],[390,'dark'],[1440,'dark']]) {
   const context = await browser.newContext({viewport:{width,height:1000},reducedMotion:'reduce',serviceWorkers:'block'});
   await context.route('**/*',route=>route.abort());
   await context.route(origin+'/**',route=>{
    const file = path.join(root,decodeURIComponent(new URL(route.request().url()).pathname));
    return fs.existsSync(file)&&fs.statSync(file).isFile()?route.fulfill({body:fs.readFileSync(file),contentType:mime[path.extname(file)]||'application/octet-stream'}):route.fulfill({status:404,body:''});
   });
   await installFixtures(context,{origin});
   await context.route('**/rest/v1/comments*',route=>route.fulfill({contentType:'application/json',body:JSON.stringify([
    {id:'c1',visitor_name:'江湖过客',body:'这段记录很有意思，读完想留下几句话。',created_at:'2026-10-10T08:00:00Z',like_count:3,attachments:[],pinned:true,is_owner:true},
    {id:'r1',parent_id:'c1',reply_to_id:'c1',visitor_name:'山间来客',body:'回复一下，期待下一卷。',created_at:'2026-10-10T09:00:00Z',attachments:[]}
   ])}));
   await context.route('**/rest/v1/guestbook*',route=>route.fulfill({contentType:'application/json',body:JSON.stringify([{id:'g1',visitor_name:'江湖过客',body:'风来翻卷，来留一句问候。',created_at:'2026-10-10T08:00:00Z'}])}));
   const page=await context.newPage();
   await page.addInitScript(theme=>{localStorage.setItem('hutao-theme',theme);},theme);
   for (const [name,url,selector] of [['home','index.html','#message'],['article','article.html?slug=review-0','#comments'],['video','article.html?slug=video-0','#comments']]) {
    await page.goto(origin+'/'+url,{waitUntil:'domcontentloaded'});
    await page.locator(selector).waitFor({state:'visible'});
    if(name==='home') { await page.locator(selector).scrollIntoViewIfNeeded(); await page.locator('#guestbookList article').waitFor({state:'visible'}); }
    else await page.locator('#commentList .comment-item').first().waitFor({state:'visible'});
    await page.locator('.ink-site-loader').waitFor({state:'detached',timeout:30000});
    await page.evaluate(theme=>document.documentElement.setAttribute('data-theme',theme),theme);
    await page.evaluate(()=>document.fonts.ready);
    await page.locator(selector).scrollIntoViewIfNeeded();
    await page.locator(selector).screenshot({path:path.join(out,`${name}-${width}${theme==='dark'?'-dark':''}.png`)});
    if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)) throw new Error(`${name} ${width} overflow`);
    console.log(JSON.stringify({name,width,form:await page.locator(selector+' form').innerText(),horizontalOverflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)}));
   }
   await context.route('**/rest/v1/comments*',route=>route.fulfill({contentType:'application/json',body:'[]'}));
   await page.goto(origin+'/article.html?slug=review-1',{waitUntil:'domcontentloaded'});
   await page.locator('#commentList .ink-state img').waitFor();
   await page.evaluate(theme=>document.documentElement.setAttribute('data-theme',theme),theme);
   await page.locator('#commentList .ink-state img').evaluate(img=>img.decode());
   await page.locator('#comments').screenshot({path:path.join(out,`empty-${width}-${theme}.png`)});
   await context.close();
  }
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
