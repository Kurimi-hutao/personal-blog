(function () {
  'use strict';
  const compact = matchMedia('(max-width:900px)');
  const reduced = matchMedia('(prefers-reduced-motion:reduce)');
  const scenes = new Set();
  let suspended = false;
  const random = (a,b) => a + Math.random() * (b-a);
  const active = scene => compact.matches && !reduced.matches && !document.hidden && !suspended && scene.visible && !document.body.classList.contains('mobile-nav-open') && !document.querySelector('dialog[open]');

  function sync(scene) {
    const playing = active(scene);
    scene.root.dataset.motion = playing ? 'playing' : 'paused';
    scene.animations.forEach(animation => playing ? animation.play() : animation.pause());
  }
  function refresh() { scenes.forEach(sync); }
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      const scene = [...scenes].find(item => item.host === entry.target);
      if (scene) { scene.visible = entry.isIntersecting; sync(scene); }
    });
  },{threshold:0});

  function mount(host) {
    const root = document.createElement('div');
    root.className = 'mobile-peach-garden'; root.setAttribute('aria-hidden','true'); root.inert = true;
    const branch = document.createElement('img');
    branch.className = 'mobile-peach-branch'; branch.src = './assets/mobile-botanicals/peach-branch.svg';
    branch.alt = ''; branch.width = 520; branch.height = 300; branch.decoding = 'async'; branch.draggable = false;
    const fall = document.createElement('div'); fall.className = 'mobile-peach-fall';
    root.append(branch,fall); host.classList.add('mobile-peach-host'); host.prepend(root);
    const scene = {host,root,animations:[],visible:false}; scenes.add(scene);
    // Animate only transforms and opacity. Four reusable petals keep the DOM bounded.
    // The native Web Animations API also works on pages without the home GSAP bundle.
    if (typeof branch.animate === 'function') {
      scene.animations.push(branch.animate([
        {transform:'rotate(-.65deg) translate(0,0)'},
        {transform:'rotate(.35deg) translate(-.5px,1px)',offset:.32},
        {transform:'rotate(.05deg) translate(0,.4px)',offset:.47},
        {transform:'rotate(.8deg) translate(-1px,1.5px)',offset:.73},
        {transform:'rotate(-.65deg) translate(0,0)'}
      ],{duration:9200,iterations:Infinity,easing:'cubic-bezier(.45,0,.55,1)'}));
      const distance = Math.min(host.clientHeight,host.classList.contains('hero') ? 300 : 180);
      for (let i=0;i<4;i++) {
        const petal=document.createElement('i'); petal.className='mobile-peach-petal'; fall.append(petal);
        const x=-random(24,110), y=random(28,58), drift=random(44,92), turn=random(90,210), size=random(.65,1);
        scene.animations.push(petal.animate([
          {transform:`translate(${x}px,${y}px) rotate(-20deg) scale(${size})`,opacity:0},
          {transform:`translate(${x-8}px,${y+12}px) rotate(0deg) scale(${size})`,opacity:.7,offset:.1},
          {transform:`translate(${x-drift*.35}px,${y+distance*.38}px) rotate(${turn*.35}deg) scale(${size},${size*.65})`,opacity:.65,offset:.45},
          {transform:`translate(${x-drift*.7+12}px,${y+distance*.68}px) rotate(${turn*.7}deg) scale(${size*.75},${size})`,opacity:.5,offset:.72},
          {transform:`translate(${x-drift}px,${y+distance}px) rotate(${turn}deg) scale(${size})`,opacity:0}
        ],{duration:random(8500,12000),delay:i*2300,iterations:Infinity,easing:'linear'}));
      }
    }
    sync(scene); observer.observe(host);
  }
  function reconcile() {
    scenes.forEach(scene => {
      if (scene.host.isConnected) return;
      observer.unobserve(scene.host); scene.animations.forEach(a=>a.cancel()); scenes.delete(scene);
    });
    if (!compact.matches) {
      scenes.forEach(scene => { observer.unobserve(scene.host); scene.animations.forEach(a=>a.cancel()); scene.root.remove(); scene.host.classList.remove('mobile-peach-host'); });
      scenes.clear(); return;
    }
    document.querySelectorAll('.home-page .hero,[data-page="articles"] .scene-banner,.works-page .scene-banner,.article-detail-header').forEach(host => {
      if (!host.querySelector('.mobile-peach-garden')) mount(host);
    });
    refresh();
  }
  // Article headers arrive asynchronously after the published record loads.
  const article = document.querySelector('#articleDetail');
  if (article) new MutationObserver(reconcile).observe(article,{childList:true});
  compact.addEventListener('change',reconcile);
  reduced.addEventListener('change',refresh);
  document.addEventListener('visibilitychange',refresh);
  document.addEventListener('mobile-navigation-change',refresh);
  new MutationObserver(refresh).observe(document.body,{attributes:true,attributeFilter:['class']});
  new MutationObserver(records => { if(records.some(r=>r.target.matches('dialog'))) refresh(); }).observe(document.body,{attributes:true,subtree:true,attributeFilter:['open']});
  window.addEventListener('pagehide',()=>{suspended=true;refresh();});
  window.addEventListener('pageshow',()=>{suspended=false;refresh();});
  reconcile();
}());
