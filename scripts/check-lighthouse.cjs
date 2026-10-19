const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { handler } = require('./lighthouse-server.cjs');
test('both profiles cover populated routes and keep reports local', () => {
  for (const profile of ['desktop', 'mobile']) {
    process.env.LHCI_PROFILE = profile;
    delete require.cache[require.resolve('../lighthouserc.cjs')];
    const { ci } = require('../lighthouserc.cjs');
    assert.equal(ci.collect.numberOfRuns, 3);
    assert.equal(ci.collect.url.length, 6);
    assert(ci.collect.url.every(url => new URL(url).origin === 'http://127.0.0.1:4173'));
    assert.equal(ci.upload.target, 'filesystem');
    assert.equal(ci.collect.settings.preset === 'desktop', profile === 'desktop');
    for (const audit of ['largest-contentful-paint', 'cumulative-layout-shift', 'bootup-time', 'total-blocking-time']) {
      assert.equal(ci.assert.assertions[audit][1].aggregationMethod, 'median');
    }
  }
  delete process.env.LHCI_PROFILE;
  const workflow = fs.readFileSync('.github/workflows/lighthouse.yml', 'utf8');
  assert(!/upload-artifact|pull_request_target|secrets\./.test(workflow.replace(/^\s*#.*$/gm, '')));
});
test('fixture backend renders real article/video shapes and absorbs writes', async () => {
    const request = url => {
      let status, body;
      handler({ url }, { writeHead(code) { status = code; }, end(value) { body = value; } });
      return { status, json: () => JSON.parse(body) };
    };
    const article = request('/rest/v1/articles?slug=eq.review-0').json();
    assert.equal(article.slug, 'review-0');
    assert(article.content.length > 500);
    const videos = request('/rest/v1/articles?content_type=eq.video').json();
    assert.equal(videos.length, 3);
    assert(videos.every(video => video.content_type === 'video'));
    assert.equal(request('/rest/v1/rpc/register_view').json(), 129);
    assert.equal(request('/.env').status, 404);
});
