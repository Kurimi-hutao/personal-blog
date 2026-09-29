const { chromium } = require('C:/Users/emmmm/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const { installFixtures } = require('./review-fixtures.cjs');
const fs = require('fs');
const path = require('path');
const phase = process.argv[2] || 'before';
const only = process.argv[3];
const out = path.resolve('screenshots/issue-2', phase);
fs.mkdirSync(out, { recursive: true });
(async () => {
  const browser = await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
  const results = only && fs.existsSync(path.join(out,'results.json')) ? JSON.parse(fs.readFileSync(path.join(out,'results.json'))).filter(r=>r.file!==only) : [];
  for (const [width,height] of (phase==='final'?[[1920,1200],[390,844],[768,1024]]:[[1920,1200],[390,844]])) {
    const context = await browser.newContext({viewport:{width,height},serviceWorkers:'block',reducedMotion:'reduce'});
    await context.route('**/*', r => ['GET','HEAD','OPTIONS'].includes(r.request().method()) ? r.continue() : r.abort());
    await installFixtures(context,{origin:'http://127.0.0.1:8123'});
    for (const file of ['index','articles','article','videos','works','kurumi','pet']) {
      if (only && file!==only) continue;
      const page = await context.newPage();
      const errors=[]; page.on('pageerror',e=>errors.push(e.message));
      await page.goto(`http://127.0.0.1:8123/${file}.html${file==='article'?'?slug=review-0':''}`,{waitUntil:'domcontentloaded'});
      await page.waitForTimeout(file==='pet'?6000:900);
      if(file==='pet' && await page.locator('#petEntrySkip').isVisible()) await page.locator('#petEntrySkip').click();
      await page.evaluate(()=>document.fonts.ready);
      const heightTotal=await page.evaluate(()=>document.documentElement.scrollHeight);
      for(let y=0;y<heightTotal;y+=height) {await page.evaluate(y=>scrollTo(0,y),y);await page.waitForTimeout(80);}
      await page.evaluate(()=>scrollTo(0,0));
      await page.screenshot({path:path.join(out,`${file}-${width}.png`),fullPage:true});
      results.push({file,width,height,scrollWidth:await page.evaluate(()=>document.documentElement.scrollWidth),errors,broken:await page.evaluate(()=>[...document.images].filter(i=>i.getAttribute('src')&&i.complete&&!i.naturalWidth).map(i=>i.src))});
      if(['index','articles','pet'].includes(file)) {
        await page.locator('.theme-toggle').evaluate(e=>e.click());
        await page.screenshot({path:path.join(out,`${file}-${width}-dark.png`),fullPage:true});
        await page.locator('.theme-toggle').evaluate(e=>e.click());
      }
      console.log(phase,file,width); await page.close();
      fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(results,null,2));
    }
    await context.close();
  }
  await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
