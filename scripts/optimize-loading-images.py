"""Encode the large home/room artwork without changing its dimensions."""
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parents[1]
sources = list((root / 'assets/spring-ink').glob('*.png'))
sources += list((root / 'assets').glob('pet-room-*.png'))
sources += [root / 'assets/pet-cottage/room-night-mobile.png']
mapping = {}
before = after = 0
for source in sources:
    target = source.with_suffix('.webp')
    with Image.open(source) as image:
        image.save(target, 'WEBP', quality=84, method=6)
    mapping[source.relative_to(root).as_posix()] = target.relative_to(root).as_posix()
    before += source.stat().st_size
    after += target.stat().st_size
for file in list(root.glob('*.html')) + list(root.glob('*.css')) + [root / 'script.js', root / 'works-data.js']:
    original = file.read_text(encoding='utf-8')
    content = original
    for old, new in mapping.items():
        content = content.replace(old, new)
    # Petal filenames are composed dynamically.
    if file.name == 'script.js':
        content = content.replace('Math.random() * 8)}.png', 'Math.random() * 8)}.webp')
    if content != original:
        file.write_text(content, encoding='utf-8')
print(f'{len(sources)} images: {before:,} -> {after:,} bytes ({(1-after/before)*100:.1f}% smaller)')
