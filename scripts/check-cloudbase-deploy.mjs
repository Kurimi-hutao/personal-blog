import test from 'node:test';
import assert from 'node:assert/strict';
import { matches, partition, publish } from './cloudbase-deploy-lib.mjs';

const file = (key, md5 = 'a'.repeat(32)) => ({ key, path: key, size: 20, md5 });
const remote = local => local.map(f => ({ Key: f.key, Size: String(f.size), ETag: `"${f.md5}"` }));
test('skip only identical MD5 and size; reject same-size edits and multipart ETags', () => {
  const a = file('image.png');
  assert(matches(a, remote([a])[0]));
  assert(!matches(a, { ...remote([a])[0], ETag: 'b'.repeat(32) }));
  assert(!matches(a, { ...remote([a])[0], ETag: a.md5 + '-2' }));
  assert(!matches(a, { ...remote([a])[0], Size: '21' }));
  assert(!matches(a));
  assert.equal(partition([a], remote([a])).skipped, 1);
});
test('resources before pages, verify all files, then publish revision marker', async () => {
  const local = [file('deployment.json'), file('pet.html'), file('service-worker.js'), file('assets/a.png')];
  let stored = [], calls = [];
  const hosting = {
    listFiles: async () => { calls.push('verify'); return stored; },
    uploadFiles: async ({ files }) => {
      calls.push(...files.map(f => f.cloudPath));
      stored.push(...remote(local.filter(f => files.some(upload => upload.cloudPath === f.key))));
    },
  };
  await publish(local, hosting, () => {});
  assert.deepEqual(calls, ['verify', 'assets/a.png', 'pet.html', 'service-worker.js', 'verify', 'deployment.json', 'verify']);
});
test('failed asset upload or failed verification must not publish release marker', async () => {
  const local = [file('assets/a.png'), file('deployment.json')];
  for (const failUpload of [true, false]) {
    const uploaded = [];
    await assert.rejects(publish(local, {
      listFiles: async () => [],
      uploadFiles: async ({ files }) => {
        uploaded.push(...files.map(f => f.cloudPath));
        if (failUpload) throw new Error('socket hang up');
      },
    }, () => {}));
    assert(!uploaded.includes('deployment.json'));
  }
});
