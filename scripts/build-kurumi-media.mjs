// Preserve the existing painting, producing a small film and a matching first-frame poster.
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { execFileSync } from 'node:child_process';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = resolve(root, 'assets/ink-refinement-20261104');
const source = resolve(root, 'assets/next/hero_bg_from_mp4_optimized.gif');
mkdirSync(output, { recursive: true });
execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', source, '-frames:v', '1',
  '-c:v', 'libwebp', '-quality', '86', '-y', resolve(output, 'kurumi-poster.webp')], { stdio: 'inherit' });
execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', source, '-an', '-vf',
  'scale=960:478:flags=lanczos,setsar=1', '-c:v', 'libx264', '-preset', 'slow', '-crf', '25',
  '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-y', resolve(output, 'kurumi-hero.mp4')], { stdio: 'inherit' });
