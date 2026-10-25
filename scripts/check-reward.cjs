const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('C:/Users/emmmm/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const { installFixtures } = require('./review-fixtures.cjs');
const origin = 'http://blog.test';
process.env.REVIEW_LOCAL_FILES = '1';
(async () => {
 const browser = await chromium.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true });
 try {
  const context=await browser.newContext({serviceWorkers:'block',reducedMotion:'reduce'});
  await context.route('**/*',route=>route.abort());
  await installFixtures(context,{origin});
  const page=await context.newPage();
  const errors=[];context.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));page.on('pageerror',e=>errors.push(e.message));
  const out=path.join(__dirname,'../outputs/reward-seal');await fs.mkdir(out,{recursive:true});
  await page.goto(origin+'/article.html?slug=review-0');
  await page.locator('.article-reward').waitFor();
  assert.equal(await page.locator('.article-reward').count(),1);
  assert.equal(await page.locator('.article-reward input').count(),0,'Amounts belong in payment window');
  const opened=page.waitForEvent('popup');await page.locator('.reward-submit').click();const popup=await opened;await popup.waitForLoadState();
  assert.equal(await popup.locator('#paymentAmount').textContent(),'¥5.00');
  for(const amount of ['1','5','10']){
   await popup.locator(`.payment-presets label:has(input[value="${amount}"])`).click();
   assert.equal(await popup.locator('#paymentAmount').textContent(),`¥${Number(amount).toFixed(2)}`);
   assert.equal(new URL(popup.url()).searchParams.get('amount'),Number(amount).toFixed(2));
  }
  await popup.locator('.payment-presets label:has(input[value="custom"])').click();
  for(const invalid of ['','201','0','-1','1.001']){
   await popup.locator('#rewardCustom').fill(invalid);
   assert.equal(await popup.locator('#invalidAmount').isVisible(),true);
   assert.equal(await popup.locator('#paymentContent').isVisible(),false,'Invalid amount hides payment code');
  }
  for(const amount of ['0.01','9.90','200']){
   await popup.locator('#rewardCustom').fill(amount);
   assert.equal(await popup.locator('#paymentAmount').textContent(),`¥${Number(amount).toFixed(2)}`);
   assert.equal(await popup.locator('#paymentContent').isVisible(),true);
  }
  await popup.locator('[data-provider="alipay"]').click();
  await popup.waitForFunction(()=>document.querySelector('#paymentQr').naturalWidth>0);
  assert.match(await popup.locator('#paymentQr').getAttribute('src'),/alipay\.png/);
  assert.match(await popup.locator('#saveQr').getAttribute('download'),/alipay/);
  await popup.locator('[data-provider="wechat"]').click();
  await popup.locator('.payment-presets label:has(input[value="5"])').click();
  assert.equal(await popup.locator('#rewardCustom').isDisabled(),true);
  assert.match(await popup.locator('#paymentInstruction').textContent(),/手动输入 ¥5.00/);
  for(const width of [460,390,320]){
   await popup.setViewportSize({width,height:780});
   await popup.waitForFunction(()=>document.querySelector('.payment-coffee').naturalWidth>0);
   assert(await popup.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Payment fits '+width);
   await popup.screenshot({path:path.join(out,`payment-${width}.png`),fullPage:true});
  }
  await Promise.all([popup.waitForEvent('close'),popup.locator('#closePayment').click()]);
  for(const theme of ['light','dark']){
   await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
   for(const width of [1440,390,320]){
    await page.setViewportSize({width,height:900});
    await page.locator('.article-reward').scrollIntoViewIfNeeded();
    assert(await page.locator('.article-reward').evaluate(el=>el.getBoundingClientRect().right<=innerWidth),'Entry fits '+width);
    await page.locator('.article-reward').screenshot({path:path.join(out,`entry-${theme}-${width}.png`)});
   }
  }
  await page.evaluate(()=>{window.open=()=>null;});await page.locator('.reward-submit').click();
  assert.match(await page.locator('.reward-window-note a').getAttribute('href'),/theme=dark/);
  await page.goto(origin+'/article.html?slug=video-0');await page.locator('.article-reward').waitFor();assert.equal(await page.locator('.article-reward').count(),1);
  for(const raw of ['','-1','0','201','NaN','1.001','Infinity']){
   await page.goto(origin+'/reward.html?amount='+encodeURIComponent(raw));
   assert(await page.locator('#invalidAmount').isVisible());assert.equal(await page.locator('#paymentContent').isVisible(),false);
   await page.locator('.payment-presets label:has(input[value="1"])').click();assert.equal(await page.locator('#paymentContent').isVisible(),true,'Invalid URL can recover');
  }
  await page.goto(origin+'/reward.html?theme=dark');assert.equal(await page.locator('#paymentAmount').textContent(),'¥5.00');
  assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');await page.screenshot({path:path.join(out,'payment-dark-320.png'),fullPage:true});
  assert.deepEqual(errors,[]);await context.close();
  console.log('PASS: seal entry, article/video, popup, in-window presets/custom, precision/bounds, URL recovery, provider/download/close, dark theme, 320/390/460/1440 layouts.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
