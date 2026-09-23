import { cp, mkdir, readFile, writeFile, readdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// Import a Vite build made with base: "./" into the static blog.
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
if (!process.argv[2]) throw new Error("Usage: node scripts/import-next-generation.mjs <dist-directory>");
const source = resolve(process.argv[2]);
const original = await readFile(resolve(source, "index.html"), "utf8");
const destination = resolve(root, "next-generation-letter");
await mkdir(destination, { recursive: true });
await cp(source, destination, { recursive: true });
const html = original.replace("</head>", '<link rel="stylesheet" href="./blog-navigation.css" />\n</head>')
  .replace('<button class="story-shell__button"', '<a class="story-shell__button blog-return" href="../works.html">返回作品</a>\n<button class="story-shell__button"');
if (!html.includes('class="story-shell__button blog-return"')) throw new Error("Subsite navigation not found");
await writeFile(resolve(destination, "index.html"), html);
await writeFile(resolve(destination, "blog-navigation.css"), `
.story-shell { grid-template-columns: auto auto auto; }
.blog-return { display: inline-flex; align-items: center; justify-content: center; text-decoration: none; white-space: nowrap; }
@media (max-width: 768px) {
  .story-shell { grid-template-columns: minmax(0, 1fr) auto auto; }
  .story-shell__title { max-width: calc(100vw - 245px); }
}
`);
const cover = (await readdir(resolve(source, "assets"))).find(name => /^AI_Cover_DarkLetter-768-.*\.webp$/.test(name));
if (!cover) throw new Error("Cover asset not found");
await cp(resolve(source, "assets", cover), resolve(root, "assets/next-generation-letter-cover.webp"));
console.log("Imported next-generation-letter and its cover into the blog.");
