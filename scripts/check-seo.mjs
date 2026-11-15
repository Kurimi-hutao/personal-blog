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
});
