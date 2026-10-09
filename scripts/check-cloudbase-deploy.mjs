import test from 'node:test';
import assert from 'node:assert/strict';
import { matches, partition, publish, listAllRemote } from './cloudbase-deploy-lib.mjs';
import { createUploader } from './cloudbase-upload.mjs';

test('upload uses a complete Buffer, explicit timeout, MIME and shared hosting prefix', async () => {
  let settings, request;
  class COS {
    constructor(options) { settings = options; }
    putObject(options, callback) { request = options; callback(null, {}); }
  }
  await createUploader({
    COS, credentials: {}, config: { bucket: 'test', region: 'test', basePath: 'site' },
    mime: { lookup: () => 'text/javascript' },
    toPhysicalKey: (prefix, key) => `${prefix}/${key}`, report: () => {},
  })({ files: [{ localPath: new URL('./cloudbase-upload.mjs', import.meta.url), cloudPath: 'app.js' }] });
  assert(Buffer.isBuffer(request.Body));
  assert.equal(request.ContentLength, request.Body.length);
  assert.equal(request.Key, 'site/app.js');
  assert.equal(request.ContentType, 'text/javascript');
  assert.equal(settings.Timeout, 60000);
  assert.equal(settings.Protocol, 'https:');
  assert.equal(settings.KeepAlive, false);
});

const file = (key, md5 = 'a'.repeat(32)) => ({ key, path: key, size: 20, md5 });
const remote = local => local.map(f => ({ Key: f.key, Size: String(f.size), ETag: `"${f.md5}"` }));
test('pagination includes dotfiles and follows every continuation marker', async () => {
  const markers = [];
  const files = await listAllRemote({ findFiles: async ({ marker }) => {
    markers.push(marker);
    return marker === ''
      ? { Contents: [{ Key: '.nojekyll' }], IsTruncated: 'true', NextMarker: '.nojekyll' }
      : { Contents: [{ Key: 'pet.html' }], IsTruncated: false };
  } });
  assert.deepEqual(markers, ['', '.nojekyll']);
  assert.deepEqual(files.map(file => file.Key), ['.nojekyll', 'pet.html']);
});
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
