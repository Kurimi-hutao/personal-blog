"""Build small header avatars and a compact, heading-only webfont stylesheet."""
from pathlib import Path
from PIL import Image
import runpy

ROOT = Path(__file__).resolve().parents[1]
with Image.open(ROOT / 'assets/brand-tigerhat.png') as image:
    for size in (88, 132):
        avatar = image.convert('RGBA')
        avatar.thumbnail((size, size), Image.Resampling.LANCZOS)
        avatar.save(ROOT / f'assets/brand-tigerhat-{size}.webp', quality=86, method=6)

# Retain every original brush glyph while reducing each requested font block.
runpy.run_path(str(ROOT / 'scripts/build-brush-core.py'), run_name='__main__')
