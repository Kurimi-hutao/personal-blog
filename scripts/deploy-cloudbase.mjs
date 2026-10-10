import { createHash } from 'node:crypto';
import { readdir, readFile, appendFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { publish, listAllRemote, matches } from './cloudbase-deploy-lib.mjs';
import { createUploader, createCRCReader } from './cloudbase-upload.mjs';
import { crc64Cos as crc64 } from './cloudbase-crc64.mjs';

for (const name of ['TCB_ENV_ID', 'TCB_SECRET_ID', 'TCB_SECRET_KEY']) {
  if (!process.env[name]?.trim()) throw new Error(`Missing GitHub Secret: ${name}`);
}
process.env.COS_SDK_KEEPALIVE = 'false';
process.env.COS_UPLOAD_SERIAL = 'true';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(root, '.cloudbase-tools', 'package.json'));
const CloudBase = require('@cloudbase/manager-node');
const sdkRequire = createRequire(require.resolve('@cloudbase/manager-node'));
const COS = sdkRequire('cos-nodejs-sdk-v5');
const mime = sdkRequire('mime-types');
// Reuse the pinned SDK's shared-bucket mapping to keep environment prefixes intact.
const { resolveBucketConfig, toPhysicalKey } = sdkRequire('./utils/storage-config.js');
const app = CloudBase.init({
  envId: process.env.TCB_ENV_ID.trim(),
  secretId: process.env.TCB_SECRET_ID.trim(),
  secretKey: process.env.TCB_SECRET_KEY.trim(),
});
const files = [];
async function walk(relative = '') {
  for (const entry of await readdir(path.join(root, '_deploy', relative), { withFileTypes: true })) {
    const key = path.posix.join(relative, entry.name);
    if (entry.isDirectory()) await walk(key);
    else if (entry.isFile()) {
      const filePath = path.join(root, '_deploy', key);
      const bytes = await readFile(filePath);
      files.push({ key, path: filePath, size: bytes.length, md5: createHash('md5').update(bytes).digest('hex') });
    } else throw new Error(`Unexpected deployment entry: ${key}`);
  }
}
await walk();
const hosting = app.hosting;
const [website] = await hosting.getInfo();
if (!website || website.Status !== 'online') throw new Error('CloudBase static hosting is not online');
const config = resolveBucketConfig({
  envId: process.env.TCB_ENV_ID.trim(), bucket: website.Bucket,
  region: website.Regoin || website.Region, externalStorage: website.ExternalStorage,
});
const credentials = {
  SecretId: process.env.TCB_SECRET_ID.trim(), SecretKey: process.env.TCB_SECRET_KEY.trim(),
};
const uploadFiles = createUploader({ COS, mime, config, toPhysicalKey, credentials });
const readCRC = createCRCReader({ COS, config, toPhysicalKey, credentials });
const localByKey = new Map(files.map(file => [file.key, file]));
async function listVerifiedFiles() {
  const remote = await listAllRemote(hosting);
  const candidates = remote.filter(item => {
    const local = localByKey.get(item.Key);
    return local && Number(item.Size) === local.size && !matches(local, item);
  });
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(4, candidates.length) }, async () => {
    while (next < candidates.length) {
      const item = candidates[next++];
      const local = localByKey.get(item.Key);
      if (!local.crc64) local.crc64 = crc64(await readFile(local.path));
      item.CRC64 = await readCRC(item.Key);
    }
  }));
  console.log(`Checked remote CRC64 for ${candidates.length} non-MD5 objects.`);
  return remote;
}
const plan = await publish(files, {
  listFiles: listVerifiedFiles,
  uploadFiles,
});
const message = `CloudBase deployed and verified ${files.length} files; skipped ${plan.skipped} unchanged files. Revision: ${process.env.GITHUB_SHA || 'local'}`;
console.log(message);
if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, message + '\n');

// Check the public gateway separately from COS object verification. Gateway caches
// can lag behind a successful upload, so report their state without re-uploading.
try {
  const routing = await app.env.describeHttpServiceRoute({
    EnvId: process.env.TCB_ENV_ID.trim(),
    Filters: [{ Name: 'Domain', Values: ['joestarzhang.cn'] }],
  });
  for (const domain of routing.Domains || []) {
    // The custom domain was bound to the old manual-upload directory. This
    // workflow publishes at the hosting root; reconcile only that known route.
    const oldRoot = (domain.Routes || []).find(route => route.Path === '/' &&
      route.UpstreamResourceType === 'STATIC_STORE' && route.Enable &&
      route.PathRewrite?.Prefix === '/personal-blog' && !route.PathRewrite?.StaticStorePrefix);
    if (domain.Domain === 'joestarzhang.cn' && domain.AccessType === 'DIRECT' && oldRoot) {
      const { Path, UpstreamResourceType, UpstreamResourceName, EnableSafeDomain,
        EnableAuth, EnablePathTransmission, QPSPolicy, Extension, Enable } = oldRoot;
      await app.env.modifyHttpServiceRoute({
        EnvId: process.env.TCB_ENV_ID.trim(),
        Domain: { Domain: domain.Domain, Routes: [{
          Path, UpstreamResourceType, UpstreamResourceName, EnableSafeDomain,
          EnableAuth, EnablePathTransmission, QPSPolicy, Extension, Enable,
          PathRewrite: { ...oldRoot.PathRewrite, Prefix: '/' },
        }] },
      });
      oldRoot.PathRewrite.Prefix = '/';
      console.log('Public custom root route updated to verified hosting root.');
    }
    console.log('Public custom routing:', JSON.stringify({
      domain: domain.Domain, access: domain.AccessType, status: domain.Status,
      routes: (domain.Routes || []).map(route => ({
        path: route.Path, type: route.UpstreamResourceType,
        rewrite: route.PathRewrite, enabled: route.Enable,
      })),
    }));
    if (['CDN', 'EO'].includes(domain.AccessType)) {
      const task = await app.env.purgeHttpServiceCache({
        EnvId: process.env.TCB_ENV_ID.trim(), Domain: domain.Domain,
        CacheType: domain.AccessType, PurgeType: 'PURGE_HOST', Targets: [domain.Domain],
      });
      console.log(`Public custom cache refresh submitted: ${task.TaskId}`);
    }
  }
} catch (error) {
  console.log(`Public custom routing check unavailable (${error.code || error.name})`);
}
for (const [label, domain] of [['hosting', website.CdnDomain], ['custom', 'joestarzhang.cn']]) {
  if (!domain) continue;
  try {
    const origin = /^https?:\/\//.test(domain) ? domain : `https://${domain}`;
    const response = await fetch(new URL('/article-service.js', origin), {
      signal: AbortSignal.timeout(15000), headers: { 'cache-control': 'no-cache' },
    });
    const current = response.ok && (await response.text()).includes('__hutao_comment');
    console.log(`Public ${label} comment service: HTTP ${response.status}, current=${current}`);
  } catch (error) {
    console.log(`Public ${label} comment service: check unavailable (${error.name})`);
  }
}
