export const TEMPLATE_ID = '8dab72c3-2ac5-4080-8509-4af11585b90f';
export const FROM = '虎桃博客 <notifications@mail.joestarzhang.cn>';
export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
export function emailRequest(job, recipient) {
  const { comment, article } = job.context;
  const url = new URL('https://joestarzhang.cn/article.html');
  url.searchParams.set('slug', article.slug);
  url.hash = 'comments';
  const time = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).format(new Date(comment.created_at)) + '（北京时间）';
  return {
    from: FROM, to: [recipient],
    subject: '【虎桃博客】收到新评论',
    template: { id: TEMPLATE_ID, variables: {
      COMMENT_AUTHOR: escapeHtml(comment.visitor_name),
      COMMENT_TEXT: escapeHtml(comment.body),
      ARTICLE_TITLE: escapeHtml(article.title),
      ARTICLE_URL: url.href,
      COMMENT_TIME: time,
    } },
    tags: [{ name: 'comment_id', value: job.comment_id }],
  };
}
export function retrySeconds(attempts, retryAfter, now = Date.now()) {
  const parsed = /^\d+$/.test(retryAfter || '') ? Number(retryAfter)
    : Math.ceil((Date.parse(retryAfter || '') - now) / 1000);
  return Math.min(3600, Math.max(30, Number.isFinite(parsed) ? parsed : 0,
    30 * 2 ** Math.min(attempts - 1, 7)));
}
export function retryable(status, name) {
  return status === 429 || status >= 500 ||
    (status === 409 && name === 'concurrent_idempotent_requests');
}
export function createHandler({ rpc, env, send = fetch, pause = ms => new Promise(r => setTimeout(r, ms)) }) {
  const reply = (status, data) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
  return async request => {
    if (request.method !== 'POST') return reply(405, { error: 'method_not_allowed' });
    const token = request.headers.get('x-blog-webhook-token') || '';
    if (!/^[a-f0-9]{64}$/.test(token)) return reply(401, { error: 'unauthorized' });
    try {
      if (!await rpc('comment_email_authorized', { token })) return reply(401, { error: 'unauthorized' });
      const apiKey = env('RESEND_API_KEY');
      const recipient = env('COMMENT_NOTIFICATION_TO');
      if (!apiKey || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient || '') || env('COMMENT_NOTIFICATIONS_ENABLED') !== 'true') {
        return reply(503, { error: 'notification_configuration_incomplete' });
      }
      const jobs = await rpc('claim_comment_emails', {});
      let accepted = 0;
      for (const [index, job] of jobs.entries()) {
        if (index) await pause(600); // Stay below Resend's default two requests/second.
        // Persist the complete request BEFORE contacting Resend. Retries cannot change it.
        const payload = await rpc('prepare_comment_email', {
          job_id: job.comment_id, lease: job.lease_token,
          payload: job.email_request || emailRequest(job, recipient),
        });
        if (!payload) continue; // Deleted/hidden comment or lost lease.
        let outcome;
        try {
          const response = await send('https://api.resend.com/emails', {
            method: 'POST', signal: AbortSignal.timeout(15000),
            headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json',
              'Idempotency-Key': `blog-comment/${job.comment_id}` },
            body: JSON.stringify(payload),
          });
          const result = await response.json().catch(() => ({}));
          if (response.ok && typeof result.id === 'string' && /^[0-9a-f-]{36}$/i.test(result.id)) {
            outcome = { state: 'accepted', email_id: result.id, error_code: null, delay_seconds: 0 };
            accepted++;
          } else {
            // Never store provider response text: it can echo addresses/content/secrets.
            const waitingForDomain = response.status === 400 && typeof result.message === 'string' &&
              result.message.startsWith('The associated domain with your API key is not verified.');
            outcome = { state: waitingForDomain || retryable(response.status, result.name) || response.ok ? 'retry' : 'failed',
              email_id: null, error_code: waitingForDomain ? 'resend_domain_not_verified' : `resend_http_${response.status}`,
              delay_seconds: Math.max(waitingForDomain ? 300 : 0,
                retrySeconds(job.attempts, response.headers.get('retry-after'))) };
          }
        } catch {
          outcome = { state: 'retry', email_id: null, error_code: 'resend_network_error',
            delay_seconds: retrySeconds(job.attempts) };
        }
        // A DB failure after acceptance intentionally leaves the lease intact. On expiry,
        // the identical payload and Resend idempotency key recover the original email ID.
        await rpc('finish_comment_email', { job_id: job.comment_id, lease: job.lease_token, ...outcome });
      }
      return reply(200, { processed: jobs.length, accepted });
    } catch {
      console.error('comment_email_worker_failed');
      return reply(503, { error: 'notification_worker_unavailable' });
    }
  };
}
