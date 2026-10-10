// Read-only check of the existing public comment schema; never posts comments.
const fs = require('node:fs'), vm = require('node:vm'), path = require('node:path');
const config = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../supabase-config.js'), 'utf8'), config);
const { supabaseUrl, supabaseAnonKey } = config.window.BLOG_CONFIG;
(async () => {
  const url = new URL('/rest/v1/comments', supabaseUrl);
  url.searchParams.set('select', 'id,parent_id,body,attachments,approved,pinned,created_at');
  url.searchParams.set('limit', '1');
  const response = await fetch(url, { headers: { apikey: supabaseAnonKey, Authorization: `Bearer ${supabaseAnonKey}` }, signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(`Comment schema read failed: ${response.status}`);
  const rows = await response.json();
  if (!Array.isArray(rows)) throw new Error('Invalid comments response');
  console.log(JSON.stringify({ commentSchema: 'compatible without migration', sampledRows: rows.length }));
})();
