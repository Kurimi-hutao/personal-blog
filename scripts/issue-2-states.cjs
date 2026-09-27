const {chromium}=require('C:/Users/emmmm/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {installFixtures}=require('./review-fixtures.cjs');
const fs=require('fs'),assert=require('assert');
const out='screenshots/issue-2/states';fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const results=[];
 for(const mode of ['offline','loading','live','motion']){
  const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block',reducedMotion:mode==='motion'?'no-preference':'reduce'});
  await context.route('**/*',r=>['GET','HEAD','OPTIONS'].includes(r.request().method())?r.continue():r.abort());
  if(mode==='motion')await installFixtures(context,{origin:'http://127.0.0.1:8123'});
  if(mode==='offline')await context.route('**/rest/v1/**',r=>r.fulfill({status:503,contentType:'application/json',body:JSON.stringify({message:'本地模拟服务不可用'})}));
  if(mode==='loading')await context.route('**/rest/v1/**',async r=>{await new Promise(resolve=>setTimeout(resolve,2500));await r.fulfill({status:200,contentType:'application/json',body:'[]'}).catch(()=>{});});
  for(const file of mode==='motion'?['index','works','kurumi']:['index','articles','videos']){
   const page=await context.newPage();const errors=[],consoleErrors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource|net::|503|404/.test(m.text()))consoleErrors.push(m.text())});
   await page.goto('http://127.0.0.1:8123/'+file+'.html',{waitUntil:'domcontentloaded'});
   await page.waitForTimeout(mode==='loading'?450:['live','offline'].includes(mode)?11500:2000);
   if(mode!=='loading'){for(let y=0;y<await page.evaluate(()=>document.documentElement.scrollHeight);y+=600){await page.evaluate(y=>scrollTo(0,y),y);await page.waitForTimeout(mode==='motion'?450:60)}}
   await page.screenshot({path:`${out}/${mode}-${file}.png`,fullPage:true});
   const text=await page.locator('main').innerText();assert.equal(errors.length,0);assert((await page.evaluate(()=>document.documentElement.scrollWidth))<=390);
   if(mode==='offline'&&file!=='index')assert(/受阻/.test(text));
   if(mode==='loading'&&file!=='index')assert(/正在/.test(text));
   if(mode==='motion')assert.equal(await page.locator('.reveal').evaluateAll(es=>es.filter(e=>!e.closest('details:not([open])')&&getComputedStyle(e).opacity==='0'&&e.getBoundingClientRect().height>0).length),0);
   results.push({mode,file,errors,consoleErrors,text:text.slice(0,1000),overflow:false});console.log(mode,file);await page.close();
  }await context.close();fs.writeFileSync(out+'/results.json',JSON.stringify(results,null,2));
 }await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
