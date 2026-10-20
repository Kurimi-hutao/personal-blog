import test from 'node:test';
import assert from 'node:assert/strict';
import { createHandler, emailRequest, retrySeconds, retryable, TEMPLATE_ID } from '../supabase/functions/comment-notify/core.mjs';

const id = 'b1b11111-1111-4111-8111-111111111111';
const emailId = 'e1e11111-1111-4111-8111-111111111111';
const job = { comment_id: id, lease_token: id, attempts: 1, context: {
  comment: { visitor_name: '<访客>', body: '第一行\n<script>bad</script>', created_at: '2026-10-20T02:30:00Z' },
  article: { title: '文章 & 标题', slug: 'article-real-route' },
} };
const token = 'a'.repeat(64);
const req = value => new Request('https://worker.test', { method: 'POST', headers: value ? { 'x-blog-webhook-token': value } : {} });
function fixture({ response = Response.json({ id: emailId }), sendError = false, config = true, authorized = true } = {}) {
  let state = 'pending', saved, outcome, sends = 0;
  const calls = [];
  const rpc = async (name, args) => {
    calls.push(name);
    if (name === 'comment_email_authorized') return authorized;
    if (name === 'claim_comment_emails') {
      if (state !== 'pending') return [];
      state = 'processing'; return [{ ...job, email_request: saved }];
    }
    if (name === 'prepare_comment_email') { saved ||= args.payload; return saved; }
    if (name === 'finish_comment_email') { outcome = args; state = args.state; return null; }
    throw Error('Unexpected RPC');
  };
  const handler = createHandler({ rpc, env: name => config ? ({ RESEND_API_KEY: 'test-not-a-real-key', COMMENT_NOTIFICATION_TO: 'owner@example.test', COMMENT_NOTIFICATIONS_ENABLED: 'true' }[name]) : undefined,
    pause: async () => {}, send: async (url, options) => {
      sends++; assert.equal(url, 'https://api.resend.com/emails');
      assert.equal(options.headers['Idempotency-Key'], `blog-comment/${id}`);
      assert.equal(calls.at(-1), 'prepare_comment_email');
      assert.deepEqual(JSON.parse(options.body), saved);
      if (sendError) throw Error('network');
      return response;
    } });
  return { handler, calls, get sends() { return sends; }, get outcome() { return outcome; }, get saved() { return saved; } };
}
test('reject missing, anonymous and incorrect webhook credentials before claiming work', async () => {
  const f = fixture({ authorized: false });
  for (const value of [null, 'anon-key', token]) assert.equal((await f.handler(req(value))).status, 401);
  assert.equal(f.sends, 0); assert.ok(!f.calls.includes('claim_comment_emails'));
});
test('missing secrets or disabled sending preserves pending work', async () => {
  const f = fixture({ config: false });
  assert.equal((await f.handler(req(token))).status, 503);
  assert.ok(!f.calls.includes('claim_comment_emails'));
});
test('five variables use real article routing, Shanghai time and escaped visitor text', () => {
  const payload = emailRequest(job, 'owner@example.test');
  assert.equal(payload.template.id, TEMPLATE_ID);
  assert.deepEqual(Object.keys(payload.template.variables).sort(), ['ARTICLE_TITLE','ARTICLE_URL','COMMENT_AUTHOR','COMMENT_TEXT','COMMENT_TIME']);
  assert.equal(payload.template.variables.ARTICLE_URL, 'https://joestarzhang.cn/article.html?slug=article-real-route#comments');
  assert.equal(payload.template.variables.COMMENT_AUTHOR, '&lt;访客&gt;');
  assert.equal(payload.template.variables.COMMENT_TEXT, '第一行\n&lt;script&gt;bad&lt;/script&gt;');
  assert.match(payload.template.variables.COMMENT_TIME, /10:30:00/);
});
test('successful send persists provider ID and a repeated wakeup does not resend', async () => {
  const f = fixture();
  assert.deepEqual(await (await f.handler(req(token))).json(), { processed: 1, accepted: 1 });
  await f.handler(req(token));
  assert.equal(f.sends, 1); assert.equal(f.outcome.email_id, emailId);
  assert.equal(f.outcome.state, 'accepted');
});
test('rate limit respects retry-after and does not expose provider response text', async () => {
  const f = fixture({ response: Response.json({ message: 'sensitive provider text' }, { status: 429, headers: { 'retry-after': '300' } }) });
  await f.handler(req(token));
  assert.equal(f.outcome.state, 'retry'); assert.equal(f.outcome.delay_seconds, 300);
  assert.equal(f.outcome.error_code, 'resend_http_429');
  assert.ok(!JSON.stringify(f.outcome).includes('sensitive'));
});
test('network timeout retries while invalid sender/template fails for operator correction', async () => {
  const network = fixture({ sendError: true }); await network.handler(req(token));
  assert.equal(network.outcome.state, 'retry');
  const invalid = fixture({ response: Response.json({ name: 'validation_error' }, { status: 422 }) });
  await invalid.handler(req(token)); assert.equal(invalid.outcome.state, 'failed');
});
test('conflicting payload cannot retry, concurrent request can; backoff is bounded', () => {
  assert.equal(retryable(409, 'invalid_idempotent_request'), false);
  assert.equal(retryable(409, 'concurrent_idempotent_requests'), true);
  assert.equal(retrySeconds(4), 240); assert.equal(retrySeconds(20, '86400'), 3600);
  assert.equal(retrySeconds(1, new Date(300000).toUTCString(), 0), 300);
});
test('hidden/deleted comment or lost lease never sends', async () => {
  let sends = 0;
  const handler = createHandler({ env: name => ({ RESEND_API_KEY: 'test', COMMENT_NOTIFICATION_TO: 'owner@example.test', COMMENT_NOTIFICATIONS_ENABLED: 'true' }[name]),
    rpc: async name => name === 'comment_email_authorized' ? true : name === 'claim_comment_emails' ? [job] : null,
    send: async () => { sends++; } });
  assert.equal((await handler(req(token))).status, 200); assert.equal(sends, 0);
});
test('DB failure after send returns unavailable so expired lease can recover', async () => {
  const calls = [];
  const handler = createHandler({ env: name => ({ RESEND_API_KEY: 'test', COMMENT_NOTIFICATION_TO: 'owner@example.test', COMMENT_NOTIFICATIONS_ENABLED: 'true' }[name]),
    rpc: async (name, args) => { calls.push(name); if (name === 'comment_email_authorized') return true;
      if (name === 'claim_comment_emails') return [job]; if (name === 'prepare_comment_email') return args.payload;
      throw Error('DB unavailable'); }, send: async () => Response.json({ id: emailId }) });
  assert.equal((await handler(req(token))).status, 503);
  assert.equal(calls.at(-1), 'finish_comment_email');
});
