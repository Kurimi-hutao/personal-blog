const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

test('detail schema fallback shares the original request deadline', async () => {
  const signals = [];
  let calls = 0, expire;
  const client = { from() {
    const first = calls++ === 0;
    let signal;
    const query = {
      select() { return this; }, eq() { return this; }, is() { return this; }, or() { return this; },
      abortSignal(value) { signal = value; return this; },
      single() {
        signals.push(signal);
        if (first) return Promise.resolve({ error: { message: 'column deleted_at does not exist' } });
        return new Promise(resolve => signal?.addEventListener('abort', () => resolve({ error: new Error('request aborted') }), { once: true }));
      },
    };
    return query;
  } };
  const window = { BLOG_CONFIG: { supabaseUrl: 'https://example.invalid', supabaseAnonKey: 'test' }, supabase: { createClient: () => client } };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../article-service.js'), 'utf8'), {
    window, URL, AbortController, document: { currentScript: { src: 'https://example.invalid/article-service.js' } },
    setTimeout(callback, duration) { assert.equal(duration, 10000); expire = callback; return 1; }, clearTimeout() {},
  });
  const request = window.articleService.getPublished('example');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(calls, 2);
  assert(signals[0], 'primary query has a signal');
  assert.equal(signals[1], signals[0], 'fallback must use the same deadline');
  expire();
  await assert.rejects(request, /request aborted/);
});
