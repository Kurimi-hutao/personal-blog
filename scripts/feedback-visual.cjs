const {chromium}=require('C:/Users/emmmm/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {installFixtures}=require('./review-fixtures.cjs');
const fs=require('fs'),assert=require('assert');
const out='screenshots/issue-2/feedback';fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const report=[];
for(const width of [1920,390])for(const theme of ['light','dark']){
 const context=await browser.newContext({viewport:{width,height:width===390?844:1200},serviceWorkers:'block',reducedMotion:'reduce'});
 await context.addInitScript(t=>localStorage.setItem('hutao-theme',t),theme);
 await context.route('**/*',r=>['GET','HEAD','OPTIONS'].includes(r.request().method())?r.continue():r.abort());
 await installFixtures(context,{origin:'http://127.0.0.1:8123'});
 for(const file of ['articles','kurumi','index','videos','works','article','pet']){
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:8123/${file}.html${file==='article'?'?slug=review-0':''}`,{waitUntil:'domcontentloaded'});await page.waitForTimeout(file==='pet'?6000:1500);await page.evaluate(()=>document.fonts.ready);
  if(file==='pet'&&await page.locator('#petEntrySkip').isVisible())await page.locator('#petEntrySkip').click();
  if(file==='index')await page.locator('#linksToggle').click();
  for(let y=0;y<await page.evaluate(()=>document.documentElement.scrollHeight);y+=800){await page.evaluate(y=>scrollTo(0,y),y);await page.waitForTimeout(80)}
  await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:`${out}/${file}-${width}-${theme}.png`,fullPage:true});
  const state=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,broken:[...document.images].filter(i=>i.getAttribute('src')&&i.complete&&!i.naturalWidth).map(i=>i.src),brand:document.querySelector('.brand-icon')?.getAttribute('src'),theme:document.documentElement.dataset.theme,background:getComputedStyle(document.body).backgroundImage}));
  report.push({file,width,theme,...state,errors});fs.writeFileSync(out+'/results.json',JSON.stringify(report,null,2));console.log(file,width,theme,state.overflow,state.broken.length);await page.close();
 }await context.close();
}await browser.close();assert(report.every(x=>!x.overflow&&!x.broken.length&&!x.errors.length));})().catch(e=>{console.error(e);process.exit(1)});
