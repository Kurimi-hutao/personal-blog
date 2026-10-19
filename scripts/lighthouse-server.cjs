// Test-only origin: synthetic backend, no proxying or production credentials.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { records } = require('./review-fixtures.cjs');
const root = path.resolve(__dirname, '../.lighthouseci-site');
const origin = 'http://127.0.0.1:4173';
const articles = records.map(record => JSON.parse(JSON.stringify(record).replaceAll('http://localhost:8000', origin)));
const videos = articles.slice(0, 3).map((record, index) => ({
  ...record, id: `video-${index}`, slug: `video-${index}`, content_type: 'video',
  video_url: '', video_poster: record.attachments[0]?.url || '',
  duration_seconds: 127, series_name: '合成性能样本', episode_number: index + 1,
}));
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.mp3': 'audio/mpeg', '.mp4': 'video/mp4' };
function handler(req, res) {
  const url = new URL(req.url, origin);
  if (url.pathname.startsWith('/rest/') || url.pathname.startsWith('/auth/') || url.pathname.startsWith('/storage/')) {
    let data = [];
    if (url.pathname === '/rest/v1/articles') {
      const all = [...articles, ...videos];
      const slug = url.searchParams.get('slug');
      data = slug ? all.find(record => `eq.${record.slug}` === slug) || null
        : all.filter(record => !url.searchParams.has('content_type') || `eq.${record.content_type}` === url.searchParams.get('content_type'));
    } else if (url.pathname.includes('/rpc/')) data = 129;
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' });
    return res.end(JSON.stringify(data));
  }
  let file;
  try { file = path.resolve(root, '.' + decodeURIComponent(url.pathname)); } catch { res.writeHead(400); return res.end(); }
  if (file !== root && !file.startsWith(root + path.sep)) { res.writeHead(403); return res.end(); }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); return res.end('Not found'); }
  res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}
if (require.main === module) {
  const config = fs.readFileSync(path.join(root, 'supabase-config.js'), 'utf8');
  if (!config.includes("supabaseUrl: 'http://127.0.0.1:4173'")) throw new Error('Run npm run build:perf first');
  http.createServer(handler).listen(4173, '127.0.0.1', () => console.log('LHCI fixture server ready'));
}
module.exports = { handler };
