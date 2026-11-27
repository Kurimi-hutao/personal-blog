(() => {
  const $ = s => document.querySelector(s);
  const all = s => [...document.querySelectorAll(s)];
  const icons = {
    search:'<circle cx="10" cy="10" r="6.5"/><path d="m15 15 5 5"/>',
    sliders:'<path d="M3 7h8m5 0h5M3 17h3m5 0h10"/><circle cx="13.5" cy="7" r="2.5"/><circle cx="8.5" cy="17" r="2.5"/>',
    play:'<path d="m6 3 14 9-14 9z" fill="currentColor" stroke="none"/>',bookmark:'<path d="M6 3h12v18l-6-4-6 4z"/>',
    clock:'<circle cx="12" cy="12" r="8.5"/><path d="M12 6v6l4 2"/>',prev:'<path d="m14.5 5-7 7 7 7"/>',next:'<path d="m9 5 7 7-7 7"/>',up:'<path d="m5 13 7-7 7 7m-7-7v14"/>',x:'<path d="m5 5 14 14m0-14L5 19"/>'
  };
  all('[data-icon]').forEach(el => {el.innerHTML='<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">'+icons[el.dataset.icon]+'</svg>';});
  const films = [
    {lines:['用数学，','读懂世界。'],title:'牛顿的数学世界',latin:'Isaac Newton',copy:'苹果落向地面，月亮绕着地球。牛顿用同一条定律，解释了两种看似无关的运动。',caption:'艾萨克·牛顿',date:'1643–1727',time:'01:20',image:'newton-cover',bvid:'BV1V2J16ME7Z'},
    {lines:['冰下的','中微子。'],title:'冰下的中微子',latin:'IceCube',copy:'南极冰层深处，光学传感器等待一束微弱的蓝光。从这点光开始，追踪一颗来自远方的粒子。',caption:'冰立方中微子观测站',time:'05:14',image:'icecube',bvid:'BV1Urp26gEky'},
    {lines:['质量与','能量。'],title:'爱因斯坦质能公式',latin:'Mass & Energy',copy:'一个物体安静地停在桌上，也有能量。跟随这段短片，重新读一遍熟悉的 E = mc²。',caption:'爱因斯坦质能公式',image:'einstein',video:'https://uhcmzlhzrgyjnvqnnpss.supabase.co/storage/v1/object/public/video-assets/35bd70b7-54c4-4238-b583-e4fbcd2fea52/b3e68761-a6da-42aa-9492-45037c65b778-EinsteinTheoryIntro.mp4'}
  ];
  const get = (key,fallback) => { try{return JSON.parse(localStorage.getItem('ink-preview.'+key)) ?? fallback;}catch{return fallback;} };
  const put = (key,value) => {try{localStorage.setItem('ink-preview.'+key,JSON.stringify(value));}catch{}};
  let chosen=0, saved = new Set(get('saved',[])), statusTimer;
  function notice(text){$('#status').textContent=text;clearTimeout(statusTimer);statusTimer=setTimeout(()=>$('#status').textContent='',2000);}
  function updateSaved(){const on=saved.has(chosen);$('#save').setAttribute('aria-pressed',on);$('#save span').textContent=on?'已收藏':'收藏';}
  function pick(index){
    chosen=(index+films.length)%films.length;
    const film=films[chosen];
    $('#film-title').replaceChildren(film.lines[0],document.createElement('br'),film.lines[1]);
    $('#latin-title').textContent=film.latin;$('#film-copy').textContent=film.copy;
    const dates=document.createElement('span'); dates.className='caption-dates';dates.textContent=film.date||'';
    $('#plate-caption').replaceChildren(film.caption,dates);
    $('.duration').style.display=film.time?'':'none';$('#time').textContent=film.time||'';
    $('#book-art').hidden=chosen!==0;$('#feature-img').hidden=chosen===0;$('#feature-img').src='media/'+film.image+'.webp';$('#feature-img').alt=film.title+'视频封面';
    $('#art-open').setAttribute('aria-label','观看《'+film.title+'》');$('#page-no').textContent='0'+(chosen+1)+' / 03';
    all('[data-film]').forEach((b,i)=>b.setAttribute('aria-pressed',i===chosen));updateSaved();
    $('#plate').classList.remove('reveal-film');void $('#plate').offsetWidth;$('#plate').classList.add('reveal-film');
  }
  function chooseFromList(index){
    pick(index);
    if(matchMedia('(max-width:760px)').matches) $('#screen').scrollIntoView();
  }
  all('[data-film]').forEach((b,i)=>b.onclick=()=>chooseFromList(i));
  $('#prev').onclick=()=>chooseFromList(chosen-1);
  $('#next').onclick=()=>chooseFromList(chosen+1);
  $('#save').onclick=()=>{if(saved.has(chosen))saved.delete(chosen);else saved.add(chosen);put('saved',[...saved]);updateSaved();};updateSaved();
  let returnFocus;
  function openDialog(d,trigger){returnFocus=trigger;d.showModal();}
  all('dialog').forEach(d=>{
    d.querySelector('.close').onclick=()=>d.close();
    d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();}});
    d.addEventListener('close',()=>{returnFocus?.focus({preventScroll:true});if(d.id==='player')$('#video-stage').replaceChildren();});
  });
  function play(e){
    const f=films[chosen];$('#play-title').textContent=f.title;
    const el=document.createElement(f.bvid?'iframe':'video');
    if(f.bvid){el.title=f.title;el.src='https://player.bilibili.com/player.html?bvid='+f.bvid+'&autoplay=0&high_quality=1';el.allow='fullscreen; picture-in-picture';el.allowFullscreen=true;}else{el.controls=true;el.playsInline=true;el.src=f.video;el.poster='media/einstein.webp';}
    $('#watch-source').href=f.bvid?'https://www.bilibili.com/video/'+f.bvid+'/':'https://joestarzhang.cn/article--einsteintheoryintro.html';$('#video-stage').replaceChildren(el);openDialog($('#player'),e.currentTarget);
  }
  $('#watch').onclick=play;$('#art-open').onclick=play;
  const input=$('#find input');
  function renderSearch(){
    const term=input.value.trim().toLowerCase();const rows=[];
    films.forEach((f,i)=>rows.push({title:f.title,type:'短片',keywords:[f.latin,f.copy].join(' '),act:()=>{pick(i);$('#screen').scrollIntoView();}}));
    all('.folio-lessons a').forEach(a=>rows.push({title:a.querySelector('b').textContent,type:'课程',keywords:a.textContent,href:a.href}));
    for(const [label,id] of [['课程手记','course'],['视频平台','platforms'],['卷后留评','notes']]) rows.push({title:label,type:'栏目',keywords:id,act:()=>document.getElementById(id).scrollIntoView()});
    const list=$('.search-list');list.replaceChildren();
    rows.filter(r=>(r.title+' '+r.keywords).toLowerCase().includes(term)).forEach(r=>{
      const el=document.createElement(r.href?'a':'button');el.append(r.title);const small=document.createElement('small');small.textContent=r.type;el.append(small);if(r.href)el.href=r.href;
      el.onclick=()=>{$('#find').close();r.act?.();};list.append(el);
    });
    if(!list.children.length){const p=document.createElement('p');p.textContent='没有找到相关内容，换个词试试。';list.append(p);}
  }
  function search(){input.value='';renderSearch();openDialog($('#find'),$('#search-open'));input.focus();}
  $('#search-open').onclick=search;input.oninput=renderSearch;
  input.onkeydown=e=>{if(e.key==='Escape'&&!e.isComposing){e.preventDefault();$('#find').close();}if(e.key==='Enter'&&!e.isComposing){e.preventDefault();$('.search-list button,.search-list a')?.click();}};
  document.addEventListener('keydown',e=>{if(e.key==='/'&&!document.querySelector('dialog[open]')&&!e.target.closest('input,textarea,[contenteditable=true]')){e.preventDefault();search();}});
  $('#prefs-open').onclick=()=>openDialog($('#prefs'),$('#prefs-open'));
  const root=document.documentElement;
  function theme(value){root.dataset.theme=value;$('#theme-switch').textContent=value==='night'?'切换为日间':'切换为夜间';put('theme',value);}
  function motion(value){root.dataset.motion=value;$('#motion-switch').textContent=value==='on'?'已开启':'已暂停';$('#motion-switch').setAttribute('aria-pressed',value==='on');put('motion',value);}
  theme(get('theme','night'));motion(get('motion',matchMedia('(prefers-reduced-motion: reduce)').matches?'off':'on'));
  $('#theme-switch').onclick=()=>theme(root.dataset.theme==='night'?'day':'night');$('#motion-switch').onclick=()=>motion(root.dataset.motion==='on'?'off':'on');
  $('#petals').onclick=()=>{$('#prefs').close();if(root.dataset.motion==='off'){notice('桃花已至 · 动效已暂停');return;}for(let i=0;i<10;i++){const petal=document.createElement('i');petal.className='petal';petal.style.left=(5+Math.random()*85)+'%';petal.style.animationDelay=(Math.random()*.55)+'s';document.body.append(petal);setTimeout(()=>petal.remove(),3300);}};
  $('#back-top').onclick=()=>window.scrollTo({top:0,behavior:root.dataset.motion==='on'?'smooth':'instant'});
  const nav=all('.mast nav a');
  function markNav(){let active=nav[0];for(const a of nav){const y=document.querySelector(a.hash).getBoundingClientRect().top;if(y<innerHeight*.36 && (Math.abs(y-document.querySelector(active.hash).getBoundingClientRect().top)>2 || a.hash===location.hash)) active=a;}nav.forEach(a=>a===active?a.setAttribute('aria-current','location'):a.removeAttribute('aria-current'));}
  window.addEventListener('scroll',markNav,{passive:true});
  // Compact scientific illustrations printed on the programme and title leaf.
  all('[data-plot]').forEach(canvas=>{
    const ctx=canvas.getContext('2d'),kind=canvas.dataset.plot,w=canvas.width,h=canvas.height;
    if(kind==='orbit'){
      ctx.strokeStyle='#665236';ctx.lineWidth=1.6;ctx.beginPath();ctx.ellipse(w*.5,h*.55,w*.39,h*.35,-.18,0,2*Math.PI);ctx.stroke();
      const pts=[[54,91],[190,35],[259,74],[54,91]];ctx.beginPath();pts.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.stroke();ctx.font='italic 18px Georgia';ctx.fillStyle=ctx.strokeStyle;
      pts.slice(0,3).forEach(([x,y],i)=>{ctx.beginPath();ctx.arc(x,y,2.6,0,7);ctx.fill();ctx.fillText(['S','P','Q'][i],x+4,y-5);});return;
    }
    ctx.fillStyle=kind==='ice'?'#a6c4c4':'#c3a16e';ctx.fillRect(0,0,w,h);ctx.strokeStyle=kind==='ice'?'#486b70':'#695235';ctx.fillStyle=ctx.strokeStyle;
    if(kind==='ice'){for(let j=0;j<5;j++)for(let i=0;i<5;i++){const x=22+i*29+j*13,y=8+j*10;ctx.globalAlpha=.5;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x,y+82);ctx.stroke();for(let k=0;k<6;k++){ctx.beginPath();ctx.arc(x,y+k*15,1.8,0,7);ctx.fill();}}ctx.globalAlpha=1;ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(8,145);ctx.lineTo(213,17);ctx.stroke();}
    else{for(let i=0;i<8;i++){ctx.lineWidth=.8;ctx.beginPath();ctx.ellipse(110,80,98-i*7,23+i*3,-.54+i*.16,0,7);ctx.stroke();}ctx.font='italic 24px Georgia';ctx.fillText('E = mc²',12,146);}
  });
})();
