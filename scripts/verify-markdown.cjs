const fs=require('fs'),vm=require('vm'),assert=require('assert');
const context={window:{}};vm.createContext(context);vm.runInContext(fs.readFileSync('markdown.js','utf8'),context);
const render=context.window.blogMarkdown.render;
const html=render('| 名称 | 值 |\n| --- | ---: |\n| <script>alert(1)</script> | 12 |\n\n## 结束');
assert(html.includes('<table>'));assert(html.includes('text-align:right'));assert(!html.includes('<script>'));assert(html.includes('&lt;script&gt;'));assert(html.includes('<h2'));
assert(!render('```\n| A | B |\n| --- | --- |\n```').includes('<table>'));
assert(!render('hello | world\nno divider').includes('<table>'));
assert(render('| A | B |\n| --- | --- |\n| a\\|b | c |').includes('a|b'));
console.log('Markdown: table structure, alignment, escaping, code fences and ordinary paragraphs passed.');
