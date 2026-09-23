"""Build a clean static upload package for joestarzhang.cn."""
from datetime import datetime
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit, unquote
import hashlib
import json
import re
import shutil
import zipfile

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "outputs" / ("deployment-" + datetime.now().strftime("%Y%m%d-%H%M%S"))
SITE = OUT / "website"
SITE.mkdir(parents=True)
for path in ROOT.iterdir():
    if path.is_file() and (path.suffix in {".html", ".css", ".js", ".webmanifest"} or path.name in {"robots.txt", "sitemap.xml", "rss.xml", ".nojekyll"}):
        shutil.copy2(path, SITE / path.name)
for name in ("assets", "next-generation-letter"):
    shutil.copytree(ROOT / name, SITE / name)

# The repository ships WOFF2 fonts only; remove absent legacy fallbacks.
font_css = SITE / "assets/vendor/katex/katex-0.16.22.min.css"
font_css.write_text(re.sub(r',url\(fonts/[^)]+\.(?:woff|ttf)\) format\("(?:woff|truetype)"\)', '', font_css.read_text(encoding="utf-8")), encoding="utf-8")

domain = "https://joestarzhang.cn"
for name in ("robots.txt", "sitemap.xml", "rss.xml"):
    path = SITE / name
    content = path.read_text(encoding="utf-8").replace("https://kurimi-hutao.github.io/personal-blog", domain)
    if name == "sitemap.xml":
        content = content.replace("</urlset>", f"  <url><loc>{domain}/works.html</loc></url>\n  <url><loc>{domain}/next-generation-letter/</loc></url>\n</urlset>")
    path.write_text(content, encoding="utf-8")

# A custom 404 can be served at a nested URL: resolve its assets at the site root.
path = SITE / "404.html"
path.write_text(path.read_text(encoding="utf-8").replace("<head>", '<head>\n    <base href="/" />'), encoding="utf-8")
path = SITE / "next-generation-letter/404.html"
path.write_text('''<!doctype html>
<html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>页面未找到 | 下一代，来信了</title></head><body>
<h1>这页信还未找到</h1><p><a href="/next-generation-letter/">返回《下一代，来信了》</a></p>
<p><a href="/works.html">返回作品卷宗</a></p></body></html>
''', encoding="utf-8")

missing = set()
checked = set()
def check_ref(file, ref, base=None):
    ref = ref.strip()
    if not ref or ref.startswith(("#", "data:", "blob:", "//")):
        return
    url = urlsplit(ref)
    if url.scheme or url.netloc or not url.path:
        return
    relative = unquote(url.path)
    target = SITE / relative.lstrip("/") if relative.startswith("/") else (base or file.parent) / relative
    target = target.resolve()
    checked.add(str(target))
    if not target.exists():
        missing.add((str(file.relative_to(SITE)), ref))

class Refs(HTMLParser):
    def __init__(self, file):
        super().__init__()
        self.file = file
        self.base = SITE if file.name == "404.html" and file.parent == SITE else None
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        for name in ("href", "src", "poster"):
            if name in attrs:
                check_ref(self.file, attrs[name], self.base)

for file in SITE.rglob("*"):
    if file.suffix == ".html":
        Refs(file).feed(file.read_text(encoding="utf-8"))
    elif file.suffix == ".css":
        for match in re.finditer(r'''url\(\s*(?:"([^"]*)"|'([^']*)'|([^)]*))\s*\)''', file.read_text(encoding="utf-8")):
            check_ref(file, next(value for value in match.groups() if value is not None))
if missing:
    raise RuntimeError("Missing static resources: " + json.dumps(sorted(missing), ensure_ascii=False))

files = sorted(p for p in SITE.rglob("*") if p.is_file())
archive = OUT / "joestarzhang-cn-upload.zip"
with zipfile.ZipFile(archive, "w", zipfile.ZIP_DEFLATED, compresslevel=6) as z:
    for file in files:
        z.write(file, file.relative_to(SITE).as_posix())
with zipfile.ZipFile(archive) as z:
    assert "index.html" in z.namelist()
    assert "next-generation-letter/index.html" in z.namelist()
    assert z.testzip() is None

report = {
    "files": len(files),
    "uncompressed_mb": round(sum(p.stat().st_size for p in files) / 1024**2, 2),
    "zip_mb": round(archive.stat().st_size / 1024**2, 2),
    "static_reference_targets_checked": len(checked),
    "missing_static_references": [],
    "sha256": hashlib.sha256(archive.read_bytes()).hexdigest(),
}
(OUT / "verification.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
(OUT / "上传说明.txt").write_text('''水墨博客 +《下一代，来信了》上传说明

上传 joestarzhang-cn-upload.zip，或上传 website 文件夹里面的全部内容。
不要把 website 文件夹本身作为网站根目录的子文件夹上传。
压缩包解压后根目录直接是 index.html，无需安装依赖或执行构建。

默认首页：index.html
错误页面：404.html
域名：joestarzhang.cn
请启用目录首页，让 /next-generation-letter/ 对应 /next-generation-letter/index.html。
请勿将所有路径重写到博客首页，这是多页面网站。

上线后检查：
https://joestarzhang.cn/
https://joestarzhang.cn/works.html
https://joestarzhang.cn/next-generation-letter/

已包含后台页面、公开 Supabase 配置、博客素材和子站运行资源。
文章、登录、评论等服务仍连接原 Supabase 项目；部署包不迁移数据库。
站点地图及 RSS 已使用新域名；子站错误页已取消跳转到 GitHub。
已排除下载目录、源码 ZIP、测试输出、开发脚本、SQL 文件和 Cloudflare Worker 源码。
verification.json 和本说明仅供本地核对，无需上传。
''', encoding="utf-8")
print(json.dumps({"output": str(OUT), **report}, ensure_ascii=False, indent=2))
