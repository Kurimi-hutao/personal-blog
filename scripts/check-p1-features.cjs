const { chromium } = require('C:/Users/emmmm/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const { installFixtures, records } = require('./review-fixtures.cjs');
const fs=require('node:fs'), path=require('node:path'), assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'), origin='http://localhost:8129';
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jR2kAAAAASUVORK5CYII=','base64');
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.woff2':'font/woff2','.webp':'image/webp','.png':'image/png','.json':'application/json'};
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 fs.mkdirSync(path.join(root,'screenshots/p1-features'),{recursive:true});
 try { for(const width of [390,1440]) {
  const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce',serviceWorkers:'block'});
  await context.route('**/*',route=>route.abort());
  await context.route(origin+'/**',async route=>{
   const name=decodeURIComponent(new URL(route.request().url()).pathname);
   const file=path.join(root,name==='/'?'index.html':name);
   if(!fs.existsSync(file)||!fs.statSync(file).isFile())return route.fulfill({status:404,body:''});
   await route.fulfill({body:fs.readFileSync(file),contentType:mime[path.extname(file)]||'application/octet-stream'});
  });
  await installFixtures(context,{origin});
  let comments=[{id:'c1',article_id:'review-0',visitor_name:'甲',body:'第一楼',created_at:'2026-09-01T00:00:00Z',attachments:[]},{id:'c2',article_id:'review-0',visitor_name:'乙',body:'置顶第二楼',created_at:'2026-09-02T00:00:00Z',pinned:true,attachments:[]},...Array.from({length:5},(_,i)=>({id:`r${i}`,article_id:'review-0',parent_id:'c1',reply_to_id:'c1',visitor_name:`楼中访客${i}`,body:`回复${i}`,created_at:`2026-09-03T00:00:0${i}Z`,attachments:[]}))];
  const posts=[];let failNext=false,uploads=0;
  await context.route('**/rest/v1/comments*',async route=>{
   if(route.request().method()==='POST'){
    const data=route.request().postDataJSON();posts.push(data);
    if(failNext){failNext=false;return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({message:'测试网络中断'})});}
    const created={...data,id:`sent-${posts.length}`,created_at:new Date().toISOString(),approved:true};comments.push(created);
    return route.fulfill({contentType:'application/json',body:JSON.stringify(created)});
   }
   const id=new URL(route.request().url()).searchParams.get('article_id')?.slice(3);
   return route.fulfill({contentType:'application/json',body:JSON.stringify(comments.filter(c=>c.article_id===id))});
  });
  await context.route('**/storage/v1/object/comment-attachments/**',async route=>{uploads++;await route.fulfill({contentType:'application/json',body:JSON.stringify({Key:'comment-attachments/test.png',Id:'test'})});});
  await context.route('**/storage/v1/object/public/comment-attachments/**',route=>route.fulfill({body:png,contentType:'image/png'}));
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  const ready=async()=>{await page.locator('#commentForm').waitFor({state:'visible'});await page.locator('.ink-site-loader').waitFor({state:'detached',timeout:30000});};
  const open=async slug=>{await page.goto(`${origin}/article.html?slug=${slug}`,{waitUntil:'domcontentloaded'});await ready();};
  const send=()=>page.locator('#commentForm [type=submit]').click();
  const success=async()=>{try{await page.waitForFunction(()=>document.querySelector('#commentStatus').textContent==='发送成功。',{},{timeout:8000});}catch(error){console.log({status:await page.locator('#commentStatus').innerText(),posts,errors});throw error;}};
  await open('review-0');await page.locator('#comment-c1').waitFor();
  assert((await page.locator('#comment-c2 > header').innerText()).includes('2 楼'));assert.equal(await page.locator('#commentList > article').first().getAttribute('id'),'comment-c2');
  assert((await page.locator('#comment-c1 > header').innerText()).includes('1 楼'));
  assert.equal(await page.locator('#comment-c1 .comment-reply').count(),3);
  await page.locator('#comment-c1 .comment-more').click();assert.equal(await page.locator('#comment-c1 .comment-reply').count(),5);
  await page.locator('#comment-r1 .comment-reply-button').first().click();
  assert.equal(await page.locator('[name=parentId]').inputValue(),'c1');assert.equal(await page.locator('[name=replyToId]').inputValue(),'r1');
  await page.locator('[name=body]').fill('楼中楼草稿');await page.waitForTimeout(400);await page.reload();await ready();
  assert.equal(await page.locator('[name=body]').inputValue(),'楼中楼草稿');assert.equal(await page.locator('[name=replyToId]').inputValue(),'r1');
  await page.locator('[name=body]').press('Control+Enter');await success();
  assert.equal(posts.at(-1).parent_id,'c1');assert.equal(posts.at(-1).reply_to_id,undefined);assert.equal(posts.at(-1).attachments[0].__hutao_comment.replyToId,'r1');assert(posts.at(-1).visitor_name.startsWith('访客'));
  assert(await page.locator(`#comment-sent-${posts.length}`).isVisible());
  await page.locator('#commentImageInput').setInputFiles({name:'image.png',mimeType:'image/png',buffer:png});await page.waitForTimeout(500);
  await page.reload();await ready();await page.locator('#commentPreviews img').waitFor({state:'visible'});
  assert.equal(await page.locator('[name=body]').inputValue(),'');failNext=true;const before=uploads;
  await send();await page.waitForFunction(()=>document.querySelector('#commentStatus').classList.contains('error'));
  assert.equal(await page.locator('#commentPreviews img').count(),1);await send();await success();
  assert.equal(uploads-before,1,'retry reuses uploaded image');assert.equal(posts.at(-1).body,'图片评论');assert.equal(posts.at(-1).attachments[0].__hutao_comment.imageOnly,true);assert.equal(posts.at(-1).attachments.length,1);
  await page.locator(`#comment-sent-${posts.length} .comment-image`).click();assert(await page.locator('.comment-image-dialog').isVisible());await page.keyboard.press('Escape');
  await page.locator('[name=body]').evaluate(el=>{const data=new DataTransfer();data.items.add(new File([new Uint8Array([1,2,3])],'pasted.png',{type:'image/png'}));el.dispatchEvent(new ClipboardEvent('paste',{clipboardData:data,bubbles:true,cancelable:true}));});
  assert.equal(await page.locator('#commentPreviews img').count(),1);await page.locator('#commentPreviews button').click();
  await page.locator('#commentImageInput').setInputFiles(Array.from({length:4},(_,i)=>({name:`file-${i}.png`,mimeType:'image/png',buffer:png})));
  assert((await page.locator('#commentStatus').innerText()).includes('最多'));assert.equal(await page.locator('#commentPreviews img').count(),0);
  await page.locator('[name=body]').fill('文章专属草稿');await page.waitForTimeout(400);await open('review-1');assert.equal(await page.locator('[name=body]').inputValue(),'');
  await open('review-0');assert.equal(await page.locator('[name=body]').inputValue(),'文章专属草稿');await page.locator('[name=body]').fill('');await page.waitForTimeout(400);
  await page.locator('#comments').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(root,`screenshots/p1-features/comments-${width}.png`)});
  await page.addInitScript(()=>{if(!sessionStorage.getItem('resume-seed')){localStorage.setItem('hutao-reading-positions',JSON.stringify({'review-0':{ratio:.45,title:'测试',updatedAt:Date.now()}}));sessionStorage.setItem('resume-seed','1');}});
  await open('review-0');assert((await page.locator('.reading-resume').innerText()).includes('45%'));await page.locator('.reading-resume button').first().click();await page.waitForTimeout(400);
  assert(await page.evaluate(()=>scrollY>300));await page.mouse.wheel(0,200);await page.waitForTimeout(500);
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('hutao-reading-positions'))['review-0']);assert(saved.ratio>.45);
  if(width===390){await page.locator('.reading-toc-trigger').click();assert(await page.locator('.reading-toc-dialog').isVisible());await page.locator('.reading-toc-dialog a').last().click();assert.equal(await page.locator('.reading-toc-dialog').isVisible(),false);}
  await page.evaluate(records=>localStorage.setItem('hutao-bookmarked-articles',JSON.stringify(records.map(r=>({id:r.id,title:r.title,slug:r.slug,category:r.category,tags:r.tags})))),records);
  await page.evaluate(()=>scrollTo(0,0));await page.waitForTimeout(300);await page.locator('.site-search-trigger').click();await page.locator('[data-search-bookmarks]').click();await page.waitForFunction(()=>document.querySelectorAll('.bookmark-row').length===5);
  await page.locator('.site-search-field input').fill('生活');await page.waitForFunction(()=>document.querySelectorAll('.bookmark-row').length===2);
  await page.locator('.bookmark-row button').first().click();await page.waitForFunction(()=>document.querySelectorAll('.bookmark-row').length===1);
  await page.locator('.site-search-field input').fill('');await page.waitForFunction(()=>document.querySelectorAll('.bookmark-row').length===4);
  await page.screenshot({path:path.join(root,`screenshots/p1-features/bookmarks-${width}.png`)});
  assert.deepEqual(errors,[]);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  console.log(`PASS ${width}px: floors, reply targets, text/image drafts, image-only, upload retry, paste, limits, resume, TOC, all bookmarks`);await context.close();
 }}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
