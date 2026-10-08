"""Prepare supplied artwork for the website; preserve every original unchanged."""
from pathlib import Path
from PIL import Image, ImageOps
import json
import shutil

ROOT = Path(__file__).resolve().parent.parent
SOURCE = Path('C:/Users/emmmm/Downloads')
OUT = ROOT / 'assets/visual-refresh'
ORIGINALS = ROOT / 'sources/visual-refresh'
OUT.mkdir(parents=True, exist_ok=True)
ORIGINALS.mkdir(parents=True, exist_ok=True)
records = []

def source(name):
    path = SOURCE / name
    shutil.copy2(path, ORIGINALS / name)
    return Image.open(path)

def export(im, name, size, trim=False):
    if trim and im.mode == 'RGBA':
        # Ignore near-transparent stray pixels when finding the visible artwork.
        box = im.getchannel('A').point(lambda a: 255 if a > 16 else 0).getbbox()
        if box:
            im = im.crop((max(0, box[0] - 12), max(0, box[1] - 12), min(im.width, box[2] + 12), min(im.height, box[3] + 12)))
    im.thumbnail(size, Image.Resampling.LANCZOS)
    path = OUT / name
    im.save(path, 'WEBP', quality=86, method=6)
    records.append({'file': name, 'size': list(im.size), 'bytes': path.stat().st_size})

for filename, name, size in [
    ('朱砂篆刻虎桃印章.png', 'seal-hutao.webp', (256, 300)),
    ('水墨卷轴与书法笔花瓣.png', 'empty-search.webp', (600, 420)),
    ('水墨书写静物与樱花瓣.png', 'empty-comments.webp', (600, 420)),
    ('水墨暮桥与红灯笼.png', 'load-error.webp', (600, 420)),
]:
    export(source(filename), name, size, trim=True)

sheet = source('水墨雅韵传统器物图标集.png')
# Actual supplied sheet is 1254 square. Each crop isolates one complete object.
for name, box in {
    'brush': (55, 155, 420, 615),
    'scroll': (420, 265, 866, 560),
    'lantern': (890, 155, 1200, 635),
    'bookmark': (135, 655, 395, 1130),
    'seal': (470, 750, 800, 1080),
}.items():
    export(sheet.crop(box), f'icon-{name}.webp', (160, 160), trim=True)

home = source('hutao-home-icon.png.jpg').convert('RGB')
for size in (180, 192, 512):
    home.resize((size, size), Image.Resampling.LANCZOS).save(OUT / f'home-icon-{size}.png', optimize=True)
fav = source('hutao-favicon.png.png').convert('RGBA')
for size in (16, 32, 48):
    fav.resize((size, size), Image.Resampling.LANCZOS).save(OUT / f'favicon-{size}.png', optimize=True)
fav.save(OUT / 'favicon.ico', sizes=[(16, 16), (32, 32), (48, 48)])

for scene in ('articles-writing-desk', 'videos-riverside-stage', 'works-maker-study'):
    export(source(f'{scene}-night.png'), f'{scene}-night.webp', (1920, 700))
    export(source(f'{scene}-night-1.png'), f'{scene}-night-mobile.webp', (900, 1200))

(OUT / 'manifest.json').write_text(json.dumps(records, indent=2, ensure_ascii=False), encoding='utf-8')
print(json.dumps(records, indent=2))
