(() => {
  'use strict';

  const media = new URL('assets/spring-ink/small/', document.currentScript.src);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const narrow = matchMedia('(max-width: 700px)');
  const layer = document.createElement('div');
  layer.className = 'blossom-field';
  layer.setAttribute('aria-hidden', 'true');
  layer.inert = true;
  layer.style.cssText = 'position:fixed;inset:0;overflow:hidden;pointer-events:none;z-index:30;contain:strict';
  document.body.append(layer);

  const range = (min, max) => min + Math.random() * (max - min);
  const pick = array => array[Math.floor(Math.random() * array.length)];
  const tau = Math.PI * 2;
  let palette;
  let loading;
  let pendingShower = false;
  let suspended = false;
  let pointer = null;
  let contactTimer = 0;

  function stopContact() {
    pointer = null;
    clearTimeout(contactTimer);
    contactTimer = 0;
  }

  function checkContact() {
    contactTimer = 0;
    if (!pointer || !motionAllowed() || suspended || document.hidden || layer.hidden) return;
    for (const leaf of layer.children) {
      const rect = leaf.getBoundingClientRect();
      const dx = rect.left + rect.width / 2 - pointer.x;
      const dy = rect.top + rect.height / 2 - pointer.y;
      if (Math.abs(dx) > rect.width / 2 + 4 || Math.abs(dy) > rect.height / 2 + 4) continue;
      if (leaf.getAnimations().some(animation => animation.id === 'petal-contact')) continue;
      const side = dx >= 0 ? 1 : -1;
      leaf.animate([
        { translate: '0 0', rotate: '0deg' },
        { translate: side * 5 + 'px -1px', rotate: side * 3 + 'deg', offset: .42 },
        { translate: '0 0', rotate: '0deg' },
      ], { id: 'petal-contact', duration: 720, easing: 'ease-in-out' });
    }
    contactTimer = setTimeout(checkContact, 80);
  }
  document.addEventListener('pointermove', event => {
    if (event.pointerType === 'touch' || layer.hidden || !motionAllowed()) return;
    pointer = {x: event.clientX, y: event.clientY};
    if (!contactTimer) checkContact();
  }, {passive: true});
  document.documentElement.addEventListener('pointerleave', stopContact);
  window.addEventListener('blur', stopContact);

  // Trim the transparent margins but retain the uneven watercolor edges.
  const washes = [
    [1, 24, 28, 94, 88], [2, 41, 33, 62, 73],
    [6, 39, 40, 70, 63], [7, 24, 30, 89, 87]
  ];
  function makeCanvas(width, height = width) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }
  function loadWash([index, x, y, width, height]) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => {
        const cropped = makeCanvas(width, height);
        cropped.getContext('2d').drawImage(image, x, y, width, height, 0, 0, width, height);
        resolve(cropped);
      };
      image.onerror = reject;
      image.src = new URL('petal-' + index + '-144.webp', media).href;
    });
  }

  function paintBlossom(wash, tilt) {
    const flower = makeCanvas(144);
    const ctx = flower.getContext('2d');
    ctx.translate(72, 72);
    ctx.rotate(tilt);
    for (let i = 0; i < 5; i++) {
      ctx.save();
      ctx.rotate(i * tau / 5 + range(-.07, .07));
      ctx.drawImage(wash, -27, -range(55, 63), range(47, 57), 64);
      ctx.restore();
    }
    const heart = ctx.createRadialGradient(0, 0, 0, 0, 0, 13);
    heart.addColorStop(0, '#973f55');
    heart.addColorStop(.4, '#b74d63c4');
    heart.addColorStop(1, '#d9647400');
    ctx.fillStyle = heart;
    ctx.fillRect(-14, -14, 28, 28);
    for (let i = 0; i < 21; i++) {
      const angle = (i + range(-.22, .22)) * tau / 21;
      const length = range(8, 18);
      const x = Math.cos(angle) * length, y = Math.sin(angle) * length;
      ctx.strokeStyle = '#a64a60cb';
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(x * .12, y * .12);
      ctx.quadraticCurveTo(x * .65 + 1.5, y * .35, x, y);
      ctx.stroke();
      ctx.fillStyle = i % 3 ? '#bb7c46' : '#ebbf80';
      ctx.beginPath();
      ctx.ellipse(x, y, 1.8, 1.25, angle, 0, tau);
      ctx.fill();
    }
    return flower;
  }

  function motionAllowed() {
    return !reduced.matches && !navigator.connection?.saveData;
  }

  function removeAll(selector) {
    for (const node of layer.querySelectorAll(selector)) {
      node.getAnimations().forEach(animation => animation.cancel());
      node.remove();
    }
  }

  function populate(count, shower) {
    const columns = narrow.matches ? 3 : 6;
    const rows = Math.ceil(count / columns);
    for (let i = 0; i < count; i++) {
      const depth = (i * 7 % 13) / 12;
      const whole = i % 5 === 1 || (shower && i % 8 === 0);
      const sprite = pick(whole ? palette.flowers : palette.petals);
      const leaf = makeCanvas(sprite.width, sprite.height);
      leaf.getContext('2d').drawImage(sprite, 0, 0);
      leaf.className = shower ? 'blossom-shower' : 'blossom-drift';
      const width = whole ? 21 + depth * 19 : 8 + depth * 14;
      leaf.style.cssText = 'position:absolute;top:0;height:auto;pointer-events:none';
      leaf.style.width = width * (shower ? 1.15 : 1) + 'px';
      leaf.style.left = (i % columns + range(.1, .9)) * 100 / columns + '%';
      if (depth < .2) leaf.style.filter = 'blur(.6px)';
      layer.append(leaf);

      const phase = range(0, tau), turn = range(-140, 140);
      const turns = range(-220, 220), sway = range(9, shower ? 48 : 28);
      const drift = (shower ? range(24, 80) : range(-15, 32)) * (depth + .5);
      const progress = (Math.floor(i / columns) + range(.15, .85)) / rows;
      // The permanent layer starts partway through each flight. The first
      // frame already contains flowers from the top edge to the bottom.
      const start = shower ? progress * 102 - 10 : -8;
      const travel = shower ? range(82, 115) : 118;
      const duration = (shower ? range(4600, 6600) : range(17500, 24500)) / (.8 + depth * .45);
      const opacity = (shower ? .54 : .36) + depth * .38;
      const frames = Array.from({length: 15}, (_, j) => {
        const t = j / 14;
        const wave = phase + t * tau * 1.55;
        const x = sway * Math.sin(wave) + drift * (t - .5);
        const roll = turn + turns * t + 26 * Math.sin(wave);
        const fold = Math.cos(phase + t * tau * 1.28) * (whole ? 42 : 69);
        const fade = shower ? Math.min(1, t * 16, (1 - t) * 6) : 1;
        return {
          transform: 'translate3d(' + x + 'px,' + (start + travel * t) + 'vh,0) rotate(' + roll + 'deg) rotateY(' + fold + 'deg)',
          opacity: opacity * fade
        };
      });
      const animation = leaf.animate(frames, {
        duration,
        delay: shower ? range(-260, 80) : -progress * duration,
        iterations: shower ? 1 : Infinity,
        easing: 'linear',
        fill: 'both'
      });
      if (shower) leaf.classList.add('manual-petal');
      if (shower) animation.onfinish = () => leaf.remove();
    }
  }

  function sync() {
    if (!motionAllowed()) {
      stopContact();
      removeAll('canvas');
      pendingShower = false;
      return;
    }
    const active = !suspended && !document.hidden && !document.documentElement.classList.contains('ink-motion-paused');
    layer.hidden = !active;
    if (!active) stopContact();
    layer.getAnimations({subtree: true}).forEach(animation => active ? animation.play() : animation.pause());
    if (!active) return;
    if (!palette) {
      if (!loading) loading = Promise.all(washes.map(loadWash)).then(petals => {
        palette = {petals, flowers: [0, .3, .7].map(tilt => paintBlossom(petals[0], tilt))};
        sync();
      }).catch(() => { loading = null; });
      return;
    }
    const sparse = narrow.matches || navigator.connection?.saveData;
    if (!layer.querySelector('.blossom-drift')) populate(sparse ? 15 : 30, false);
    if (pendingShower) {
      removeAll('.blossom-shower');
      populate(sparse ? 24 : 40, true);
      pendingShower = false;
    }
  }

  window.InkBlossoms = {summon() { pendingShower = true; sync(); }};
  new MutationObserver(sync).observe(document.documentElement, {attributes: true, attributeFilter: ['class']});
  reduced.addEventListener('change', sync);
  narrow.addEventListener('change', () => { removeAll('canvas'); sync(); });
  document.addEventListener('visibilitychange', sync);
  window.addEventListener('pagehide', () => { suspended = true; sync(); });
  window.addEventListener('pageshow', () => { suspended = false; sync(); });
  sync();
})();
