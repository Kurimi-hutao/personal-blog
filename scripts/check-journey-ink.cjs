// Offline browser regression checks; all content writes are intercepted.
const {chromium}=require('C:/Users/emmmm/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {installFixtures}=require('./review-fixtures.cjs');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
process.env.REVIEW_LOCAL_FILES='1';
const out=path.resolve('outputs/interaction-fixes-20261016');fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const results=[];
 try {for(const [width,height] of [[320,568],[375,667],[390,844],[430,932],[768,1024],[844,390],[1366,768],[1440,900]]){
  const context=await browser.newContext({viewport:{width,height},isMobile:width<600,hasTouch:width<1081,serviceWorkers:'block',reducedMotion:'reduce'});
  await context.route('**/*',r=>r.abort());await installFixtures(context);
  let checkins=0;
  await context.route('**/rest/v1/rpc/visitor_check_in',r=>{checkins++;return r.fulfill({contentType:'application/json',body:JSON.stringify({total_days:7,streak:3})})});
  const p=await context.newPage(),errors=[];p.setDefaultTimeout(12000);p.on('pageerror',e=>errors.push(e.message));
  const ready=async file=>{await p.goto('http://localhost:8000/'+file,{waitUntil:'domcontentloaded'});await p.locator('.ink-site-loader').waitFor({state:'hidden',timeout:30000});await p.evaluate(()=>document.fonts.ready);};
  const fit=async()=>assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`horizontal overflow at ${width}`);
  const snap=async name=>{await p.waitForTimeout(100);await p.screenshot({path:path.join(out,`${name}-${width}.png`)});};
  await ready('index.html');await fit();
  assert.equal(await p.locator('#stationFavorites .friend-card').count(),6);
  await p.locator('#linksToggle').click();assert(await p.locator('#linksCollapsible').isVisible());
  assert.equal(await p.locator('#linksCollapsible .friend-card').count(),19);
  for(const group of await p.locator('.friend-group').all()){await group.locator('summary').click();assert(await group.locator('.friend-card').first().isVisible());await fit();await group.locator('summary').click();assert.equal(await group.locator('.friend-card').first().isVisible(),false);}
  await p.locator('.friend-group summary').last().click();await p.locator('#linksCollapseBottom').click();
  assert.equal(await p.locator('#linksToggle').getAttribute('aria-expanded'),'false');assert.equal(await p.locator('#linksCollapsible').isVisible(),false);
  assert(await p.locator('#linksToggle').evaluate(e=>document.activeElement===e));
  await p.locator('#achievements summary').click();await p.locator('#checkinButton').click();
  await p.locator('#fortuneDialog').waitFor({state:'visible'});
  assert.equal(await p.locator('#achievementCards .unlocked').count(),3);assert.equal(await p.locator('#checkinTrail .visited').count(),3);
  assert((await p.locator('#achievementStatus').innerText()).includes('累计签到 7 天'));
  const closeSize=await p.locator('.fortune-close').boundingBox();assert(closeSize.width>=44&&closeSize.height>=44);
  await p.keyboard.press('Escape');
  for(const rank of ['上吉','上上吉','下下吉']){
   await p.evaluate(rank=>{const f=JSON.parse(localStorage.getItem('hutao-daily-fortune'));f.rank=rank;localStorage.setItem('hutao-daily-fortune',JSON.stringify(f));},rank);
   await p.locator('#checkinButton').click();
   const title=await p.locator('#fortuneTitle').evaluate(e=>{const r=e.getBoundingClientRect(),c=getComputedStyle(e),parent=e.parentElement.getBoundingClientRect();return {height:r.height,line:parseFloat(c.lineHeight),left:r.left,right:r.right,parentLeft:parent.left,parentRight:parent.right}});
   assert(title.height<=title.line+1,`${rank} wrapped at ${width}`);assert(title.left>=title.parentLeft&&title.right<=title.parentRight,`${rank} overflow at ${width}`);
   await fit();if(rank==='上上吉')await snap('fortune');
   await p.locator('#fortuneDialog').evaluate(e=>e.scrollTop=e.scrollHeight);
   const close=await p.locator('.fortune-close').boundingBox();assert(close.y>=0&&close.y+close.height<=height+1,'close remains reachable');
   await p.locator('.fortune-close').click();
  }
  assert.equal(checkins,1,'reopening fortune does not check in twice');
  await p.locator('#achievements').scrollIntoViewIfNeeded();await snap('achievements');
  await p.evaluate(()=>document.documentElement.dataset.theme='dark');await p.locator('#checkinButton').click();await snap('fortune-dark');await p.keyboard.press('Escape');
  await p.locator('#links').scrollIntoViewIfNeeded();await snap('station-dark');await p.evaluate(()=>document.documentElement.dataset.theme='light');
  await p.evaluate(()=>scrollTo(0,0));if(width<=1080)await p.locator('.menu-toggle').click();await p.locator('.site-search-trigger:visible').first().click();
  await p.locator('[data-search-bookmarks]').click();await p.locator('.site-search-field input').fill('不存在');
  await p.locator('.bookmark-empty img').waitFor({state:'visible'});await snap('bookmarks');
  await p.getByRole('button',{name:'清空关键词',exact:true}).click();assert.equal(await p.locator('.site-search-field input').inputValue(),'');
  await p.locator('.site-search-field input').fill('山行');await p.locator('[data-search-bookmarks]').click();
  await p.waitForFunction(()=>document.querySelector('.site-search-results').textContent.includes('山行记'));
  const dialog=await p.locator('.site-search-dialog').boundingBox();assert(dialog.y>=0&&dialog.y+dialog.height<=height+1,'search fits viewport');await p.keyboard.press('Escape');
  await ready('article.html?slug=review-0');await p.locator('.comment-reply-button').first().click();
  const quote=await p.locator('#replyContext > span').evaluate(e=>({height:e.clientHeight,line:parseFloat(getComputedStyle(e).lineHeight),width:e.clientWidth}));
  assert(quote.height<=quote.line*2+1,'reply quote exceeds two lines');assert(quote.width>100,'reply quote squeezed');await snap('reply');
  await p.locator('#cancelReply').click();assert.equal(await p.locator('#replyContext').isVisible(),false);
  if(width<=600){await p.locator('.reading-toc-trigger').click();await p.locator('.reading-toc-dialog a').last().click();assert.equal(await p.locator('.reading-toc-dialog').isVisible(),false);}
  for(const file of ['articles.html','videos.html','works.html','kurumi.html','pet.html']){
   await ready(file);if(file==='pet.html')await p.waitForTimeout(5000);await fit();
   if(file==='articles.html'||file==='videos.html'){await p.locator('.animated-select__trigger').first().click();await p.locator('.animated-select__panel:visible').first().waitFor({state:'visible'});await p.keyboard.press('Escape');}
   if(file==='pet.html'){assert(await p.locator('.pet-cushion').evaluate(e=>e.complete&&e.naturalWidth>0));await snap('pet');}
  }
  assert.deepEqual(errors,[],`browser errors at ${width}`);results.push({width,height,status:'PASS'});console.log(`PASS journey interactions ${width}x${height}`);
  await context.close();fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(results,null,2));
 }}finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
