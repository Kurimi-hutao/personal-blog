import test from 'node:test';
import assert from 'node:assert/strict';
import {replaceSlot} from './html-slots.mjs';
test('nested cards and siblings are replaced completely without truncating the document', () => {
 const html='<main><div id="feed"><article><div><div>old</div></div><p>placeholder</p></article><article>second placeholder</article></div><section id="next">Keep me</section></main>';
 assert.equal(replaceSlot(html,'feed','<a>Real content</a>'),'<main><div id="feed"><a>Real content</a></div><section id="next">Keep me</section></main>');
 assert.throws(()=>replaceSlot(html,'absent',''));
 assert.throws(()=>replaceSlot('<div id="x"></div><div id="x"></div>','x',''));
});
