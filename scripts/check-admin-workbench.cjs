// Isolated browser checks: all owner data and mutations stay in memory.
const { chromium } = require('C:/Users/emmmm/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const out = path.join(root, 'outputs', 'admin-workbench-qa');
const origin = 'http://admin.test';
const service = `
window.testWorks = [
 {id:'1',title:'三角函数',content_type:'video',category:'数学',series_name:'数学课堂'},
 {id:'2',title:'双曲函数',content_type:'video',category:'数学',published:false},
 {id:'3',title:'山行记：把聚窟洲的暮色写进一页纸里',category:'随笔',tags:['生活']},
 {id:'4',title:'从粒子到宇宙：记录一次漫长而有趣的探索，和沿途那些值得珍藏的细节',category:'物理',scheduled_at:'2099-01-01T00:00:00Z'},
 {id:'5',title:'未完成的手记',category:'随笔',published:false},
 {id:'6',title:'旧版笔记',category:'随笔',deleted_at:'2026-10-01'}
].map((a,i)=>({slug:'work-'+a.id,content_type:'article',excerpt:'这是一段内容摘要。',content:'## 山河之间\\n\\n记录片刻。',attachments:[],tags:[],published:true,view_count:15-i,like_count:3,updated_at:'2026-10-07',published_at:'2026-10-01',...a}));
window.testComments=[{id:'c1',article_id:'1',visitor_name:'访客',body:'希望看到更多这样的讲解。',approved:false,created_at:'2026-10-07',articles:{title:'三角函数'}}];
window.testMutations=[];
window.articleService={configured:true,isOwner:s=>!!s,getSession:async()=>({user:{id:'owner'}}),signOut:async()=>{},
 listAllArticles:async()=>structuredClone(window.testWorks),listAllComments:async()=>structuredClone(window.testComments),listMessages:async()=>[],
 getOwnerDashboard:async()=>({daily:Array.from({length:14},(_,i)=>({day:'2026-10-'+String(i+1).padStart(2,'0'),views:i*7+10,completions:i})),top_works:window.testWorks.slice(0,3)}),
 contentLabel:a=>a.content_type==='video'?'视频':'文章',articleUrl:a=>'article.html?slug='+a.slug,formatDate:()=> '2026年10月7日',firstImage:a=>a.attachments?.find(f=>f.type.startsWith('image/')),
 deleteArticle:async id=>{window.testMutations.push(id);window.testWorks.find(a=>a.id===id).deleted_at='2026-10-07'},
 restoreArticle:async id=>{if(window.failRestore)throw new Error('恢复失败样本');Object.assign(window.testWorks.find(a=>a.id===id),{deleted_at:null,published:false})},
 updateCommentApproval:async(id,approved)=>{window.testComments.find(c=>c.id===id).approved=approved},
 publishArticle:async a=>{const result={...a,id:'new',updated_at:'2026-10-07'};window.testWorks.push(result);return result},
 updateArticle:async(id,a)=>{Object.assign(window.testWorks.find(w=>w.id===id),a);return window.testWorks.find(w=>w.id===id)},
 removeFiles:async()=>{},removeVideo:async()=>{}
};`;

(async () => {
 await fs.mkdir(out, {recursive:true});
 const browser = await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 try {
  for (const width of [1440, 1024, 768, 390, 320]) {
   const context=await browser.newContext({viewport:{width,height:1000},serviceWorkers:'block',reducedMotion:'reduce',timezoneId:'Asia/Shanghai'});
   await context.route('**/*', async route=>{
    const url=new URL(route.request().url());
    if(url.origin!==origin)return route.abort();
    if(url.pathname==='/article-service.js')return route.fulfill({contentType:'text/javascript',body:service});
    if(url.pathname==='/supabase-config.js')return route.fulfill({contentType:'text/javascript',body:'window.BLOG_CONFIG={};'});
    const file=path.resolve(root,'.'+decodeURIComponent(url.pathname));
    if(!file.startsWith(root+path.sep))return route.abort();
    const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.webp':'image/webp','.woff2':'font/woff2'};
    try {await route.fulfill({body:await fs.readFile(file),contentType:mime[path.extname(file)]||'application/octet-stream'});}catch{await route.fulfill({status:404,body:''});}
   });
   const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto(origin+'/admin.html');
   await page.locator('#editorPanel').waitFor();
   await page.locator('[data-admin-target="worksPanel"]').click();
   await page.locator('.admin-article-row').first().waitFor();
   await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));
   await page.evaluate(()=>document.documentElement.setAttribute('data-theme','dark'));
   await page.screenshot({path:path.join(out,`${width}-${process.env.BASELINE?'before':'works-dark'}.png`),fullPage:true});
   if (!process.env.BASELINE && width===1440) await page.screenshot({path:path.join(out,'desktop-preview.png')});
   const bounds=await page.locator('#worksPanel button, #worksPanel input:not(.native-select-hidden), #worksPanel .animated-select').evaluateAll(es=>es.filter(e=>e.getBoundingClientRect().width).map(e=>({text:e.textContent||e.id,x:e.getBoundingClientRect().left,right:e.getBoundingClientRect().right,width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height})));
   assert(bounds.every(b=>b.x>=0&&b.right<=width+1),JSON.stringify(bounds.filter(b=>b.x<0||b.right>width+1)));
   assert(bounds.filter(b=>b.text==='全选当前结果'||b.text==='取消全选').every(b=>b.height<65),'Selection buttons must remain horizontal');
   if(process.env.BASELINE)continue;
   await page.locator('[data-select-id="adminCategoryFilter"] .animated-select__trigger').click();
   await page.getByRole('option',{name:/数学/}).click();
   assert.equal(await page.locator('.admin-article-row').count(),2);
   await page.locator('#resetWorkFilters').click();
   await page.locator('#adminSeriesFilter').selectOption('数学课堂',{force:true});
   assert.equal(await page.locator('.admin-article-row').count(),1);
   await page.locator('#resetWorkFilters').click();
   await page.locator('[data-work-filter="video"]').click();
   await page.waitForFunction(()=>document.querySelectorAll('.admin-article-row').length===2);
   await page.locator('#selectVisibleWorks').click();
   assert.equal(await page.locator('#selectedWorkCount').textContent(),'已选 2 项');
   await page.locator('#adminWorkSearch').fill('三角');
   await page.waitForFunction(()=>document.querySelectorAll('.admin-article-row').length===1);
   assert.equal(await page.locator('#selectedWorkCount').textContent(),'已选 1 项');
   await page.locator('#bulkTrashButton').click();
   await page.locator('dialog button[value="cancel"]').click();
   assert.equal(await page.evaluate(()=>window.testMutations.length),0);
   await page.locator('#bulkTrashButton').click();
   await page.locator('dialog button[value="ok"]').click();
   await page.waitForFunction(()=>window.testMutations.length===1&&document.querySelector('#bulkTrashButton').disabled);
   assert.deepEqual(await page.evaluate(()=>window.testMutations),['1']);
   await page.locator('[data-work-filter="trash"]').click();
   await page.locator('#resetWorkFilters').click();
   await page.waitForFunction(()=>document.querySelectorAll('.admin-article-row').length===2);
   await page.locator('#adminWorkSearch').fill('旧版');
   await page.waitForFunction(()=>document.querySelectorAll('.admin-article-row').length===1);
   assert.match(await page.locator('#adminArticleList').innerText(),/旧版笔记/);
   await page.evaluate(()=>window.failRestore=true);
   await page.getByRole('button',{name:'恢复',exact:true}).click();
   await page.waitForFunction(()=>document.querySelector('#adminStatus').textContent.includes('恢复失败样本'));
   assert(await page.getByRole('button',{name:'恢复',exact:true}).isEnabled());
   await page.evaluate(()=>window.failRestore=false);
   await page.getByRole('button',{name:'恢复',exact:true}).click();
   await page.waitForFunction(()=>!window.testWorks.find(w=>w.id==='6').deleted_at);
   await page.locator('[data-work-filter="all"]').click();
   await page.locator('#resetWorkFilters').click();
   await page.locator('#adminStatusFilter').selectOption('draft',{force:true});
   await page.waitForFunction(()=>document.querySelectorAll('.admin-article-row').length===3);
   await page.locator('#adminStatusFilter').selectOption('scheduled',{force:true});
   await page.waitForFunction(()=>document.querySelectorAll('.admin-article-row').length===1);
   assert.match(await page.locator('#adminArticleList').innerText(),/定时发布/);
   await page.locator('#adminArticleList .edit-work').click();
   assert.equal(await page.locator('[name="scheduledAt"]').inputValue(),'2099-01-01T08:00');
   await page.locator('.publish-button').click();
   await page.waitForFunction(()=>!savingWork&&document.querySelector('#worksPanel').classList.contains('active'));
   assert.equal(await page.evaluate(()=>window.testWorks.find(w=>w.id==='4').scheduled_at),'2099-01-01T00:00:00.000Z');
   await page.locator('#resetWorkFilters').click();
   await page.evaluate(()=>document.documentElement.setAttribute('data-theme','light'));
   await page.evaluate(()=>{window.scrollTo({top:0,behavior:'instant'});document.querySelector('#adminStatus').textContent='';});
   await page.screenshot({path:path.join(out,`${width}-works-light.png`),fullPage:true});
   await page.locator('[data-new-work="article"]').filter({visible:true}).first().click();
   await page.locator('[name="title"]').fill('新文章');await page.locator('[name="slug"]').fill('new-article');
   await page.locator('[name="excerpt"]').fill('新文章摘要');await page.locator('[name="content"]').fill('## 标题\n\n测试正文');
   await page.locator('#saveDraftButton').click();
   await page.waitForFunction(()=>window.testWorks.some(w=>w.id==='new')&&!savingWork);
   assert.equal(await page.evaluate(()=>window.testWorks.find(w=>w.id==='new').published),false);
   assert.equal(new URL(page.url()).pathname,'/admin.html');
   await page.locator('[data-admin-target="editorWorkPanel"]').click();
   await page.evaluate(()=>{window.scrollTo({top:0,behavior:'instant'});document.querySelector('#adminStatus').textContent='';});
   await page.screenshot({path:path.join(out,`${width}-editor.png`),fullPage:true});
   const editorBounds=await page.locator('#editorWorkPanel button, #editorWorkPanel input:not(.native-select-hidden), #editorWorkPanel textarea').evaluateAll(es=>es.filter(e=>e.getBoundingClientRect().width).map(e=>e.getBoundingClientRect().right));
   assert(editorBounds.every(right=>right<=width+1),'Editor controls must fit the viewport');
   await page.locator('[data-admin-target="interactionPanel"]').click();
   await page.getByRole('button',{name:'通过',exact:true}).click();
   await page.waitForFunction(()=>window.testComments[0].approved);
   assert.deepEqual(errors,[]);
   console.log(`PASS ${width}px: bounds, filters, selection scope, cancel/trash/restore, drafts, moderation, no JS errors`);
   await context.close();
  }
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
