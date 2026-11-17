import test from 'node:test';
import assert from 'node:assert/strict';
import {gunzipSync} from 'node:zlib';
import {encodeAsset} from './compress-deploy.mjs';
test('wire compression is deterministic and preserves exact HTML, JS and CSS bytes',()=>{
 const bytes=Buffer.from('<p>桃花与水墨</p>'.repeat(200));
 for(const key of ['index.html','theme.js','styles.css']) {
   const encoded=encodeAsset(key,bytes);
   assert.equal(encoded.contentEncoding,'gzip');
   assert.deepEqual(gunzipSync(encoded.bytes),bytes);
   assert.deepEqual(encoded.bytes,encodeAsset(key,bytes).bytes);
 }
 assert.equal(encodeAsset('cover.webp',bytes).contentEncoding,undefined);
});
