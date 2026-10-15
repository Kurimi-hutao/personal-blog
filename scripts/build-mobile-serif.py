"""Build the approved mobile typography from existing OFL font shards.

Requires fontTools[woff] and brotli. Original font files and licenses are retained.
Rare characters fall back to the device's serif font.
"""
from pathlib import Path
from fontTools.merge import Merger
from fontTools.ttLib import TTFont
from fontTools import subset

ROOT = Path(__file__).resolve().parents[1]
sources = sorted((ROOT / 'assets/fonts/blog-serif').glob('*400-normal.woff2'))
characters = set(range(32, 127))
for source in sources:
    try:
        shard = int(source.name.split('-')[-3])
    except ValueError:
        continue
    if shard >= 110:
        with TTFont(source) as font:
            characters.update(font.getBestCmap())
for source in list(ROOT.glob('*.html')) + list(ROOT.glob('*.js')):
    characters.update(ord(char) for char in source.read_text(encoding='utf-8')
                      if '\u3400' <= char <= '\u9fff' or '\u3000' <= char <= '\u303f')
font = Merger().merge([str(source) for source in sources])
options = subset.Options()
options.flavor = 'woff2'
subsetter = subset.Subsetter(options=options)
subsetter.populate(unicodes=characters)
subsetter.subset(font)
font.flavor = 'woff2'
output = ROOT / 'assets/fonts/blog-mobile-serif.woff2'
font.save(output)
print(f'{output.name}: {len(font.getBestCmap())} glyphs, {output.stat().st_size} bytes')
