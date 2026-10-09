import { createHash } from 'node:crypto';
import { readdir, readFile, appendFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { publish } from './cloudbase-deploy-lib.mjs';

for (const name of ['TCB_ENV_ID', 'TCB_SECRET_ID', 'TCB_SECRET_KEY']) {
  if (!process.env[name]?.trim()) throw new Error(`Missing GitHub Secret: ${name}`);
}
process.env.COS_SDK_KEEPALIVE = 'false';
process.env.COS_UPLOAD_SERIAL = 'true';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(root, '.cloudbase-tools', 'package.json'));
const CloudBase = require('@cloudbase/manager-node');
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
const plan = await publish(files, app.hosting);
const message = `CloudBase deployed and verified ${files.length} files; skipped ${plan.skipped} unchanged files. Revision: ${process.env.GITHUB_SHA || 'local'}`;
console.log(message);
if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, message + '\n');
