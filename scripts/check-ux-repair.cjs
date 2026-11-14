let chromium;try { ({chromium}=require('playwright')); } catch { ({chromium}=require('C:/Users/emmmm/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')); }

const {installFixtures,records}=require('./review-fixtures.cjs');
const fs=require('node:fs'),assert=require('node:assert/strict');process.env.REVIEW_LOCAL_FILES='1';fs.mkdirSync('outputs/ux-repair',{recursive:true});
(async()=>{const b=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH || (process.platform==='win32'?'C:/Program Files/Google/Chrome/Application/chrome.exe':undefined)});const results=[];
try {for(const [width,height] of [[390,844],[768,1024],[1440,900]])for(const reducedMotion of ['no-preference','reduce']) {
const c=await b.newContext({viewport:{width,height},reducedMotion,serviceWorkers:'block'});await c.route('**/*',r=>r.abort());await installFixtures(c);await c.addInitScript(()=>sessionStorage.setItem('hutao-seal-intro','seen'));
const p=await c.newPage();let errors=[];p.on('pageerror',e=>errors.push(e.message));
for(const route of ['index.html','articles.html','article.html?slug=review-0','videos.html','works.html','kurumi.html','pet.html']) {
await p.goto('http://localhost:8000/'+route,{waitUntil:'load'});await p.waitForTimeout(450);
if(route.startsWith('article.html'))await p.waitForFunction(()=>document.querySelector('.article-body')?.dataset.mathState==='ready');
if(route==='pet.html')await p.waitForFunction(()=>document.querySelector('#petRig')?.dataset.live2d==='ready'||document.querySelector('#modelStatus')?.classList.contains('is-error'),null,{timeout:32000});
const overflow=await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);
assert(!overflow,route+' overflow '+width);
for(const theme of ['dark','light']){await p.evaluate(t=>{document.documentElement.dataset.theme=t},theme);assert(!await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1));}
if(route==='index.html'){
 await p.evaluate(()=>summonPetals());await p.waitForTimeout(200);
 if(reducedMotion==='no-preference'){assert(await p.locator('.manual-petal').count()>=6);assert(await p.locator('.manual-petal').first().isVisible());await p.evaluate(()=>{for(let i=0;i<10;i++)summonPetals()});assert(await p.locator('.manual-petal').count()<=40)}else assert(await p.locator('.petal-feedback-toast').isVisible());
 await p.locator('#links').scrollIntoViewIfNeeded();
}
if(route==='works.html'){await p.evaluate(()=>window.originalWork=document.querySelector('.work-card'));await p.locator('#worksToolbar button').nth(1).click();await p.waitForTimeout(350);await p.locator('#worksToolbar button').first().click();await p.waitForTimeout(350);assert(await p.evaluate(()=>originalWork===document.querySelector('.work-card')));}
if(route==='videos.html'){await p.waitForSelector('.video-card');await p.evaluate(()=>window.originalVideo=document.querySelector('.video-card'));await p.locator('#videoSearch').fill('not-a-result');await p.waitForTimeout(500);await p.locator('#clearVideoFilters').click();await p.waitForTimeout(500);assert(await p.evaluate(()=>originalVideo===document.querySelector('.video-card')));}
if(route==='videos.html') {
 const allLabel=await p.locator('#videoCategory option').first().textContent();
 const category=await p.locator('#videoCategory option').nth(1).getAttribute('value');
 await p.locator('#videoCategory').selectOption(category, {force:true}); await p.waitForTimeout(400);
 await p.goBack(); await p.waitForTimeout(400);
 assert.equal(await p.locator('#videoCategory').inputValue(),'');
 assert.equal(await p.locator('#videoCategory + .animated-select .animated-select__value').textContent(),allLabel);
 await p.goForward(); await p.waitForTimeout(400);
 assert.equal(await p.locator('#videoCategory').inputValue(),category);
 assert.equal(await p.locator('#videoCategory + .animated-select .animated-select__value').textContent(),category);
}
if(route==='kurumi.html'){await p.locator('[data-gallery-src]').first().click();assert(await p.locator('#imageLightbox').isVisible());await p.keyboard.press('Escape');await p.locator('#imageLightbox').waitFor({state:'hidden'});assert(!await p.evaluate(()=>document.documentElement.classList.contains('gallery-dialog-open')));}
if(route==='index.html') {
 await p.evaluate(()=>scrollTo({top:0,behavior:'instant'})); await p.waitForTimeout(350);
 if(!await p.locator('.site-search-trigger').isVisible()) await p.locator('.menu-toggle').click();
 await p.locator('.site-search-trigger').click(); await p.locator('.site-search-dialog').waitFor({state:'visible'});
 await p.keyboard.press('Escape'); await p.locator('.site-search-dialog').waitFor({state:'hidden'});
 assert(!await p.evaluate(()=>document.documentElement.classList.contains('search-dialog-open')));
}
if(route==='works.html'||route==='videos.html') { await p.waitForTimeout(400); const card=p.locator(route==='works.html'?'.work-card':'.video-card').first();assert.equal(await card.evaluate(e=>getComputedStyle(e).opacity),'1'); }
if(width===1440) {const rect=await p.locator('.theme-toggle').boundingBox();assert(rect&&rect.x>=0&&rect.x+rect.width<=width);}
results.push({route,width,height,reducedMotion,overflow,errors:[...errors]});assert.deepEqual(errors,[],route);console.log('PASS',route,width,reducedMotion);
if(reducedMotion==='no-preference')await p.screenshot({path:`outputs/ux-repair/${route.split('.')[0]}-${width}.png`});
}
await c.close();}
// Cold dynamic insertion before KaTeX settles, then resource failure recovery.
const c=await b.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});await c.route('**/*',r=>r.abort());await installFixtures(c);let release;const gate=new Promise(r=>release=r);await c.route('**/auto-render-*.js',async r=>{await gate;await r.fallback()});const p=await c.newPage();await p.goto('http://localhost:8000/article.html?slug=review-0',{waitUntil:'commit'});await p.waitForSelector('.article-body',{state:'attached'});assert.equal(await p.locator('.article-body').evaluate(e=>getComputedStyle(e).visibility),'hidden');release();await p.waitForFunction(()=>document.querySelector('.article-body')?.dataset.mathState==='ready');assert(await p.locator('.katex').count()>0);
await p.evaluate(async()=>{const render=window.renderMathInElement;delete window.renderMathInElement;const node=document.createElement('div');node.textContent='inline $x^2$, display $$\\\\frac{1}{2}$$';document.body.append(node);const done=renderArticleMath(node);setTimeout(()=>window.renderMathInElement=render,100);await done;if(!node.querySelector('.katex'))throw Error('late formula failed');node.remove()});console.log('PASS cold delayed math + after-load dependency');
await c.close();
}finally{fs.writeFileSync('outputs/ux-repair/browser-results.json',JSON.stringify(results,null,2));await b.close()}})().catch(e=>{console.error(e);process.exitCode=1});
