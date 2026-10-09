const {chromium}=require('C:/Users/emmmm/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict'),fs=require('node:fs');
const origin=process.env.PET_REVIEW_ORIGIN||'http://127.0.0.1:8124';
const out='screenshots/pet-cottage-assets-20261009';fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 try {
 for(const width of [320,390,768,1440]) {
  const context=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block',reducedMotion:'reduce'});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.text().includes('[pet-room]'))console.log(m.text())});
  if(width===320) await page.route('**/seethrough_output.model3.json',r=>r.abort());
  await page.goto(origin+'/pet.html');
  if(width===320) {
   await page.locator('#retryModel').waitFor({state:'visible'});
   await page.waitForFunction(()=>!document.querySelector('#petEntry'));
   assert.equal(await page.locator('#petFallback').isVisible(),true);
   await page.screenshot({path:out+'/fallback-hutao.png',fullPage:true});
   await page.unroute('**/seethrough_output.model3.json');
   await page.locator('#retryModel').click();
  }
  await page.waitForFunction(()=>document.querySelector('#modelStatus').classList.contains('is-ready'),{timeout:30000});
  await page.waitForFunction(()=>!document.querySelector('#petEntry'));
  assert.equal(await page.locator('.live2d-canvas').count(),1);
  assert.equal(await page.locator('#petFallback').isVisible(),false);
  assert.equal(await page.locator('.action-grid .cottage-icon').count(),6);
  await page.locator('#motionToggle').click();assert((await page.locator('#motionToggle img').getAttribute('src')).includes('motion_off'));
  await page.locator('#motionToggle').click();assert((await page.locator('#motionToggle img').getAttribute('src')).includes('motion_on'));
  await page.locator('#soundToggle').click();assert((await page.locator('#soundToggle img').getAttribute('src')).includes('sound_off'));
  await page.locator('#soundToggle').click();
  const read=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('hutao-house-state-v3')));
  await page.locator('#dailyTab').click();
  for(const action of ['pet','play','sleep']) {
   await page.locator('[data-task="'+action+'"]').click();
   await page.waitForFunction(()=>!document.querySelector('[data-action="pet"]').disabled);
  }
  assert.equal((await read()).coins,32);assert.equal(await page.locator('#dailyProgress').innerText(),'3 / 3 完成');
  await page.locator('[data-action="pet"]').click();await page.waitForFunction(()=>!document.querySelector('[data-action="pet"]').disabled);
  assert.equal((await read()).coins,32);
  await page.locator('[data-action="feed"]').click();await page.waitForFunction(()=>!document.querySelector('[data-action="pet"]').disabled);assert.equal((await read()).coins,30);
  await page.locator('#sceneToggle').click();assert.equal(await page.locator('#sceneToggle').innerText(),'场景：清晨');
  await page.reload();await page.waitForFunction(()=>!document.querySelector('[data-action="pet"]').disabled);
  assert.equal(await page.locator('#sceneToggle').innerText(),'场景：清晨');assert.equal(await page.locator('#dailyProgress').innerText(),'3 / 3 完成');
  await page.locator('[data-character="zhang"]').click();await page.waitForFunction(()=>document.querySelector('#profileName').textContent==='张起灵');
  assert((await page.locator('#profileAvatarImage').getAttribute('src')).includes('avatars/zhang.png'));
  assert((await page.locator('#petFallback').getAttribute('src')).includes('fallbacks/zhang.png'));
  await page.route('**/Fireman.model3.json',r=>r.abort());
  await page.locator('[data-character="fireman"]').click();await page.locator('#retryModel').waitFor({state:'visible'});
  assert.equal(await page.locator('#profileName').textContent(),'张起灵');assert.equal(await page.locator('.live2d-canvas').count(),1);
  await page.unroute('**/Fireman.model3.json');await page.locator('#retryModel').click();await page.waitForFunction(()=>document.querySelector('#profileName').textContent==='季沧海');
  await page.locator('[data-character="hutao"]').click();
  await page.waitForFunction(()=>document.querySelector('#profileName').textContent==='小桃').catch(async e=>{console.log(await page.locator('#modelStatus').textContent());console.log(errors);throw e});
  const checks=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,duplicates:[...document.querySelectorAll('[id]')].map(e=>e.id).filter((id,i,a)=>a.indexOf(id)!==i),small:[...document.querySelectorAll('.action-grid button,.journal-panel button')].filter(e=>{const r=e.getBoundingClientRect();return e.getClientRects().length>0&&(r.width<44||r.height<44)}).length}));
  assert.equal(checks.overflow,false);assert.deepEqual(checks.duplicates,[]);assert.equal(checks.small,0);assert.deepEqual(errors,[]);
  await page.evaluate(()=>scrollTo(0,0));await page.waitForTimeout(2300);
  await page.screenshot({path:out+'/'+width+'-day.png',fullPage:true});
  await page.evaluate(()=>{document.documentElement.dataset.theme='dark';scrollTo(0,0)});
  for(let n=0;n<3;n++) await page.locator('#sceneToggle').click();
  await page.evaluate(()=>scrollTo(0,0));await page.waitForTimeout(400);
  assert((await page.locator('#sceneToggle img').getAttribute('src')).includes('scene_night.png'));
  if(width<=620)assert((await page.locator('.room-scenery').evaluate(e=>getComputedStyle(e).backgroundImage)).includes('pet-cottage/room-night-mobile.png'));
  const broken=await page.evaluate(()=>[...document.images].filter(i=>i.complete&&!i.naturalWidth).map(i=>i.src));assert.deepEqual(broken,[]);
  await page.screenshot({path:out+'/'+width+'-night.png',fullPage:true});
  // A new local calendar date resets task eligibility, preserving the wallet.
  await page.evaluate(()=>{const k='hutao-house-state-v3',s=JSON.parse(localStorage.getItem(k));s.daily.date='2000-01-01';s.energy=0;s.lastGift=new Date().toLocaleDateString('sv-SE');localStorage.setItem(k,JSON.stringify(s));});
  await page.reload();await page.waitForFunction(()=>!document.querySelector('[data-action="pet"]').disabled);
  assert.equal(await page.locator('#dailyProgress').innerText(),'0 / 3 完成');
  await page.locator('[data-action="play"]').click();assert.equal((await read()).energy,0);assert.equal((await read()).coins,30);
  await page.locator('.status-card summary').click();assert.equal(await page.locator('#dailyGift').isDisabled(),true);
  console.log(JSON.stringify({width,...checks,errors,tasks:true,persistence:true,failedVisitRecovery:true,lowEnergy:true}));
  await context.close();
 }
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
