export async function listAllRemote(hosting) {
  const files = [];
  let marker = '';
  for (;;) {
    // listFiles() starts at '/', hiding .nojekyll. Explicit pagination includes all keys.
    const page = await hosting.findFiles({ prefix: '', marker, maxKeys: 1000 });
    files.push(...(page.Contents || []));
    if (page.IsTruncated !== true && page.IsTruncated !== 'true') return files;
    const next = page.NextMarker || page.Contents?.at(-1)?.Key;
    if (!next || next === marker) throw new Error('CloudBase returned an invalid pagination marker');
    marker = next;
  }
}

export function matches(local, remote) {
  if (!remote || Number(remote.Size) !== local.size) return false;
  const etag = String(remote.ETag).replace(/^"|"$/g, '').toLowerCase();
  return etag === local.md5 || Boolean(local.multipart?.includes(etag));
}

export function partition(local, remote) {
  const byKey = new Map(remote.map(file => [file.Key, file]));
  const changed = local.filter(file => !matches(file, byKey.get(file.key)));
  return {
    assets: changed.filter(file => !isEntry(file.key)),
    entries: changed.filter(file => isEntry(file.key) && file.key !== 'deployment.json'),
    marker: changed.filter(file => file.key === 'deployment.json'),
    skipped: local.length - changed.length,
  };
}

function isEntry(key) {
  return key.endsWith('.html') || key === 'service-worker.js' || key === 'deployment.json';
}

export function verify(local, remote) {
  const byKey = new Map(remote.map(file => [file.Key, file]));
  const failed = local.filter(file => !matches(file, byKey.get(file.key))).map(file => file.key);
  if (failed.length) throw new Error(`Remote MD5 verification failed: ${failed.join(', ')}`);
}

export async function publish(local, hosting, report = console.log) {
  const plan = partition(local, await hosting.listFiles());
  report(`Unchanged: ${plan.skipped}; assets: ${plan.assets.length}; entries: ${plan.entries.length}`);
  async function upload(files, phase) {
    // Small groups bound work in flight; the transport limits concurrent files to three.
    for (let start = 0; start < files.length; start += 10) {
      const batch = files.slice(start, start + 10);
      report(`${phase}: ${start + 1}-${start + batch.length}/${files.length}`);
      await hosting.uploadFiles({
        files: batch.map(file => ({ localPath: file.path, cloudPath: file.key })),
        parallel: 1, retryCount: 3, retryInterval: 2000,
      });
    }
  }
  await upload(plan.assets, 'Resources');
  await upload(plan.entries, 'Pages');
  // Keep the release marker untouched until every application file is verified.
  await verify(local.filter(file => file.key !== 'deployment.json'), await hosting.listFiles());
  await upload(plan.marker, 'Revision');
  verify(local, await hosting.listFiles());
  report(`Verified ${local.length} files by size and MD5.`);
  return plan;
}
import { createHash } from 'node:crypto';

export function multipartEtags(bytes) {
  const etags = [];
  // Common COS slice sizes; comparison still verifies every byte, never size alone.
  for (const size of [1, 2, 3, 4, 5, 8, 10, 16, 32, 64].map(mib => mib * 1024 * 1024)) {
    if (size >= bytes.length) continue;
    const hashes = [];
    for (let start = 0; start < bytes.length; start += size) {
      hashes.push(createHash('md5').update(bytes.subarray(start, start + size)).digest());
    }
    etags.push(`${createHash('md5').update(Buffer.concat(hashes)).digest('hex')}-${hashes.length}`);
  }
  return etags;
}
