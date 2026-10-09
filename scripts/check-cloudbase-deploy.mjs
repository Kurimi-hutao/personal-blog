import test from 'node:test';
import assert from 'node:assert/strict';
import { matches, partition, publish, listAllRemote, multipartEtags } from './cloudbase-deploy-lib.mjs';
import { createUploader } from './cloudbase-upload.mjs';

test('upload uses a complete Buffer, explicit timeout, MIME and shared hosting prefix', async () => {
  let settings, signed, request;
  class COS {
    constructor(options) { settings = options; }
    getObjectUrl(options, callback) { signed = options; callback(null, { Url: 'https://example.com/signed' }); }
  }
  await createUploader({
    COS, credentials: {}, config: { bucket: 'test', region: 'test', basePath: 'site' },
    mime: { lookup: () => 'text/javascript' },
    toPhysicalKey: (prefix, key) => `${prefix}/${key}`, report: () => {},
    request: async (url, options) => { request = options; return new Response(null, { status: 200 }); },
  })({ files: [{ localPath: new URL('./cloudbase-upload.mjs', import.meta.url), cloudPath: 'app.js' }] });
  assert(Buffer.isBuffer(request.body));
  assert.equal(signed.Key, 'site/app.js');
  assert.equal(signed.Method, 'PUT');
  assert.equal(request.headers['content-type'], 'text/javascript');
  assert(request.signal instanceof AbortSignal);
  assert.equal(settings.Timeout, 60000);
  assert.equal(settings.Protocol, 'https:');
  assert.equal(settings.KeepAlive, false);
});
test('multipart comparisons detect same-size byte changes', () => {
  const bytes = Buffer.alloc(2 * 1024 * 1024, 1);
  const a = { key: 'large.gif', size: bytes.length, md5: '', multipart: multipartEtags(bytes) };
  const stored = { Size: bytes.length, ETag: a.multipart[0] };
  assert(matches(a, stored));
  bytes[0] = 2;
  assert(!matches({ ...a, multipart: multipartEtags(bytes) }, stored));
});
test('large files use signed multipart requests and preserve every byte', async () => {
  const bytes = Buffer.alloc(2 * 1024 * 1024 + 17, 7);
  const calls = [], uploaded = [];
  class COS {
    getObjectUrl(options, callback) {
      callback(null, { Url: 'https://example.com/file?' + new URLSearchParams(options.Query) });
    }
  }
  await createUploader({
    COS, credentials: {}, config: {}, toPhysicalKey: (_, key) => key,
    mime: { lookup: () => 'image/png' }, read: async () => bytes, report: () => {},
    request: async (url, options) => {
      calls.push(options.method);
      const query = new URL(url).searchParams;
      if (query.has('uploads')) return new Response('<UploadId>test-upload</UploadId>');
      if (query.has('partNumber')) {
        uploaded.push(options.body);
        return new Response('', { headers: { ETag: '"part"' } });
      }
      assert(options.body.toString().includes('<PartNumber>3</PartNumber>'));
      return new Response('<CompleteMultipartUploadResult/>');
    },
  })({ files: [{ cloudPath: 'large.png', localPath: 'unused' }] });
  assert.deepEqual(calls, ['POST', 'PUT', 'PUT', 'PUT', 'POST']);
  assert.deepEqual(uploaded.map(part => part.length), [1024 * 1024, 1024 * 1024, 17]);
  assert.deepEqual(Buffer.concat(uploaded), bytes);
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
