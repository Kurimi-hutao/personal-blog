import { replaceSlot } from './html-slots.mjs';
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { webcrypto, createHash } from 'node:crypto';
export const origin = 'https://joestarzhang.cn';
export const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const json = value => JSON.stringify(value).replace(/</g, '\\u003c');
export const filename = slug => `article--${/^[a-z0-9_-]+$/i.test(slug) ? slug : Buffer.from(slug).toString('hex')}.html`;
export function publicRows(rows, now = Date.now()) {
  const seen = new Set();
  return rows.filter(a => a.published === true && !a.deleted_at && (!a.scheduled_at || Date.parse(a.scheduled_at) <= now)).map(a => {
    if (!a.slug || !a.title || seen.has(a.slug)) throw new Error('Missing or duplicate public slug/title');
    seen.add(a.slug); return a;
  });
}
export async function fetchPublished(root) {
  const ctx = {window:{}};
  vm.runInNewContext(await readFile(path.join(root,'supabase-config.js'),'utf8'),ctx);
  const c = ctx.window.BLOG_CONFIG, rows = [];
  // Keyset pagination works even when the project caps each response below 1000.
  let last = '';
  for (;;) {
    const u = new URL('/rest/v1/articles',c.supabaseUrl);
    u.search = new URLSearchParams({select:'id,slug,title,excerpt,content,attachments,category,tags,published_at,updated_at,content_type,video_url,video_poster,published,deleted_at,scheduled_at',published:'eq.true',deleted_at:'is.null',or:`(scheduled_at.is.null,scheduled_at.lte.${new Date().toISOString()})`,order:'id.asc',limit:'500',...(last?{id:`gt.${last}`}:{})});
    const r = await fetch(u,{headers:{apikey:c.supabaseAnonKey},signal:AbortSignal.timeout(30000)});
    if (!r.ok) throw new Error(`Public content read failed: HTTP ${r.status}`);
    const batch = await r.json(); if (!Array.isArray(batch)) throw new Error('Invalid public content response');
    if (!batch.length) break;
    rows.push(...batch); const next = batch.at(-1).id;
    if (!next || next === last) throw new Error('Invalid content pagination'); last = next;
  }
  if (!rows.length) throw new Error('Empty public content: refuse to replace sitemap');
  return rows;
}
export async function buildSEO({root,output,rows,previous=[]}) {
  rows = publicRows(rows).sort((a,b) => String(b.published_at).localeCompare(String(a.published_at)));
  const ctx = {window:{},crypto:webcrypto,TextEncoder,URL,document:{currentScript:{src:origin+'/article-service.js'}}}; vm.createContext(ctx);
  for (const file of ['markdown.js','article-content-repairs.js','article-service.js']) vm.runInContext(await readFile(path.join(root,file),'utf8'),ctx);
  rows = await Promise.all(rows.map(a => ctx.window.ArticleContentRepairs.prepare(a)));
  const template = await readFile(path.join(root,'article.html'),'utf8');
  await mkdir(output,{recursive:true});
  const feed = rows.map(({content, ...a}) => a);
  const routes = Object.fromEntries(rows.map(a=>[a.slug,`./${filename(a.slug)}`]));
  const link = a => `<a href="${escape(routes[a.slug])}">${escape(a.title)}</a>`;
  const manifest = [];
  // CloudBase uploads are additive. Explicitly overwrite withdrawn managed pages
  // so deleted/draft content cannot survive in an old object on the public host.
  for (const old of previous) {
    if (routes[old.slug]) continue;
    if (!/^article--[a-zA-Z0-9_-]+\.html$/.test(old.file)) throw new Error('Invalid previous SEO manifest');
    await writeFile(path.join(output,old.file),'<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="robots" content="noindex, follow"><title>此卷已撤下</title></head><body><h1>此卷已撤下</h1><a href="/articles.html">返回文章目录</a></body></html>');
  }
  for (const a of rows) {
    const url = `${origin}/${filename(a.slug)}`;
    const description = (a.excerpt || `${a.title}：${a.content || ''}`).replace(/\s+/g,' ').slice(0,160);
    const localPoster = a.content_type==='video' ? ctx.window.articleService.videoCoverCopy(a) : null;
    const cover = ctx.window.articleService.designatedCover(a);
    const image = localPoster || cover?.url || a.video_poster || `${origin}/assets/ink-hero.webp`;
    const lead = a.content_type !== 'video' && cover && !(a.attachments || []).some(file => file.url === cover.url)
      ? `<figure class="article-lead-cover"><img src="${escape(cover.url)}" alt="" width="1600" height="900" decoding="async"></figure>`
      : '';
    const related = rows.filter(b=>b.slug!==a.slug && (a.slug.startsWith('ai-from-zero-lesson-') ? b.slug.startsWith('ai-from-zero-lesson-') : b.category===a.category)).sort((a,b)=>a.slug.localeCompare(b.slug));
    const safeFiles = (a.attachments || []).filter(f => /^https?:\/\//.test(f.url));
    const attachments = safeFiles.map(f => f.type?.startsWith('image/') ? `<figure><img src="${escape(f.url===a.video_poster && localPoster ? localPoster : f.url)}" alt="${escape(f.name)}" loading="lazy" style="max-width:100%;height:auto"></figure>` : `<p><a href="${escape(f.url)}">${escape(f.name || '附件')}</a></p>`).join('');
    const video = a.content_type==='video' && /^https?:\/\//.test(a.video_url || '') ? `<p><a href="${escape(a.video_url)}">观看：${escape(a.title)}</a></p>` : '';
    const body = `<header class="article-detail-header"><p class="eyebrow">${escape(a.category)}</p><h1>${escape(a.title)}</h1><time datetime="${escape(a.published_at)}">${escape(a.published_at?.slice(0,10))}</time><p class="article-detail-excerpt">${escape(a.excerpt)}</p></header>${lead}<div class="article-body">${video}${ctx.window.blogMarkdown.renderArticle(a.content || a.excerpt,a.title)}${attachments}</div>`;
    const schema = {'@context':'https://schema.org','@type':'Article',headline:a.title,description,url,mainEntityOfPage:url,author:{'@type':'Person',name:'虎桃不会振刀',url:origin+'/'},datePublished:a.published_at,dateModified:a.updated_at || a.published_at,image};
    let html = template.replace(/<noscript>[\s\S]*?<\/noscript>/g,'').replace(/<meta property="og:type"[^>]*>/g,'').replace(/<script src=/g,'<script defer src=').replace(/<title>[\s\S]*?<\/title>/,`<title>${escape(a.title)} | 虎桃不会振刀</title>`).replace(/<meta name="description"[^>]*>/,`<meta name="description" content="${escape(description)}">`);
    html = html.replace('</head>',`<link rel="canonical" href="${url}"><meta property="og:type" content="article"><meta property="og:title" content="${escape(a.title)}"><meta property="og:description" content="${escape(description)}"><meta property="og:url" content="${url}"><meta property="og:image" content="${escape(image)}"><script type="application/ld+json">${json(schema)}</script></head>`);
    html = replaceSlot(html, 'articleDetail',`<article id="articleDetail" data-static-slug="${escape(a.slug)}" aria-live="polite">${body}</article><nav class="article-attachments" aria-label="相关阅读"><h2>继续阅读</h2><p><a href="./articles.html">全部文章与课程</a></p>${related.map(b=>`<p>${link(b)}</p>`).join('')}</nav>`, {outer:true});
    await writeFile(path.join(output,filename(a.slug)),html);
    manifest.push({url,file:filename(a.slug),slug:a.slug,lastmod:a.updated_at||a.published_at,hash:createHash('sha256').update(html).digest('hex')});
  }
  for (const [file,id,items] of [['index.html','latestArticles',rows.filter(a=>a.content_type!=='video').slice(0,2)],['index.html','latestVideos',rows.filter(a=>a.content_type==='video').slice(0,2)],['articles.html','articleList',rows.filter(a=>a.content_type!=='video')],['videos.html','videoList',rows.filter(a=>a.content_type==='video')]]) {
    let html = await readFile(path.join(output,file),'utf8');
    const cards = items.map(a=> {
      const cover = ctx.window.articleService.articleCover(a).url;
      const poster = a.content_type==='video' ? ctx.window.articleService.videoCoverCopy(a) || a.video_poster : null;
      const img = `<img src="${escape(poster || cover)}" alt="" loading="lazy" decoding="async" width="640" height="360">`;
      if (id==='latestArticles') return `<article class="article-card"><div class="card-visual">${img}</div><div class="card-content"><div class="article-meta"><span>${escape(a.category)}</span><time>${escape(a.published_at?.slice(0,10))}</time></div><h3>${escape(a.title)}</h3><p>${escape(a.excerpt)}</p><a href="${escape(routes[a.slug])}">展开此卷 <span>→</span></a></div></article>`;
      if (id==='latestVideos') return `<a class="home-video-card" href="${escape(routes[a.slug])}"><div class="home-video-visual">${img}</div><div><small>${escape(a.category)}</small><h3>${escape(a.title)}</h3><p>${escape(a.excerpt)}</p></div></a>`;
      return `<a class="article-list-card" href="${escape(routes[a.slug])}"><div class="article-list-cover">${img}</div><div class="article-list-copy"><h2>${escape(a.title)}</h2><p>${escape(a.excerpt)}</p></div></a>`;
    }).join('') || '<p class="article-state">此处尚未落笔，先去<a href="./articles.html">别卷看看</a>。</p>';
    html = replaceSlot(html,id,cards).replace(`id="${id}"`, `id="${id}" data-prerendered="true"`);
    if (file==='index.html') {
      html = replaceSlot(html,'homeFeedSnapshot',json({savedAt:Date.now(),article:feed.filter(a=>a.content_type!=='video').slice(0,2),video:feed.filter(a=>a.content_type==='video').slice(0,2)}));
      html = replaceSlot(html,'courseList',rows.filter(a=>a.slug.startsWith('ai-from-zero-lesson-')).sort((a,b)=>a.slug.localeCompare(b.slug)).map(a=>`<p>${link(a)}</p>`).join(''));
    }
    await writeFile(path.join(output,file),html);
  }
  const service = await readFile(path.join(output,'article-service.js'),'utf8');
  await writeFile(path.join(output,'article-service.js'),`window.SEO_URLS=${json(routes)};window.SEO_FEED=${json(feed)};\n${service}`);
  const staticMap = await readFile(path.join(root,'sitemap.xml'),'utf8');
  const entries = manifest.map(a=>`<url><loc>${escape(a.url)}</loc>${a.lastmod?`<lastmod>${new Date(a.lastmod).toISOString()}</lastmod>`:''}</url>`).join('\n');
  await writeFile(path.join(output,'sitemap.xml'),staticMap.replace('</urlset>',entries+'\n</urlset>'));
  await writeFile(path.join(output,'seo-manifest.json'),JSON.stringify(manifest,null,2));
  const key = process.env.INDEXNOW_KEY || (await readFile(path.join(root, '.github/indexnow-key.txt'), 'utf8').catch(() => '')).trim();
  if (key) { if (!/^[a-zA-Z0-9-]{8,128}$/.test(key)) throw new Error('Invalid INDEXNOW_KEY'); await writeFile(path.join(output,`${key}.txt`),key); }
  const tracking = process.env.PLAUSIBLE_SCRIPT_URL;
  if (tracking) {
    const u = new URL(tracking);
    if (u.protocol !== 'https:' || u.username || u.password || u.search || u.hash) throw new Error('Use a public HTTPS Plausible script URL without credentials or query');
    for (const file of (await readdir(output)).filter(f=>f.endsWith('.html') && !/^(admin|reward|offline|404)\.html$/.test(f))) {
      const html = await readFile(path.join(output,file),'utf8');
      await writeFile(path.join(output,file),html.replace('</head>',`<script defer src="./analytics.js" data-source="${escape(u.href)}"></script></head>`));
    }
    // Hash the exact deployed bytes, including the configured analytics tag.
    for (const a of manifest) a.hash=createHash('sha256').update(await readFile(path.join(output,a.file))).digest('hex');
    await writeFile(path.join(output,'seo-manifest.json'),JSON.stringify(manifest,null,2));
  }
  console.log(`SEO: ${rows.length} public detail pages; ${rows.filter(a=>a.slug.startsWith('ai-from-zero-lesson-')).length} AI lessons`);
  return manifest;
}
