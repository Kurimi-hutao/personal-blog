const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {webcrypto}=require('node:crypto');
const ctx={window:{},crypto:webcrypto,TextEncoder,Uint8Array};vm.createContext(ctx);
for(const f of ['markdown.js','article-content-repairs.js'])vm.runInContext(fs.readFileSync(f,'utf8'),ctx);
const md=ctx.window.blogMarkdown;
test('only matching first title is removed',()=>{
 assert.equal(md.withoutDuplicateTitle('# Same title\n\n## Chapter','Same title'),'## Chapter');
 for(const text of ['# Another title\n','Intro\n# Same title','```\n# Same title\n```'])assert.equal(md.withoutDuplicateTitle(text,'Same title'),text);
});
test('exact lesson repair preserves code and valid future versions',async()=>{
 const a=JSON.parse(fs.readFileSync('scripts/fixtures/lesson-018-source-20261104.json','utf8'));
 const b=await ctx.window.ArticleContentRepairs.prepare(a);
 assert.notEqual(a.content,b.content);assert.match(b.content,/\\mathbb\{R\}/);assert.doesNotMatch(b.content,/[\x08\r]/);
 assert.deepEqual(b.content.match(/```[\s\S]*?```/g),a.content.match(/```[\s\S]*?```/g));
 const changed={...a,content:a.content+'\nUpdated'};assert.equal(await ctx.window.ArticleContentRepairs.prepare(changed),changed);
 assert.equal(await ctx.window.ArticleContentRepairs.prepare({...a,slug:'another'}).then(x=>x.content),a.content);
 const katex=require('../assets/vendor/katex/katex-0.16.22.min.js');
 const html=md.renderArticle(b.content,b.title);assert.doesNotMatch(html,/<h1/);
 for(const match of b.content.matchAll(/\\\[([\s\S]*?)\\\]|\\\(([\s\S]*?)\\\)/g))katex.renderToString(match[1]||match[2],{throwOnError:true,displayMode:!!match[1]});
});
