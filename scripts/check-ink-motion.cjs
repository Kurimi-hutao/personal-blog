// Runtime regressions for preference changes and Live2D suspension. No browser or backend.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

function classes() {
  const values = new Set();
  return {
    add(...names) { names.forEach(name => values.add(name)); },
    remove(...names) { names.forEach(name => values.delete(name)); },
    contains(name) { return values.has(name); },
    toggle(name, force) { const on = force ?? !values.has(name); on ? values.add(name) : values.delete(name); return on; },
  };
}

function motionHarness({ reduced = true, observer = 'working' } = {}) {
  let change;
  const observed = new Set();
  const nodes = [];
  class Element {
    constructor() { this.classList = classes(); this.style = {}; this.finished = 0; nodes.push(this); }
    closest() { return null; }
    matches() { return true; }
    querySelectorAll() { return []; }
    getAnimations() { return [{ effect: { getTiming: () => ({ iterations: 1 }) }, finish: () => this.finished++ }]; }
  }
  class Observer {
    constructor(callback) {
      if (observer === 'broken') throw new Error('observer initialization failed');
      this.callback = callback;
    }
    observe(node) { observed.add(node); }
    unobserve(node) { observed.delete(node); }
    disconnect() { observed.clear(); }
  }
  const document = {
    readyState: 'loading', hidden: false,
    documentElement: { classList: classes() },
    addEventListener() {}, querySelector: () => null,
    querySelectorAll: selector => selector === '.motion-reveal' ? nodes : [],
  };
  const window = {
    addEventListener() {},
    matchMedia: query => ({
      matches: query.includes('prefers-reduced') ? reduced : false,
      addEventListener(type, callback) { if (query.includes('prefers-reduced')) change = callback; },
    }),
  };
  if (observer !== 'missing') window.IntersectionObserver = Observer;
  vm.runInNewContext(read('motion-core.js'), {
    window, document, navigator: {}, localStorage: { getItem: () => null },
    HTMLElement: Element, Element, IntersectionObserver: Observer,
  });
  return { core: window.MotionCore, Element, observed, setReduced: matches => change({ matches }) };
}

test('cards inserted after reduced-motion is disabled get an observer and reveal', () => {
  const h = motionHarness();
  const first = new h.Element();
  h.core.revealInserted(first);
  assert(first.classList.contains('is-visible'));
  assert.equal(h.core.state.observers.size, 0);
  h.setReduced(false);
  const next = new h.Element();
  h.core.revealInserted(next);
  assert(h.observed.has(next), 'fresh content must not depend on an observer skipped at startup');
  for (const observer of h.core.state.observers) observer.callback([{ isIntersecting: true, target: next }]);
  assert(next.classList.contains('is-visible'));
});

for (const observer of ['missing', 'broken']) {
  test(`new content stays readable when IntersectionObserver is ${observer}`, () => {
    const h = motionHarness({ reduced: false, observer });
    const node = new h.Element();
    h.core.revealInserted(node);
    assert(node.classList.contains('is-visible'));
  });
}

test('switching to reduced motion completes content entrances', () => {
  const h = motionHarness({ reduced: false });
  const node = new h.Element();
  h.core.revealInserted(node);
  h.setReduced(true);
  assert(node.classList.contains('is-visible'));
  assert.equal(node.finished, 1);
});

async function rigHarness() {
  let modelOptions;
  let updates = 0;
  let renders = 0;
  let starts = 0;
  let stops = 0;
  const model = {
    width: 100, height: 200, rotation: 0,
    anchor: { set() {} }, scale: { set() {} }, position: { set() {} },
    internalModel: { on() {}, off() {} }, update() { updates++; },
  };
  class Application {
    constructor() {
      this.stage = { addChild() {} };
      this.ticker = { add() {}, remove() {}, deltaMS: 16.67 };
      this.renderer = { render() { renders++; } };
    }
    start() { starts++; }
    stop() { stops++; }
    destroy() {}
  }
  const PIXI = { Application, live2d: { Live2DModel: { async from(url, options) { modelOptions = options; return model; } } } };
  const host = {
    clientWidth: 300, clientHeight: 500, dataset: {}, classList: classes(),
    querySelector() { return null; }, replaceChildren() {}, dispatchEvent() {},
  };
  const window = { PIXI, devicePixelRatio: 1 };
  vm.runInNewContext(read('pet-rig.js'), {
    window, PIXI,
    document: { hidden: false, createElement: () => ({ setAttribute() {} }) },
    ResizeObserver: class { observe() {} disconnect() {} }, CustomEvent: class {},
  });
  const rig = await new window.HutaoRig(host).init();
  return { rig, host, stats: () => ({ modelOptions, updates, renders, starts, stops }) };
}

test('Live2D uses one owned clock and pauses rendering when hidden', async () => {
  const h = await rigHarness();
  assert.equal(h.stats().modelOptions.autoUpdate, false, 'no separate shared Live2D ticker');
  h.rig.tick(1);
  const frames = h.rig.frame;
  h.rig.setVisible(false);
  const updates = h.stats().updates;
  h.rig.tick(1);
  assert.equal(h.rig.frame, frames);
  assert.equal(h.stats().updates, updates);
  assert.equal(h.host.dataset.motion, 'paused');
  assert(h.stats().stops > 0);
  h.rig.setVisible(true);
  h.rig.tick(1);
  assert.equal(h.rig.frame, frames + 1);
});

test('static Live2D retains a rendered character and completes interactions', async () => {
  const h = await rigHarness();
  h.rig.setMotion(false);
  let completed = 0;
  assert.equal(h.rig.play('wave', () => completed++), true);
  assert.equal(completed, 1);
  assert.equal(h.rig.action, null);
  assert(h.stats().renders > 0, 'stopping updates must leave a visible static canvas');
});
