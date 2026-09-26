// Synthetic content is served only by the review browser, never by the website.
const content=['## 卷首 · 记一段山河','这是浏览器排版测试样本，不是公开文章。沿着山路走，纸上留下所见，也留下未说尽的故事。'.repeat(5),'## 行旅中的细节','> 风过山林，留下一行墨色。','### 代码与长行','```js','const path = "'+ 'long-path-segment/'.repeat(20)+'";','```','## 表格与公式','| 类别 | 说明 | 攻击 | 防御 | 元素 | 备注 |','| --- | --- | ---: | ---: | --- | --- |','| 测试 | 跨屏幕排版检查 | 128 | 256 | 冰 | 可横向滚动的表格 |','| 另卷 | 长内容应正常换行 | 64 | 128 | 电 | '+ '说明'.repeat(20)+' |','$$E = mc^2$$','## 卷尾 · 再逢','这是收尾内容。'.repeat(35)].join('\n\n').replace(/\|\n\n\|/g,'|\n|');
const records=Array.from({length:5},(_,i)=>({id:'review-'+i,slug:'review-'+i,title:['山行记：把聚窟洲的暮色写进一页纸里','未题封面的长卷：当一个标题跨过两行之后仍然需要保持清晰的阅读层次','风起山林，故人重逢','此间的慢时光','随记 · 拾一片落叶'][i],excerpt:'仅供本地视觉验收的测试内容。远山留白，近处落墨；记录游戏里的故事，也记住生活里慢下来的片刻。',content,category:i%2?'随笔':'永劫无间',tags:i%2?['生活']:['江湖','水墨'],published:true,published_at:'2026-09-20T12:00:00Z',created_at:'2026-09-20T12:00:00Z',view_count:128+i,like_count:8,favorite_count:2,content_type:'article',attachments:i===1?[]:[{url:'http://localhost:8000/assets/'+['ink-scroll.webp','ink-scroll.webp','kurumi-mountains.webp','kurumi-tiger.webp','ink-hero.webp'][i],type:'image/webp',name:'排版检查图'}]}));
const videos=records.slice(0,4).map((r,i)=>({...r,id:'video-'+i,slug:'video-'+i,content_type:'video',title:['一振入江湖 · 山河有回响','未题封面的录像','聚窟洲的傍晚与一场久别重逢：长标题排版样本','风起之前'][i],attachments:[],video_poster:i===1?'':i===3?'http://localhost:8000/review-missing-poster.webp':records[i].attachments[0]?.url,video_url:'',duration_seconds:127,series_name:'江湖记事',episode_number:i+1}));
async function installFixtures(context){
 let comments=[{id:'comment-review',article_id:'review-0',visitor_name:'本地验收',body:'测试评论，用于确认长文字、回复和按钮排版。'.repeat(4),created_at:'2026-09-20T12:00:00Z',attachments:[],like_count:2}];
 await context.route('**/rest/v1/**',async route=>{const req=route.request(),u=new URL(req.url());let data=[];
 if(u.pathname.endsWith('/articles')){let list=u.searchParams.get('content_type')==='eq.video'?videos:records;const slug=u.searchParams.get('slug');data=slug?[...records,...videos].find(r=>'eq.'+r.slug===slug):list;if(!data)data=null;}
 else if(u.pathname.endsWith('/comments')){if(req.method()==='POST'){const c={...JSON.parse(req.postData()),id:'new-review',created_at:new Date().toISOString(),like_count:0};comments.push(c);data=c}else data=comments;}
 else if(u.pathname.includes('toggle_'))data={active:true,count:9};
 else if(u.pathname.includes('/rpc/'))data=129;
 await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data),headers:{'access-control-allow-origin':'*'}});
 });
}
module.exports={installFixtures,records};
