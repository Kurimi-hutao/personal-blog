const {chromium}=require('C:/Users/emmmm/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {installFixtures}=require('./review-fixtures.cjs');
const fs=require('fs'),assert=require('assert');
const out='docs/issue-2/home-articles';fs.mkdirSync(out,{recursive:true});
(async()=>{const b=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const results=[];
for(const [width,height] of [[1920,1200],[390,844]])for(const theme of ['light','dark']){
 const c=await b.newContext({viewport:{width,height},serviceWorkers:'block',reducedMotion:'reduce'});
 await c.addInitScript(t=>localStorage.setItem('hutao-theme',t),theme);
 await c.route('**/*',r=>['GET','HEAD','OPTIONS'].includes(r.request().method())?r.continue():r.abort());
 await installFixtures(c,{origin:'http://127.0.0.1:8123'});
 const p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto('http://127.0.0.1:8123/index.html',{waitUntil:'domcontentloaded'});await p.waitForTimeout(1800);await p.evaluate(()=>document.fonts.ready);
 await p.locator('.ink-site-loader').waitFor({state:'hidden',timeout:20000});
 await p.locator('#articles').scrollIntoViewIfNeeded();await p.waitForTimeout(300);
 await p.locator('#articles').screenshot({path:`${out}/${width}-${theme}.jpg`,quality:85});
 const state=await p.locator('#articles').evaluate(e=>{const cards=[...e.querySelectorAll('.article-card')];const a=cards[0],v=a.querySelector('.card-visual').getBoundingClientRect(),t=a.querySelector('.card-content').getBoundingClientRect();return {count:cards.length,cover:{x:v.x,y:v.y,width:v.width},copy:{x:t.x,y:t.y},featuredWidth:a.clientWidth,gridWidth:e.querySelector('.article-grid').clientWidth,overflow:document.documentElement.scrollWidth>innerWidth,links:cards.map(c=>c.querySelector('a').getAttribute('href')),broken:[...e.querySelectorAll('img')].filter(i=>!i.complete||!i.naturalWidth).length}});
 assert(state.count>=2);assert(width===390?state.cover.y<state.copy.y:state.cover.x<state.copy.x);assert(Math.abs(state.featuredWidth-state.gridWidth)<3);assert(!state.overflow&&!state.broken&&!errors.length);assert(state.links.every(h=>h.includes('article.html')));
 results.push({width,height,theme,...state,errors});await c.close();
}await b.close();fs.writeFileSync(out+'/results.json',JSON.stringify(results,null,2));console.log(results)})().catch(e=>{console.error(e);process.exit(1)});
