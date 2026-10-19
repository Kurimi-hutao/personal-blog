// Portable regression checks: node --test scripts/check-motion-lifecycle.cjs
// No network, CloudBase credentials or Windows-only Playwright path required.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');

test('all blog pages reference the updated loader and home scripts', () => {
  for (const page of ['404.html', 'admin.html', 'article.html', 'articles.html',
    'index.html', 'kurumi.html', 'pet.html', 'videos.html', 'works.html']) {
    assert.match(read(page), /lottie-core\.js\?v=20261019-perf-1/, page);
  }
  assert.match(read('index.html'), /script\.js\?v=\d{8}-[a-z0-9-]+/);
  for (const name of ['lottie-core.js', 'script.js', 'service-worker.js']) {
    new vm.Script(read(name), { filename: name });
  }
});

test('ink loading appears once per tab, and never animates for reduced motion', async () => {
  const state = new Map();
  let displays = 0;
  async function visit(reduced) {
    const makeNode = () => ({
      classList: { add() {}, remove() {} },
      setAttribute() {}, addEventListener() {}, remove() {},
      querySelector: () => ({ decode: async () => {} }),
      innerHTML: '',
    });
    const document = {
      body: { prepend() { displays++; } },
      createElement: makeNode,
      documentElement: { classList: { add() {}, remove() {} } },
      currentScript: { src: 'https://example.test/lottie-core.js' },
      baseURI: 'https://example.test/',
      addEventListener() {},
      images: [],
    };
    const sessionStorage = {
      getItem: k => state.get(k) || null,
      setItem: (k, v) => state.set(k, v),
    };
    const window = {
      matchMedia: () => ({ matches: reduced, addEventListener() {} }),
      setTimeout, clearTimeout, sessionStorage, innerHeight: 900,
    };
    vm.runInNewContext(read('lottie-core.js'), {
      window, document, sessionStorage, URL, setTimeout, clearTimeout,
      requestAnimationFrame: cb => cb(),
    });
    await window.InkLottie.loaded;
  }
  await visit(false);
  assert.equal(displays, 1, 'first visit');
  await visit(false);
  assert.equal(displays, 1, 'second navigation in same tab');
  state.clear();
  await visit(true);
  assert.equal(displays, 1, 'reduced-motion visit');
});

test('station rapid toggling settles correctly and footer collapse restores focus', async () => {
  const source = read('script.js');
  const begin = source.indexOf('function setupLinksToggle() {');
  const end = source.indexOf('\nif (hasGsap) {', begin);
  assert(begin >= 0 && end > begin);
  const handlers = {};
  const attributes = {};
  let focused = false;
  const button = {
    textContent: '',
    setAttribute(k, v) { attributes[k] = v; },
    addEventListener(k, fn) { handlers[k] = fn; },
    focus() { focused = true; },
    scrollIntoView() {},
  };
  const panel = {
    hidden: true, inert: false, scrollHeight: 300, fakeHeight: 0,
    style: { removeProperty() {} },
    querySelectorAll: () => [],
    getBoundingClientRect() { return { height: this.fakeHeight }; },
    animate(frames) {
      this.fakeHeight = parseFloat(frames[1].height);
      return { cancel() {}, finished: Promise.resolve() };
    },
  };
  const section = { classList: { toggle() {} } };
  const bottom = { addEventListener(k, fn) { handlers.bottom = fn; } };
  const document = {
    querySelector: q => ({
      '.links-section': section, '#linksToggle': button,
      '#linksCollapsible': panel, '#linksCollapseBottom': bottom,
    })[q] || null,
  };
  vm.runInNewContext(source.slice(begin, end) + '\nsetupLinksToggle();', {
    document, reducedMotion: false,
  });
  handlers.click(); handlers.click(); handlers.click();
  for (let n = 0; n < 8; n++) await Promise.resolve();
  assert.equal(attributes['aria-expanded'], 'true');
  assert.equal(panel.hidden, false);
  handlers.bottom();
  for (let n = 0; n < 8; n++) await Promise.resolve();
  assert.equal(attributes['aria-expanded'], 'false');
  assert.equal(panel.hidden, true);
  assert.equal(focused, true);
});

test('worker prefers fresh scripts online and exact cached scripts offline', async () => {
  const listeners = {};
  const responses = {
    fresh: { label: 'fresh', ok: true, type: 'basic', clone() { return this; } },
    cached: { label: 'cached', ok: true, type: 'basic', clone() { return this; } },
  };
  const entries = new Map();
  const caches = {
    open: async () => ({
      match: async request => entries.get(typeof request === 'string' ? request : request.url),
      put: async (request, response) => { entries.set(request.url, response); },
    }),
  };
  let offline = false;
  let requests = 0;
  const fetch = async () => {
    requests++;
    if (offline) throw Error('offline');
    return responses.fresh;
  };
  const self = {
    location: { origin: 'https://example.test' },
    addEventListener: (type, fn) => { listeners[type] = fn; },
  };
  vm.runInNewContext(read('service-worker.js'), {
    self, caches, fetch, URL, Response: { error: () => ({ label: 'error' }) },
  });
  const url = 'https://example.test/site.js?v=20261017-motion-1';
  async function request(destination) {
    const pending = [];
    let result;
    const request = {
      url, method: 'GET', destination, mode: 'cors',
      headers: { has: () => false },
    };
    listeners.fetch({
      request,
      waitUntil(promise) { pending.push(promise); },
      respondWith(promise) { result = promise; },
    });
    const response = await result;
    await Promise.all(pending);
    return response;
  }
  entries.set(url, responses.cached);
  assert.equal((await request('script')).label, 'fresh');
  assert.equal(requests, 1, 'online scripts bypass stale cache');
  entries.set(url, responses.cached);
  offline = true;
  assert.equal((await request('style')).label, 'cached');
  requests = 0;
  assert.equal((await request('image')).label, 'cached');
  assert.equal(requests, 0, 'cached artwork skips network');
});
