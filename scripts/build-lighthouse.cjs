// Reuse the production packager, with a separate disposable output directory.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const output = path.join(root, '.lighthouseci-site');
fs.rmSync(output, { recursive: true, force: true });
execFileSync(process.execPath, ['scripts/prepare-cloudbase.mjs'], {
  cwd: root, stdio: 'inherit', env: { ...process.env, LHCI_BUILD: '1' },
});
// Never serve the real backend configuration during performance tests.
fs.writeFileSync(path.join(output, 'supabase-config.js'), `window.BLOG_CONFIG = {
  supabaseUrl: 'http://127.0.0.1:4173',
  supabaseAnonKey: 'synthetic-lighthouse-key', ownerUserId: 'synthetic-owner'
};\n`);
