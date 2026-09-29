// The baseline directory is a byte-verified copy of f9075b6 served on 8124.
const {chromium}=require('C:/Users/emmmm/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {installFixtures}=require('./review-fixtures.cjs');
const fs=require('fs');
const out='screenshots/issue-2/comparison';fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
for(const [phase,port] of [['before',8124],['after',8123]])for(const [width,height] of [[1920,1200],[390,844]]){
 const context=await browser.newContext({viewport:{width,height},serviceWorkers:'block',reducedMotion:'reduce'});
 await context.route('**/*',r=>['GET','HEAD','OPTIONS'].includes(r.request().method())?r.continue():r.abort());
 await installFixtures(context,{origin:`http://127.0.0.1:${port}`});
 for(const [name,file,selector] of [['home','index','#articles'],['articles','articles','.article-page-shell'],['videos','videos','.article-page-shell'],['works','works','main'],['gallery','kurumi','.kurumi-gallery-section'],['pet','pet','#petRoom']]){
  const page=await context.newPage();await page.goto(`http://127.0.0.1:${port}/${file}.html`,{waitUntil:'domcontentloaded'});await page.waitForTimeout(file==='pet'?5500:1200);await page.evaluate(()=>document.fonts.ready);
  if(file==='pet'&&await page.locator('#petEntrySkip').isVisible())await page.locator('#petEntrySkip').click();
  const target=page.locator(selector);await target.scrollIntoViewIfNeeded();await page.waitForTimeout(600);
  await target.screenshot({path:`${out}/${name}-${width}-${phase}.png`});console.log(name,width,phase);await page.close();
 }await context.close();
}await browser.close()})().catch(e=>{console.error(e);process.exit(1)});
