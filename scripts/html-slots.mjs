import { parse } from 'parse5';

// Preserve source formatting; use the HTML parser's element boundaries, never
// the first closing tag (which may belong to a nested card or image wrapper).
export function replaceSlot(html, id, content, {outer = false} = {}) {
  const document = parse(html, {sourceCodeLocationInfo: true});
  const matches = [];
  function walk(node) {
    if (node.attrs?.some(a => a.name === 'id' && a.value === id)) matches.push(node);
    for (const child of node.childNodes || []) walk(child);
  }
  walk(document);
  if (matches.length !== 1) throw new Error(`Expected one HTML slot: ${id}; found ${matches.length}`);
  const loc = matches[0].sourceCodeLocation;
  if (!loc?.startTag || !loc?.endTag) throw new Error(`HTML slot has no explicit closing tag: ${id}`);
  const start = outer ? loc.startOffset : loc.startTag.endOffset;
  const end = outer ? loc.endOffset : loc.endTag.startOffset;
  return html.slice(0, start) + content + html.slice(end);
}
