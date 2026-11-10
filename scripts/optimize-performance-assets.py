"""Keep the atlas artwork; export appropriately sized lossless-source derivatives."""
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parents[1]
output = root / 'assets/works'
output.mkdir(exist_ok=True)
with Image.open(root / 'zhengshen-atlas/hero.png') as image:
    for width in (640, 1280):
        resized = image.convert('RGBA')
        resized.thumbnail((width, width * 9 // 16), Image.Resampling.LANCZOS)
        target = output / f'atlas-cover-{width}.webp'
        resized.save(target, quality=88, method=6)
        print(f'{target.name}: {target.stat().st_size} bytes')

petals = root / 'assets/spring-ink/small'
petals.mkdir(exist_ok=True)
for source in (root / 'assets/spring-ink').glob('petal-*.webp'):
    with Image.open(source) as image:
        for size in (48, 144):
            scaled = image.convert('RGBA')
            scaled.thumbnail((size, size), Image.Resampling.LANCZOS)
            target = petals / f'{source.stem}-{size}.webp'
            scaled.save(target, quality=90, method=6)
            print(f'{target.name}: {target.stat().st_size} bytes')
