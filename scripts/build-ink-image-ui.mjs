// Optimize generated artwork for the web without altering its composition or alpha.
import { mkdirSync, copyFileSync, statSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const originals = resolve(root, 'outputs/ink-image-ui-20261105/originals');
const exports = resolve(root, 'outputs/ink-image-ui-20261105/png');
const runtime = resolve(root, 'assets/ink-ui-20261105');
for (const dir of [originals, exports, runtime]) mkdirSync(dir, { recursive: true });
const sources = {
  play: 'exec-67b401d1-0e32-4926-be6d-3cac24f34015.png',
  pause: 'exec-b2b293f2-2d4e-4119-a107-ccebc04b7e3a.png',
  close: 'exec-aff709ad-120d-4162-a44d-a13c1ab4a969.png',
  next: 'exec-bfc9fbd6-5043-4c53-b592-012acf7059aa.png',
};
// With no argument, rebuild from the retained project originals.
for (const [name, file] of Object.entries(sources)) {
  const source = resolve(originals, `${name}.png`);
  if (process.argv[2]) copyFileSync(resolve(process.argv[2], file), source);
  execFileSync('ffmpeg', ['-hide_banner','-loglevel','error','-i',source,'-vf','scale=256:256:flags=lanczos',
    '-frames:v','1','-c:v','libwebp','-quality','90','-compression_level','6','-y',resolve(runtime,`${name}.webp`)], {stdio:'inherit'});
  execFileSync('ffmpeg', ['-hide_banner','-loglevel','error','-i',source,'-vf','scale=256:256:flags=lanczos',
    '-frames:v','1','-y',resolve(exports,`${name}.png`)], {stdio:'inherit'});
  console.log(`${name}: ${statSync(resolve(runtime,`${name}.webp`)).size} bytes`);
}
