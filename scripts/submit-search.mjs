// Run only after verified production deployment, never from browser code.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { origin } from './build-seo.mjs';
const manifest = JSON.parse(await readFile('_deploy/seo-manifest.json','utf8'));
const statePath = '.seo-submit/state.json';
let state = {}; try { state = JSON.parse(await readFile(statePath,'utf8')); } catch (e) { if(e.code!=='ENOENT') throw e; }
await mkdir('.seo-submit',{recursive:true});
async function post(url,options) {
  for (let n=0;n<3;n++) {
    let response;
    try { response = await fetch(url,{...options,redirect:'error',signal:AbortSignal.timeout(30000)}); }
    catch (error) {
      if(n===2) {
        const code = error.cause?.code || error.name;
        const safeCode = /^[A-Z_a-z0-9]+$/.test(code || '') ? code : 'UNKNOWN';
        throw new Error(`Search submission network failure (${new URL(url).hostname}: ${safeCode})`);
      }
    }
    if (response && response.status!==429 && response.status<500) return response;
    if(n<2) await new Promise(r=>setTimeout(r,2000*2**n));
  }
  throw new Error('Search submission retry budget exhausted');
}
for (const provider of ['indexnow','baidu']) {
  const key = process.env[provider==='indexnow'?'INDEXNOW_KEY':'BAIDU_PUSH_TOKEN'] || (provider==='indexnow' ? (await readFile('.github/indexnow-key.txt','utf8').catch(() => '')).trim() : '');
  if (!key) { console.log(`${provider}: not configured; skipped`); continue; }
  const changed = manifest.filter(a=>state[provider]?.[a.url]!==a.hash);
  for (let i=0;i<changed.length;i+=100) {
    const batch=changed.slice(i,i+100);
    for (const a of batch) {
      if(new URL(a.url).origin!==origin || !/^article--[a-zA-Z0-9_-]+\.html$/.test(a.file)) throw new Error('Invalid submission URL');
      const r=await fetch(a.url,{redirect:'manual',signal:AbortSignal.timeout(20000),headers:{'cache-control':'no-cache'}});
      const html=await r.text();
      const {createHash}=await import('node:crypto');
      if(r.status!==200 || /name="robots"[^>]*noindex/i.test(html) || createHash('sha256').update(html).digest('hex')!==a.hash) throw new Error('Public page not current; no submission');
    }
    let r;
    if(provider==='indexnow') {
      if(!/^[a-zA-Z0-9-]{8,128}$/.test(key)) throw new Error('Invalid IndexNow key');
      const verification=await fetch(`${origin}/${key}.txt`,{signal:AbortSignal.timeout(15000)});
      if(!verification.ok || (await verification.text()).trim()!==key) throw new Error('IndexNow verification file unavailable');
      r=await post('https://api.indexnow.org/indexnow',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({host:'joestarzhang.cn',key,keyLocation:`${origin}/${key}.txt`,urlList:batch.map(a=>a.url)})});
      if(r.status===202) {
        console.log('IndexNow: HTTP 202; ownership verification pending, no receipt recorded; retry on next scheduled deployment');
        continue;
      }
      if(r.status!==200) throw new Error(`IndexNow HTTP ${r.status}; failed batch remains retryable`);
    } else {
      // Baidu's documented endpoint is HTTP; HTTPS fails hostname verification.
      // Keep the credential server-side and reject redirects in post().
      // Baidu expects the literal scheme and slashes of the fixed site origin.
      r=await post(`http://data.zz.baidu.com/urls?site=${origin}&token=${encodeURIComponent(key)}`,{method:'POST',headers:{'content-type':'text/plain'},body:batch.map(a=>a.url).join('\n')});
      const result=await r.json();
      const message = typeof result.message === 'string'
        ? result.message.replaceAll(key, '[REDACTED]').replace(/token=[^&\s"'<>]+/gi, 'token=[REDACTED]').slice(0, 200) : undefined;
      const count = value => Number.isInteger(value) ? value : null;
      const feedback = { http: r.status, requested: batch.length, success: count(result.success), remain: count(result.remain), error: count(result.error), message,
        not_same_site: Array.isArray(result.not_same_site) ? result.not_same_site.length : 0,
        not_valid: Array.isArray(result.not_valid) ? result.not_valid.length : 0 };
      console.log(`baidu: response ${JSON.stringify(feedback)}`);
      if(!r.ok || result.error || result.success!==batch.length) throw new Error('Baidu batch incomplete; see sanitized response above; no receipt recorded');
    }
    state[provider] ||= {}; for(const a of batch) state[provider][a.url]=a.hash;
    await writeFile(statePath,JSON.stringify(state));
    console.log(`${provider}: received ${batch.length} URLs (not proof of indexing)`);
  }
}
