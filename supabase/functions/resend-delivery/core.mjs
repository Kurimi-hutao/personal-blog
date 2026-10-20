const supported = new Set(['email.sent','email.delivered','email.bounced','email.complained','email.failed','email.suppressed','email.delivery_delayed']);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function verifySignature(body, headers, secret, now = Date.now()) {
  const id = headers.get('svix-id');
  const timestamp = headers.get('svix-timestamp');
  if (!id || id.length > 200 || !/^\d+$/.test(timestamp || '') || Math.abs(now / 1000 - Number(timestamp)) > 300) return false;
  try {
    const key = await crypto.subtle.importKey('raw', Uint8Array.from(atob(secret.replace(/^whsec_/, '')), c => c.charCodeAt(0)),
      { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
    const message = new TextEncoder().encode(`${id}.${timestamp}.${body}`);
    for (const signature of (headers.get('svix-signature') || '').split(' ')) {
      const [version, value] = signature.split(',');
      if (version === 'v1' && value && await crypto.subtle.verify('HMAC', key, Uint8Array.from(atob(value), c => c.charCodeAt(0)), message)) return true;
    }
  } catch { return false; }
  return false;
}
export function createDeliveryHandler({ env, rpc }) {
  return async request => {
    if (request.method !== 'POST') return Response.json({ error: 'method_not_allowed' }, { status: 405 });
    const secret = env('RESEND_WEBHOOK_SECRET');
    if (!secret) return Response.json({ error: 'webhook_not_configured' }, { status: 503 });
    const body = await request.text();
    if (body.length > 65536 || !await verifySignature(body, request.headers, secret)) {
      return Response.json({ error: 'invalid_signature' }, { status: 401 });
    }
    try {
      const event = JSON.parse(body);
      if (!supported.has(event.type)) return Response.json({ ignored: true });
      if (!uuid.test(event.data?.email_id || '') || !Number.isFinite(Date.parse(event.created_at))) {
        return Response.json({ error: 'invalid_event' }, { status: 400 });
      }
      await rpc('record_comment_email_event', { event_id: request.headers.get('svix-id'),
        email_id: event.data.email_id, event_type: event.type, event_time: event.created_at });
      return Response.json({ received: true });
    } catch {
      console.error('comment_email_delivery_event_failed');
      return Response.json({ error: 'event_processing_failed' }, { status: 503 });
    }
  };
}
