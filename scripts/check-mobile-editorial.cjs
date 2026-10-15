const {chromium}=require('C:/Users/emmmm/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {installFixtures}=require('./review-fixtures.cjs');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const origin='http://127.0.0.1:8015';
(async()=>{const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
fs.mkdirSync('outputs/mobile-editorial',{recursive:true});
try {for(const [width,height] of [[320,568],[375,812],[390,844],[430,932],[768,900],[844,390],[1440,900]]) {
const context=await browser.newContext({viewport:{width,height},isMobile:width<900,hasTouch:width<900,serviceWorkers:'block',reducedMotion:'reduce'});
await context.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
await installFixtures(context,{origin});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
const ready=async file=>{await page.goto(origin+'/'+file,{waitUntil:'networkidle'});await page.waitForFunction(()=>!document.documentElement.classList.contains('ink-site-loading'));await page.evaluate(()=>document.fonts.ready)};
const overflow=async()=>assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'no horizontal overflow');
await ready('index.html');await overflow();
if(width<=1080){assert.equal(await page.locator('.mobile-control-dock').isVisible(),false);await page.screenshot({path:`outputs/mobile-editorial/home-${width}.png`});
await page.locator('.menu-toggle').click();await page.locator('.nav-primary').waitFor({state:'visible'});
for(const name of ['文章','作品','视频'])assert(await page.locator('.nav-primary a',{hasText:name}).isVisible());
await page.screenshot({path:`outputs/mobile-editorial/menu-${width}.png`});
await page.locator('.nav-utilities .site-search-trigger').click();await page.locator('.site-search-dialog').waitFor({state:'visible'});await page.keyboard.press('Escape');
await page.locator('.menu-toggle').click();await page.locator('.nav-utilities .theme-toggle').click();assert.equal(await page.evaluate(()=>document.documentElement.dataset.theme),'dark');await page.locator('.menu-toggle').click();
await page.screenshot({path:`outputs/mobile-editorial/night-${width}.png`});
}
await ready('article.html?slug=review-0');await overflow();
if(width<=900){assert(await page.locator('.mobile-reading-bar').isVisible());await page.locator('.mobile-reading-bar .reading-toc-trigger').click();assert(await page.locator('.reading-toc-dialog').isVisible());await page.locator('.reading-toc-dialog a').last().click();assert.equal(await page.locator('.reading-toc-dialog').isVisible(),false);await page.locator('.reading-more').click();assert(await page.locator('.site-nav.open').isVisible());await page.keyboard.press('Escape');await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:`outputs/mobile-editorial/reading-${width}.png`});}
assert.deepEqual(errors,[]);console.log(`${width}x${height}: passed`);await context.close();
}}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
