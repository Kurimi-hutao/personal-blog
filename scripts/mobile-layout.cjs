const {chromium}=require('C:/Users/emmmm/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {installFixtures}=require('./review-fixtures.cjs');
const fs=require('fs'),path=require('path');
const phase=process.argv[2]||'before';
const out=path.resolve('screenshots/mobile-'+phase);fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const results=[];
 for(const [width,height] of [[320,568],[390,844],[430,932],[844,390]]){
  const context=await browser.newContext({viewport:{width,height},isMobile:true,hasTouch:true,serviceWorkers:'block',reducedMotion:'reduce'});
  await context.route('**/*',r=>['GET','HEAD','OPTIONS'].includes(r.request().method())?r.continue():r.abort());await installFixtures(context);
  for(const file of ['index.html','articles.html','article.html?slug=review-0','videos.html','works.html','kurumi.html','pet.html','404.html','admin.html']){
   const page=await context.newPage();page.setDefaultTimeout(8000);
   await page.goto('http://localhost:8000/'+file,{waitUntil:'domcontentloaded'});await page.waitForTimeout(1200);
   if(await page.locator('#petEntrySkip').isVisible())await page.locator('#petEntrySkip').click();
   const slug=file.split('.')[0],row={file,width,height};
   row.overflow=await page.evaluate(()=>({width:document.documentElement.scrollWidth,items:[...document.querySelectorAll('main *')].filter(e=>{const r=e.getBoundingClientRect();return r.width&& (r.right>innerWidth+1||r.left< -1)&&getComputedStyle(e).position!=='fixed'}).slice(0,15).map(e=>({tag:e.tagName,cls:e.className,text:e.textContent.slice(0,45)}))}));
   row.visibleOverflow=[];
   for(const section of await page.locator('main > section, main > article, .article-body, .reading-tools').all()){
    if(!await section.isVisible())continue;
    await section.scrollIntoViewIfNeeded();await page.waitForTimeout(100);
    row.visibleOverflow.push(...await section.evaluate(root=>[root,...root.querySelectorAll('*')].filter(e=>{const r=e.getBoundingClientRect();if(!r.width||r.bottom<0||r.top>innerHeight||r.right<=innerWidth+1&&r.left>=-1)return false;for(let a=e.parentElement;a;a=a.parentElement){if(['auto','scroll','hidden','clip'].includes(getComputedStyle(a).overflowX))return false}return true}).map(e=>e.className||e.tagName)));
    if(width===390&&file==='index.html')await page.screenshot({path:path.join(out,`home-${await section.getAttribute('id')||await section.getAttribute('class')}.png`)});
   }
   await page.evaluate(()=>scrollTo(0,0));await page.waitForTimeout(400);
   if(width===390||width===320){await page.screenshot({path:path.join(out,`${slug}-${width}-top.png`)});await page.screenshot({path:path.join(out,`${slug}-${width}.png`),fullPage:true});}
   if(await page.locator('.menu-toggle').isVisible()){
    await page.locator('.menu-toggle').click();await page.waitForTimeout(450);
    row.menu=await page.locator('.menu-toggle').evaluate(e=>{const b=e.getBoundingClientRect();const bars=[...e.querySelectorAll('span:not(.sr-only)')].map(s=>{const r=s.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}});return {button:{x:b.x+b.width/2,y:b.y+b.height/2},bars}});
    if(file==='index.html'){await page.screenshot({path:path.join(out,`menu-${width}.png`)});await page.evaluate(()=>document.documentElement.dataset.theme='dark');await page.screenshot({path:path.join(out,`menu-dark-${width}.png`)});}
    await page.locator('.site-nav').evaluate(e=>e.scrollTop=e.scrollHeight);await page.waitForTimeout(150);row.lastLinkReachable=await page.locator('.site-nav a').last().evaluate(e=>{const r=e.getBoundingClientRect();return r.top>=-1&&r.bottom<=innerHeight+1});
    await page.keyboard.press('Escape');row.closed=await page.locator('.menu-toggle').getAttribute('aria-expanded')==='false';
   }
   results.push(row);fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(results,null,2));await page.close();
  }await context.close();console.log('Checked',width,height);
 }await browser.close();
 const failures=results.filter(r=>r.overflow.width>r.width||r.visibleOverflow.length||(r.menu&&r.menu.bars.some(b=>Math.abs(b.x-r.menu.button.x)>.6||Math.abs(b.y-r.menu.button.y)>.6))||r.closed===false||r.lastLinkReachable===false);
 console.log(JSON.stringify(failures,null,2));if(failures.length)process.exitCode=1;
})().catch(e=>{console.error(e);process.exit(1)});
