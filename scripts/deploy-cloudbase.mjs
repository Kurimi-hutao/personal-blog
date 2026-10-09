import { createHash } from 'node:crypto';
import { readdir, readFile, appendFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { publish, listAllRemote } from './cloudbase-deploy-lib.mjs';
import { createUploader } from './cloudbase-upload.mjs';

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
const uploadFiles = createUploader({ COS, mime, config, toPhysicalKey, credentials: {
  SecretId: process.env.TCB_SECRET_ID.trim(), SecretKey: process.env.TCB_SECRET_KEY.trim(),
} });
const plan = await publish(files, {
  listFiles: () => listAllRemote(hosting),
  uploadFiles,
});
const message = `CloudBase deployed and verified ${files.length} files; skipped ${plan.skipped} unchanged files. Revision: ${process.env.GITHUB_SHA || 'local'}`;
console.log(message);
if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, message + '\n');
