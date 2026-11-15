import { buildSEO, fetchPublished } from './build-seo.mjs';
import { cp, mkdir, readdir, readFile, stat, writeFile, appendFile, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

createRequire(import.meta.url)('./build-page-styles.cjs').buildPageStyles({ check: true });

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.resolve(root, process.env.SEO_OUTPUT || (process.env.LHCI_BUILD === '1' ? '.lighthouseci-site' : '_deploy'));
if (!output.startsWith(root + path.sep)) throw new Error('Output must stay within workspace');
const runtimeDirectories = ['assets', 'next-generation-letter', 'zhengshen-atlas'];
const runtimeFile = /\.(html|css|js|webmanifest|xml|txt|ico|svg)$/i;
const forbidden = new Set(['node_modules', 'sources', 'outputs', 'screenshots', 'docs', 'scripts']);
const files = [];

// Refuse to merge into an old package: stale files must never reach production.
try {
  await access(output);
  throw new Error('_deploy already exists. Use a clean checkout for packaging.');
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}

async function collect(directory, relative = '') {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || forbidden.has(entry.name)) continue;
    const name = path.posix.join(relative, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Symlink is not allowed in deployment: ${name}`);
    if (entry.isDirectory()) await collect(path.join(directory, entry.name), name);
    else if (entry.isFile()) files.push(name);
  }
}

for (const entry of await readdir(root, { withFileTypes: true })) {
  if (entry.isFile() && (runtimeFile.test(entry.name) || entry.name === '.nojekyll')) files.push(entry.name);
}
for (const directory of runtimeDirectories) await collect(path.join(root, directory), directory);

for (const required of ['index.html', 'pet.html', 'service-worker.js',
  'assets/pet-cottage/room-night-mobile.png', 'assets/pet-cottage/ui/01_interactions/feed.png',
  'assets/audio/hutao/hutao-feed-01.mp3', 'next-generation-letter/index.html', 'zhengshen-atlas/index.html']) {
  if (!files.includes(required)) throw new Error(`Required runtime file is missing: ${required}`);
}

// Check pages and first-party styles. Vendor CSS may list unused legacy font fallbacks.
const available = new Set(files);
const missing = [];
for (const file of files.filter(name => name.endsWith('.html') || (name.endsWith('.css') && !name.includes('/')))) {
  const source = await readFile(path.join(root, file), 'utf8');
  const refs = file.endsWith('.html')
    ? [...source.matchAll(/(?:src|href)\s*=\s*["']([^"']+)["']/g)].map(match => match[1])
    : [...source.matchAll(/url\(\s*["']?([^\s)"']+)["']?\s*\)/g)].map(match => match[1]);
  for (const ref of refs) {
    if (/^(?:[a-z][a-z\d+.-]*:|\/|#|\{|\$)/i.test(ref)) continue;
    const clean = ref.split(/[?#]/)[0];
    if (!clean) continue;
    let decoded;
    try { decoded = decodeURIComponent(clean); } catch { decoded = clean; }
    if (decoded.startsWith('#')) continue;
    const target = path.posix.normalize(path.posix.join(path.posix.dirname(file), decoded));
    if (!available.has(target) && !available.has(path.posix.join(target, 'index.html'))) {
      missing.push(`${file} -> ${ref}`);
    }
  }
}
if (missing.length) throw new Error(`Missing packaged resources:\n${missing.join('\n')}`);

await mkdir(output);
let bytes = 0;
for (const file of files.sort()) {
  const destination = path.join(output, file);
  await mkdir(path.dirname(destination), { recursive: true });
  await cp(path.join(root, file), destination);
  bytes += (await stat(destination)).size;
}
if (process.env.LHCI_BUILD !== '1') {
  if (process.env.CI && process.env.SEO_CONTENT_FILE) throw new Error('CI must fetch fresh public content');
  const rows = process.env.SEO_CONTENT_FILE ? JSON.parse(await readFile(process.env.SEO_CONTENT_FILE, 'utf8')) : await fetchPublished(root);
  let previous = [];
  if (!process.env.SEO_CONTENT_FILE) {
    const response = await fetch('https://joestarzhang.cn/seo-manifest.json', { signal: AbortSignal.timeout(20000), headers: { 'cache-control': 'no-cache' } });
    if (response.ok && response.headers.get('content-type')?.includes('json')) {
      previous = await response.json();
      if (!Array.isArray(previous)) throw new Error('Invalid previous SEO manifest');
    } else if (response.status !== 404 && !(response.ok && response.headers.get('content-type')?.includes('text/html'))) {
      throw new Error(`Cannot check previous public pages: HTTP ${response.status}`);
    }
  }
  await buildSEO({ root, output, rows, previous });
}
const revision = process.env.GITHUB_SHA || 'local-preview';
await writeFile(path.join(output, 'deployment.json'), JSON.stringify({ revision, files: files.length, bytes }, null, 2) + '\n');
const summary = `CloudBase package: ${files.length + 1} files, ${(bytes / 1024 / 1024).toFixed(1)} MiB; revision ${revision}`;
console.log(summary);
if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, summary + '\n');
