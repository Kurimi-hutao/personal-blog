const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const {chromium}=require('C:/Users/emmmm/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {installFixtures}=require('./review-fixtures.cjs');
process.env.REVIEW_LOCAL_FILES='1';
async function overlayEntry(context) {
 if (!process.env.REWARD_ENTRY_HTML) return;
 await context.route('http://blog.test/article.html?**', async route => route.fulfill({body:await fs.readFile(process.env.REWARD_ENTRY_HTML),contentType:'text/html'}));
}

(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 try{
  const context=await browser.newContext({viewport:{width:1440,height:1000},serviceWorkers:'block'});
  await context.route('**/*',r=>r.abort());await installFixtures(context,{origin:'http://blog.test'});await overlayEntry(context);
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  let popupCount=0;page.on('popup',()=>popupCount++);
  const out=path.join(__dirname,'../outputs/reward-modal');await fs.mkdir(out,{recursive:true});
  await page.goto('http://blog.test/article.html?slug=review-0');await page.locator('.reward-submit').waitFor();
  await page.evaluate(()=>document.fonts.ready);
  const url=page.url();
  const dialog=page.locator('#articleRewardDialog');
  const open=async()=>{await page.locator('.reward-submit').click();await page.locator('#articleRewardDialog[open]').waitFor();await page.waitForTimeout(260);};
  const closed=async()=>{await page.waitForFunction(()=>!document.querySelector('#articleRewardDialog').open);await page.waitForTimeout(40);};
  const preset=amount=>dialog.locator(`.payment-presets label:has(input[value="${amount}"])`);
  await page.locator('.reward-submit').scrollIntoViewIfNeeded();const originalScroll=await page.evaluate(()=>scrollY);
  await open();const lockedScroll=await page.evaluate(()=>-parseFloat(document.body.style.top));assert.equal(popupCount,0,'No new window or tab');assert.equal(page.url(),url);
  assert(await dialog.evaluate(el=>el.matches(':modal')),'Native top-layer modal');
  assert.equal(await dialog.locator('#paymentAmount').textContent(),'¥5.00');
  await page.mouse.wheel(0,500);assert.equal(await page.evaluate(()=>scrollY),0,'Background body stays fixed');
  assert.equal(await page.evaluate(()=>document.body.style.position),'fixed');
  for(const amount of ['1','5','10']){await preset(amount).click();assert.equal(await dialog.locator('#paymentAmount').textContent(),`¥${Number(amount).toFixed(2)}`);assert.equal(page.url(),url);}
  await preset('custom').click();
  for(const amount of ['','201','0','-1','1.001']){await dialog.locator('#rewardCustom').fill(amount);assert(await dialog.locator('#invalidAmount').isVisible());assert.equal(await dialog.locator('#paymentContent').isVisible(),false);}
  for(const amount of ['0.01','9.90','200']){await dialog.locator('#rewardCustom').fill(amount);assert.equal(await dialog.locator('#paymentAmount').textContent(),`¥${Number(amount).toFixed(2)}`);assert(await dialog.locator('#paymentContent').isVisible());}
  await preset('5').click();
  for(const provider of ['alipay','wechat']){await dialog.locator(`[data-provider="${provider}"]`).click();await page.waitForFunction(()=>document.querySelector('#paymentQr').naturalWidth>0);assert.match(await dialog.locator('#saveQr').getAttribute('download'),new RegExp(provider));}
  await dialog.locator('.reward-dialog-close').focus();await page.keyboard.press('Shift+Tab');
  assert.equal(await page.evaluate(()=>document.activeElement.id),'closePayment','Focus wraps inside card');
  await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.className),'reward-dialog-close');
  await page.keyboard.press('Escape');await closed();assert.equal(await page.evaluate(()=>document.activeElement.className),'reward-submit');
  const restoredScroll=await page.evaluate(()=>scrollY);assert(Math.abs(restoredScroll-lockedScroll)<2,`Close restores article scroll position: beforeClick=${originalScroll}, locked=${lockedScroll}, after=${restoredScroll}`);
  await open();await page.mouse.click(5,5);await closed();
  await open();await dialog.locator('#closePayment').click();await closed();
  await open();await dialog.locator('.reward-dialog-close').click();await closed();
  for(let n=0;n<3;n++){await open();await page.keyboard.press('Escape');await closed();}assert.equal(await page.locator('#articleRewardDialog').count(),1,'No duplicate cards');
  for(const theme of ['light','dark']){
   await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
   for(const [width,height] of [[1440,1000],[390,844],[320,568],[844,390]]){
    await page.setViewportSize({width,height});await open();await page.evaluate(()=>document.fonts.ready);
    await page.waitForFunction(()=>document.querySelector('.payment-coffee').naturalWidth>0);
    const bounds=await dialog.boundingBox();assert(Math.abs(bounds.x+bounds.width/2-width/2)<2,'Horizontal center');assert(Math.abs(bounds.y+bounds.height/2-height/2)<2,'Vertical center');
    assert(bounds.x>=0&&bounds.y>=0&&bounds.x+bounds.width<=width+1&&bounds.y+bounds.height<=height+1,'Card within viewport');
    assert(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth),'No horizontal clipping');
    const btn=await dialog.locator('.reward-dialog-close').boundingBox();assert(btn.y>=0&&btn.y+btn.height<=height,'Close remains visible');
    await page.screenshot({path:path.join(out,`${theme}-${width}x${height}.png`)});
    if(width===390){await preset('custom').click();await dialog.locator('#rewardCustom').fill('9.9');await dialog.locator('#rewardCustom').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(out,`${theme}-custom-390.png`)});await preset('5').click();}
    await page.keyboard.press('Escape');await closed();assert.equal(page.url(),url);
   }
  }
  await page.setViewportSize({width:390,height:844});await open();
  await page.evaluate(()=>{document.documentElement.style.setProperty('--visual-viewport-height','340px');document.documentElement.style.setProperty('--visual-viewport-top','30px');});
  await page.waitForTimeout(30);const keyboardBox=await dialog.boundingBox();assert(keyboardBox.y>=30&&keyboardBox.y+keyboardBox.height<=370,'Card fits simulated keyboard viewport');
  await page.screenshot({path:path.join(out,'keyboard-viewport.png')});await page.keyboard.press('Escape');await closed();
  await page.evaluate(()=>{document.documentElement.style.removeProperty('--visual-viewport-height');document.documentElement.style.removeProperty('--visual-viewport-top');});
  await context.close();assert.deepEqual(errors,[]);
  for(const reducedMotion of ['no-preference','reduce']){
   const ctx=await browser.newContext({viewport:{width:1440,height:1000},serviceWorkers:'block',reducedMotion});await ctx.route('**/*',r=>r.abort());await installFixtures(ctx,{origin:'http://blog.test'});await overlayEntry(ctx);
   const p=await ctx.newPage();await p.goto('http://blog.test/article.html?slug=video-0');await p.locator('.reward-submit').click();
   if(reducedMotion==='no-preference'){
    const timing=await p.evaluate(()=>{const d=document.querySelector('#articleRewardDialog');const a=d.getAnimations().find(a=>a.effect.target===d);const frames=[];for(const t of [0,70,140,220]){a.pause();a.currentTime=t;frames.push({t,opacity:Number(getComputedStyle(d).opacity),y:d.getBoundingClientRect().y});}a.finish();return frames;});
    assert(timing[0].opacity<timing[1].opacity&&timing[1].opacity<timing[3].opacity,'Opening fades progressively');await fs.writeFile(path.join(out,'motion-samples.json'),JSON.stringify(timing,null,2));
   }else assert.equal(await p.locator('#articleRewardDialog').evaluate(d=>d.getAnimations().length),0,'Reduced motion disables animation');
   await ctx.close();
  }
  console.log('PASS: same page/no popup, preset/custom limits, provider/download, four close paths, focus trap/restore, scroll lock/restore, repeat open, light/dark desktop/mobile/landscape centering, keyboard viewport, animation sampling, reduced motion, video entry.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
