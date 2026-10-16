const {chromium}=require('C:/Users/emmmm/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {installFixtures}=require('./review-fixtures.cjs');
const fs=require('fs'),path=require('path');
process.env.REVIEW_LOCAL_FILES='1';
const out=path.resolve('screenshots/interaction-audit-20261016');fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const results=process.env.AUDIT_WIDTH&&fs.existsSync(path.join(out,'results.json'))?JSON.parse(fs.readFileSync(path.join(out,'results.json'))).filter(r=>[375,390,1440].includes(r.width)&&r.width!==Number(process.env.AUDIT_WIDTH)):[];
 for(const [width,height] of [[390,844],[1440,900],[375,667]].filter(s=>!process.env.AUDIT_WIDTH||s[0]===Number(process.env.AUDIT_WIDTH))){
  const ctx=await browser.newContext({viewport:{width,height},isMobile:width<600,hasTouch:width<600,reducedMotion:'reduce',serviceWorkers:'block'});
  await ctx.route('**/*',r=>r.abort());await installFixtures(ctx);
  await ctx.route('**/rest/v1/rpc/visitor_check_in',r=>r.fulfill({contentType:'application/json',body:JSON.stringify({total_days:1,streak:1})}));
  const p=await ctx.newPage();p.setDefaultTimeout(12000);
  const snap=async(name)=>{await p.waitForTimeout(250);await p.screenshot({path:path.join(out,`${name}-${width}.png`)});};
  const ready=async(file)=>{await p.goto('http://localhost:8000/'+file,{waitUntil:'domcontentloaded'});await p.locator('.ink-site-loader').waitFor({state:'hidden',timeout:30000});await p.evaluate(()=>document.fonts.ready);};
  const metrics=async(name)=>results.push({width,height,name,...await p.evaluate(()=>({scrollWidth:document.documentElement.scrollWidth,dialogs:[...document.querySelectorAll('dialog[open]')].map(e=>({class:e.className,clientHeight:e.clientHeight,scrollHeight:e.scrollHeight,rect:JSON.parse(JSON.stringify(e.getBoundingClientRect()))})),smallTargets:[...document.querySelectorAll('dialog[open] button,#links button,#achievements button')].filter(e=>e.getClientRects().length).map(e=>({text:e.textContent.trim(),w:e.getBoundingClientRect().width,h:e.getBoundingClientRect().height})),brokenImages:[...document.images].filter(i=>i.complete&&!i.naturalWidth&&i.getAttribute('src')).map(i=>i.getAttribute('src'))}))});
  await ready('index.html');await snap('home');
  await p.locator('#links').scrollIntoViewIfNeeded();await snap('station-closed');await p.locator('#linksToggle').click();await p.locator('.friend-group summary').first().click();await p.locator('.friend-group').first().scrollIntoViewIfNeeded();await snap('station-open');await metrics('station');results.push({width,name:'station-length',...await p.locator('#links').evaluate(e=>({height:e.getBoundingClientRect().height,entries:e.querySelectorAll('#linksCollapsible .friend-card').length,toggleTop:e.querySelector('#linksToggle').getBoundingClientRect().top,groups:[...e.querySelectorAll('.friend-group')].map(x=>x.getBoundingClientRect().height)}))});
  await p.locator('#linksToggle').click();await p.locator('#achievements summary').click();await p.locator('#achievements').scrollIntoViewIfNeeded();await snap('checkin');
  await p.locator('#checkinButton').click();await p.locator('#fortuneDialog').waitFor({state:'visible'});await snap('fortune');await metrics('fortune');
  await p.locator('.fortune-close').click();await p.locator('#checkinButton').click();results.push({width,name:'repeat-fortune',open:await p.locator('#fortuneDialog').evaluate(e=>e.open)});await p.keyboard.press('Escape');
  for(const rank of ['上吉','上上吉','下下吉']){await p.evaluate(rank=>{const f=JSON.parse(localStorage.getItem('hutao-daily-fortune'));f.rank=rank;localStorage.setItem('hutao-daily-fortune',JSON.stringify(f));},rank);await p.locator('#checkinButton').click();results.push({width,name:'rank-wrap',rank,...await p.locator('#fortuneTitle').evaluate(e=>({height:e.getBoundingClientRect().height,fontSize:getComputedStyle(e).fontSize,titleWidth:e.getBoundingClientRect().width}))});await snap('fortune-'+rank);await p.keyboard.press('Escape');}
  await p.evaluate(()=>document.documentElement.dataset.theme='dark');await snap('checkin-dark');await p.locator('#checkinButton').click();await snap('fortune-dark');await p.keyboard.press('Escape');
  await p.evaluate(()=>document.documentElement.dataset.theme='light');await p.locator('#message').scrollIntoViewIfNeeded();await snap('guestbook');
  await p.evaluate(()=>scrollTo(0,0));if(width<600){await p.locator('.menu-toggle').click();await snap('menu');}
  await p.locator('.site-search-trigger:visible').first().click();await snap('search');await p.locator('.site-search-field input').fill('zzzzzz');await snap('search-empty');await metrics('search');await p.locator('[data-search-bookmarks]').click();await snap('bookmarks-empty');await p.keyboard.press('Escape');
  if(width!==375)for(const file of ['articles.html','article.html?slug=review-0','videos.html','works.html','kurumi.html','pet.html']){
   await ready(file);if(file==='pet.html')await p.waitForTimeout(5500);await snap(file.split('.')[0]+'-top');await metrics(file);
   if(file.startsWith('article.html')){await p.locator('#comments').scrollIntoViewIfNeeded();await snap('comments');await p.locator('.comment-reply-button').first().click();await snap('comment-reply');if(width<600){await p.locator('.reading-toc-trigger').click();await snap('reading-toc');await p.keyboard.press('Escape');}}
   if(file==='articles.html'||file==='videos.html'){await p.locator('.article-filters').scrollIntoViewIfNeeded();await snap(file.split('.')[0]+'-filters');await p.locator('.animated-select__trigger').first().click();await snap(file.split('.')[0]+'-dropdown');await p.keyboard.press('Escape');}
  }
  await ctx.close();fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(results,null,2));console.log('Completed',width);
 }
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
