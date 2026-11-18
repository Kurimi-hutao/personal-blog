import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, copyFile } from 'node:fs/promises';
import path from 'node:path';
import { buildSEO, publicRows, filename, json } from './build-seo.mjs';
test('public visibility excludes drafts, deleted and scheduled content',()=>{
 const a={slug:'public',title:'Public',published:true};
 assert.equal(publicRows([a,{...a,slug:'draft',published:false},{...a,slug:'deleted',deleted_at:'2026-01-01'},{...a,slug:'scheduled',scheduled_at:'2999-01-01'}]).length,1);
 assert.throws(()=>publicRows([a,a]));
 assert(!json({text:'</script><script>alert(1)</script>'}).includes('<'));
 assert(!filename('../a').includes('/'));
});
test('SSG emits crawlable titles, bodies, links and consistent metadata',async()=>{
 const root=process.cwd(), output=await mkdtemp(path.join(root,'outputs/seo-test-'));
 for(const file of ['index.html','articles.html','videos.html','article-service.js']) await copyFile(path.join(root,file),path.join(output,file));
 const rows=[{id:'test',slug:'ai-from-zero-lesson-test',title:'Test <title>',excerpt:'Unique excerpt',content:'## Section\n\nReal body <script>evil</script>',published:true,published_at:'2026-01-01T00:00:00Z',content_type:'article'}];
 const [entry]=await buildSEO({root,output,rows,previous:[{slug:'withdrawn',file:'article--withdrawn.html'}]});
 const withdrawn=await readFile(path.join(output,'article--withdrawn.html'),'utf8');
 assert(withdrawn.includes('noindex')); assert(!withdrawn.includes('Real body'));
 const html=await readFile(path.join(output,entry.file),'utf8');
 assert(html.includes('Real body &lt;script&gt;'));
 assert.equal((html.match(/rel="canonical"/g)||[]).length,1);
 assert.equal((html.match(/property="og:type"/g)||[]).length,1);
 const schema=JSON.parse(html.match(/type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
 assert.equal(schema.headline,rows[0].title); assert.equal(schema.url,entry.url);
 for(const f of ['index.html','articles.html']) assert((await readFile(path.join(output,f),'utf8')).includes(entry.file));
 assert((await readFile(path.join(output,'sitemap.xml'),'utf8')).includes(entry.url));
 const home = await readFile(path.join(output,'index.html'),'utf8');
 assert(!home.includes('文章正在路上') && !home.includes('去文章页继续阅读'), 'No template cards survive SSG');
 assert(!home.includes('视频正在整理中'), 'Video feed is also prerendered');
});

test('prerendered video cards and metadata use the matching site-hosted cover', async () => {
  const root = process.cwd();
  const output = await mkdtemp(path.join(root, 'outputs/seo-test-'));
  for (const file of ['index.html', 'articles.html', 'videos.html', 'article-service.js']) {
    await copyFile(path.join(root, file), path.join(output, file));
  }
  const row = {
    id: 'newton', slug: 'isaac-newton-bilibili-video', title: 'Isaac Newton',
    content_type: 'video', published: true, published_at: '2026-10-19T09:00:00Z',
    video_url: 'https://www.bilibili.com/video/BV1V2J16ME7Z/',
    video_poster: 'https://uhcmzlhzrgyjnvqnnpss.supabase.co/storage/v1/object/public/article-attachments/bilibili-covers/BV1V2J16ME7Z.jpg',
  };
  const image = source => 'src="' + source + '"';
  const local = 'https://joestarzhang.cn/assets/video-covers/isaac-newton-bilibili-video.webp';
  const [entry] = await buildSEO({ root, output, rows: [row] });
  for (const file of ['index.html', 'videos.html']) {
    assert((await readFile(path.join(output, file), 'utf8')).includes(image(local)));
  }
  const detail = await readFile(path.join(output, entry.file), 'utf8');
  assert(detail.includes('property="og:image" content="' + local + '"'));
  const alternate = 'https://cdn.example.org/replacement.jpg';
  await buildSEO({ root, output, rows: [{ ...row, video_poster: alternate }] });
  for (const file of ['index.html', 'videos.html']) {
    const html = await readFile(path.join(output, file), 'utf8');
    assert(html.includes(image(alternate)));
    assert(!html.includes(image(local)));
  }
});
