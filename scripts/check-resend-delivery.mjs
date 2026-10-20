import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac, randomBytes } from 'node:crypto';
import { verifySignature, createDeliveryHandler } from '../supabase/functions/resend-delivery/core.mjs';
const key = randomBytes(32);
const secret = `whsec_${key.toString('base64')}`;
const now = Date.now();
const timestamp = String(Math.floor(now / 1000));
const body = JSON.stringify({ type: 'email.delivered', created_at: new Date(now).toISOString(),
  data: { email_id: 'e1e11111-1111-4111-8111-111111111111' } });
function headers(text = body, time = timestamp) {
  const signature = createHmac('sha256', key).update(`msg_fixture.${time}.${text}`).digest('base64');
  return new Headers({ 'svix-id': 'msg_fixture', 'svix-timestamp': time, 'svix-signature': `v1,${signature}` });
}
test('verify exact raw body, reject changes and expired timestamps', async () => {
  assert.equal(await verifySignature(body, headers(), secret, now), true);
  assert.equal(await verifySignature(body + ' ', headers(), secret, now), false);
  assert.equal(await verifySignature(body, headers(), secret, now + 301000), false);
  assert.equal(await verifySignature(body, headers(body, String(Number(timestamp) + 1000)), secret, now), false);
});
test('signature verification supports signing key rotation with multiple v1 signatures', async () => {
  const h = headers(); h.set('svix-signature', `v1,bad ${h.get('svix-signature')}`);
  assert.equal(await verifySignature(body, h, secret, now), true);
});
test('delivery handler writes only signed event metadata', async () => {
  const calls = [];
  const handler = createDeliveryHandler({ env: () => secret, rpc: async (...args) => calls.push(args) });
  const response = await handler(new Request('https://hook.test', { method: 'POST', headers: headers(), body }));
  assert.equal(response.status, 200); assert.equal(calls.length, 1);
  assert.equal(calls[0][0], 'record_comment_email_event');
  assert.deepEqual(Object.keys(calls[0][1]).sort(), ['email_id','event_id','event_time','event_type']);
});
test('forged callbacks cannot update delivery state and missing secret is retryable', async () => {
  let calls = 0;
  const handler = createDeliveryHandler({ env: () => secret, rpc: async () => calls++ });
  assert.equal((await handler(new Request('https://hook.test', { method: 'POST', body }))).status, 401);
  assert.equal(calls, 0);
  const disabled = createDeliveryHandler({ env: () => undefined });
  assert.equal((await disabled(new Request('https://hook.test', { method: 'POST', body }))).status, 503);
});
test('database failure returns 503 so provider retries the delivery event', async () => {
  const handler = createDeliveryHandler({ env: () => secret, rpc: async () => { throw Error('database'); } });
  assert.equal((await handler(new Request('https://hook.test', { method: 'POST', headers: headers(), body }))).status, 503);
});
