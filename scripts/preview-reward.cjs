// Local-only preview. Synthetic article data never contacts the published service.
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const { records } = require('./review-fixtures.cjs');
const root = path.resolve(__dirname, '..');
const article = { ...records[0], id: 'reward-preview', slug: 'reward-preview', title: '卷尾小憩 · 一杯心意', attachments: [], content: '## 写在卷尾\n\n这是打赏功能的本地预览文章。远山留白，近处落墨。\n\n文章与视频的末尾，现在都可以留下一杯瑞幸的心意。点击「赏」字，在独立窗口中选择金额与支付方式。' };
const fixture = `<script>
Object.assign(window.articleService, {
  configured: true,
  getPublished: async () => (${JSON.stringify(article)}),
  listPublished: async () => [], listRelated: async () => [], listComments: async () => [],
  recordView: async () => 0, recordSiteVisit: async () => 0,
  toggleReaction: async () => ({ active: true, count: 1 })
});
</script>`;
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.jpg': 'image/jpeg' };
http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://127.0.0.1');
    const file = path.resolve(root, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
    if (!file.startsWith(root + path.sep)) { res.writeHead(403); return res.end(); }
    let body = await fs.readFile(file);
    if (url.pathname === '/article.html' && url.searchParams.get('preview') === 'reward') {
      body = body.toString().replace('<script src="./supabase-config.js"></script>', '<script>window.BLOG_CONFIG = {};</script>')
        .replace(/(<script src="\.\/article-service\.js[^>]*><\/script>)/, '$1' + fixture);
    }
    res.writeHead(200, { 'content-type': mime[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(body);
  } catch { res.writeHead(404); res.end('Not found'); }
}).listen(8000, '127.0.0.1', () => console.log('Local: http://127.0.0.1:8000/article.html?slug=reward-preview&preview=reward#rewardTitle'));
