(() => {
  'use strict';
  const root = document.documentElement;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const compact = matchMedia('(max-width: 700px)');
  const controls = 'a, button:enabled, summary';
  const quiet = 'input, textarea, select, label, [contenteditable=true], video, iframe, dialog';
  const layer = document.createElement('div');
  layer.className = 'ink-particles';
  layer.setAttribute('aria-hidden', 'true');
  layer.inert = true;
  layer.style.cssText = 'position:fixed;inset:0;overflow:hidden;pointer-events:none;z-index:31;contain:strict';
  document.body.append(layer);
  root.classList.add('has-ink-particles');

  const rand = (min, max) => min + Math.random() * (max - min);
  const masks = [];
  const fleeting = new Set();
  const ambient = new Set();
  let active = false;
  let pageVisible = true;
  let lastTrail = null;
  let lastStroke = 0;

  // Paint the artwork once. Reusing alpha masks lets the site's ink colour
  // change with the paper, including halfway through a stroke.
  function makeMask(brush) {
    const canvas = document.createElement('canvas');
    canvas.width = brush ? 160 : 112;
    canvas.height = brush ? 36 : 112;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';
    if (brush) {
      for (let i = 0; i < 76; i++) {
        const y = rand(-10, 10);
        const end = rand(102, 154) - Math.abs(y) * 3;
        ctx.beginPath();
        ctx.moveTo(rand(3, 32), 20 + y * .25);
        ctx.quadraticCurveTo(70, 12 + y, end, 17 + y * .45);
        ctx.strokeStyle = 'rgba(0,0,0,' + rand(.08, .34) + ')';
        ctx.lineWidth = rand(.45, 1.45);
        ctx.stroke();
      }
    } else {
      // Transparent washes share a ragged capillary edge. Small detached
      // satellite drops keep the silhouette broken as the mark diffuses.
      const radii = Array.from({length: 52}, (_, i) =>
        25 + Math.cos(i * .36) * 3.4 + Math.sin(i * .6) * 3 + rand(-2.3, 2.3));
      for (let pass = 0; pass < 7; pass++) {
        ctx.fillStyle = 'rgba(0,0,0,' + (.09 + pass * .018) + ')';
        ctx.beginPath();
        radii.forEach((r, i) => {
          const angle = 2 * Math.PI * i / radii.length;
          const radius = (r + rand(-1.5, 1.5)) * (1 - pass * .075);
          const x = 50 + Math.cos(angle) * radius + pass * .4;
          const y = 56 + Math.sin(angle) * radius * .9;
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        });
        ctx.closePath();
        ctx.fill();
      }
      for (let i = 0; i < 16; i++) {
        const a = rand(0, Math.PI * 2), r = rand(27, 48);
        ctx.beginPath();
        ctx.ellipse(50 + Math.cos(a) * r, 56 + Math.sin(a) * r,
          rand(.8, 3.7), rand(.6, 2.3), a, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0,0,0,' + rand(.18, .8) + ')';
        ctx.fill();
      }
    }
    return 'url(' + canvas.toDataURL() + ')';
  }

  function mark(brush, x, y, size, color) {
    const el = document.createElement('i');
    const mask = brush ? masks[3] : masks[Math.floor(rand(0, 3))];
    Object.assign(el.style, {
      position: 'absolute', left: x + 'px', top: y + 'px',
      width: size + 'px', height: size * (brush ? .225 : 1) + 'px',
      background: color, maskImage: mask, webkitMaskImage: mask,
      maskSize: '100% 100%', webkitMaskSize: '100% 100%', pointerEvents: 'none'
    });
    layer.append(el);
    return el;
  }

  function animateMark(el, frames, options, pool) {
    const animation = el.animate(frames, options);
    const remove = () => { pool.delete(animation); el.remove(); };
    animation.onfinish = animation.oncancel = remove;
    pool.add(animation);
  }

  // Leave open paper between clusters. Seed the whole sheet immediately,
  // then let each cluster drift on a different phase.
  function seed() {
    const columns = compact.matches ? 2 : 3;
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < columns; col++) {
        const x = (col + rand(.09, .91)) * innerWidth / columns;
        const y = (row + rand(.1, .9)) * innerHeight / 4;
        const size = rand(8, 19);
        const el = mark(false, x, y, size, col === 1 ? 'var(--cinnabar)' : 'var(--ink)');
        el.style.left = x / innerWidth * 100 + '%';
        el.style.top = y / innerHeight * 100 + '%';
        const tilt = rand(-60, 60);
        const duration = rand(7000, 12800);
        animateMark(el, [
          {transform: 'translate(0,12px) rotate(' + tilt + 'deg)', opacity: 0},
          {transform: 'translate(6px,0) rotate(' + (tilt + 12) + 'deg)', opacity: .33, offset: .36},
          {transform: 'translate(19px,-16px) rotate(' + (tilt + 25) + 'deg)', opacity: .16, offset: .77},
          {transform: 'translate(17px,-24px) rotate(' + (tilt + 28) + 'deg)', opacity: 0}
        ], {duration, iterations: Infinity, delay: -rand(.15, .87) * duration}, ambient);
      }
    }
  }

  function sync() {
    const motionOn = !reduced.matches && !root.classList.contains('ink-motion-paused');
    const allowed = pageVisible && !document.hidden && motionOn &&
      !navigator.connection?.saveData && !document.querySelector('dialog[open]');
    if (active === allowed) return;
    active = allowed;
    layer.hidden = !active;
    if (active) {
      if (!masks.length) masks.push(makeMask(false), makeMask(false), makeMask(false), makeMask(true));
      seed();
    } else {
      for (const animation of [...ambient, ...fleeting]) animation.cancel();
      ambient.clear();
      fleeting.clear();
      layer.replaceChildren();
      lastTrail = null;
    }
  }

  function trace(x, y, size, angle, brush, color, travel, strength) {
    if (fleeting.size >= 28) return;
    const el = mark(brush, x, y, size, color);
    const base = 'translate(-50%,-50%) rotate(' + angle + 'rad) ';
    animateMark(el, [
      {transform: base + 'scale(.52,.6)', opacity: strength},
      {transform: base + 'translateX(' + travel * .65 + 'px) scale(.93,.96)', opacity: strength * .77, offset: .32},
      {transform: base + 'translateX(' + travel + 'px) scale(1.15,1.12)', opacity: 0}
    ], {duration: brush ? 710 : 980, easing: 'cubic-bezier(.2,.65,.32,1)'}, fleeting);
  }

  function splash(x, y) {
    trace(x, y, rand(40, 50), rand(-1, 1), false, 'var(--ink)', 1, .73);
    const direction = rand(-Math.PI, Math.PI);
    for (let i = 0; i < 7; i++) {
      const a = direction + rand(-1.4, 1.4), r = rand(8, 24);
      trace(x + Math.cos(a) * r, y + Math.sin(a) * r, rand(6, 16), a,
        false, i === 0 ? 'var(--cinnabar)' : 'var(--ink)', rand(9, 31), .79);
    }
  }

  document.addEventListener('click', event => {
    if (!active || event.button !== 0 || event.detail === 0 || event.target.closest(quiet + ', ' + controls) ||
        window.getSelection()?.type === 'Range') return;
    splash(event.clientX, event.clientY);
  }, {passive: true});

  document.addEventListener('pointermove', event => {
    if (!active || event.pointerType === 'touch' || event.buttons || event.target.closest(quiet)) {
      lastTrail = null;
      return;
    }
    const now = performance.now();
    const {clientX: x, clientY: y} = event;
    if (lastTrail && now - lastTrail.time < 220) {
      const dx = x - lastTrail.x, dy = y - lastTrail.y, distance = Math.hypot(dx, dy);
      if (distance < 19 || now - lastTrail.time < 58) return;
      if (distance < 100) trace(x - dx * .35, y - dy * .35, Math.min(38, distance),
        Math.atan2(dy, dx), true, 'var(--ink)', -4, .44);
    }
    lastTrail = {x, y, time: now};
  }, {passive: true});

  function accent(element) {
    if (!active || !element || element.closest(quiet) || performance.now() - lastStroke < 140) return;
    lastStroke = performance.now();
    const r = element.getBoundingClientRect();
    const x = r.left + Math.min(r.width * .45, 42);
    const y = Math.min(innerHeight - 6, r.bottom - 3);
    trace(x, y, Math.min(77, r.width * .8), -.055, true, 'var(--cinnabar)', 8, .73);
    trace(x + 18, y - 3, 11, -.12, false, 'var(--ink)', 8, .54);
  }
  document.addEventListener('pointerover', event => {
    const el = event.target.closest(controls);
    if (event.pointerType !== 'touch' && el && !el.contains(event.relatedTarget)) accent(el);
  }, {passive: true});
  document.addEventListener('focusin', event => {
    if (event.target.matches(':focus-visible')) accent(event.target.closest(controls));
  });

  new MutationObserver(sync).observe(root, {attributes: true, attributeFilter: ['class']});
  const dialogs = new MutationObserver(sync);
  document.querySelectorAll('dialog').forEach(dialog => dialogs.observe(dialog, {attributes: true, attributeFilter: ['open']}));
  reduced.addEventListener('change', sync);
  navigator.connection?.addEventListener('change', sync);
  document.addEventListener('visibilitychange', sync);
  window.addEventListener('pagehide', () => { pageVisible = false; sync(); });
  window.addEventListener('pageshow', () => { pageVisible = true; sync(); });
  sync();
})();
