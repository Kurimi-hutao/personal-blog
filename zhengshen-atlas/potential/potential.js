const MAX=48,KEY='naraka-potential-v3';
const $=id=>document.getElementById(id),sum=a=>a.reduce((s,x)=>s+x,0);
const groups=[{name:'蓝色',color:'#9eaed2'},{name:'绿色',color:'#a0c5ae'},{name:'红色',color:'#dc9d8c'},{name:'紫色',color:'#b6a0d4'}];
// 原图像素坐标。计点小节点与技能图标分别建模，不把两者合并。
const source=[
 [[824,920,747,889],[684,793,662,700],[655,849,534,800],[634,910,550,965],[491,672,490,546],[446,759,355,730],[413,856,318,948]],
 [[954,792,923,717],[827,651,729,634],[885,623,834,501],[945,603,995,522],[706,456,576,455],[798,411,754,329],[891,381,983,291]],
 [[1137,792,1170,717],[1144,603,1091,521],[1206,622,1258,501],[1262,650,1356,630],[1195,381,1106,288],[1294,410,1324,324],[1381,454,1512,455]],
 [[1266,920,1346,888],[1403,789,1425,697],[1434,847,1559,799],[1456,907,1539,957],[1598,668,1600,541],[1646,757,1731,718],[1677,851,1771,946]]
];
const nodes=[];source.forEach((items,b)=>items.forEach((p,i)=>{for(let type=0;type<2;type++)nodes.push({id:nodes.length,b,i,type,max:type?1:5,code:`${['B','G','R','P'][b]}${i+1}${type?'B':'A'}`,x:720+(p[type*2]-1045)*.73,y:699+(p[type*2+1]-1015)*.73,sx:p[type*2],sy:p[type*2+1],name:`${groups[b].name}潜能 ${i+1} · ${type?'技能':'点数'}`})}));

nodes.forEach(n=>{
  const data=POTENTIAL_DATA[n.code];
  n.name=data[0]; n.effect=data[1]; n.levels=data[2]||null; n.unit=data[3]||'';
  n.file=`潜能内容/${n.code==='R2B'?'R12B':n.code}.png`;
  // 图中起始技能分出三路，中层正中的技能通往外层三路。
  n.parent=n.type?n.id-1:n.i===0?null:n.b*14+(n.i<=3?1:5);
});
const ROTATE_STEP=45, THRESHOLDS=[12,24,36];
const fresh=()=>({names:['潜能方案 · 壹','潜能方案 · 贰','潜能方案 · 叁'],pages:Array.from({length:3},()=>Array(nodes.length).fill(0)),rotations:[0,0,0],elements:['lightning','lightning','lightning'],page:0});
let state=fresh(),selected=null,outerSelected=null,rotation=0,rotationTarget=0,animation=0,drag=null,suppressClick=false,migrationNotice='';
const values=()=>state.pages[state.page],mod=(n,m)=>((n%m)+m)%m,element=()=>state.elements[state.page];
function available(n,v=values()){return n.parent===null||v[n.parent]===nodes[n.parent].max}
function budgetValid(v){return Array.isArray(v)&&v.length===nodes.length&&v.every((x,i)=>Number.isInteger(x)&&x>=0&&x<=nodes[i].max)&&sum(v)<=MAX}
function valid(v){return budgetValid(v)&&nodes.every(n=>v[n.id]===0||available(n,v))}
function validRotation(x){return Number.isInteger(x)&&Math.abs(x)<=360000&&x%ROTATE_STEP===0}
function normalizeRotation(x){return mod(Math.round(x/ROTATE_STEP)*ROTATE_STEP,180)}
function cleanLegacy(v){let result=[...v];nodes.forEach(n=>{if(!available(n,result))result[n.id]=0});return result}
function stateValid(s){return s&&s.pages?.length===3&&s.pages.every(valid)&&s.names?.length===3&&s.names.every(x=>typeof x==='string'&&x.trim()&&x.length<=24)&&s.rotations?.length===3&&s.rotations.every(validRotation)&&s.elements?.length===3&&s.elements.every(x=>Object.hasOwn(ELEMENTS,x))&&Number.isInteger(s.page)&&s.page>=0&&s.page<3}
try {
  let s=JSON.parse(localStorage.getItem(KEY));
  if(stateValid(s))state=s;
  else if(!s){
    let old=JSON.parse(localStorage.getItem('naraka-potential-v2'));
    if(old&&old.pages?.length===3&&old.pages.every(budgetValid)&&old.names?.length===3&&old.names.every(x=>typeof x==='string'&&x.trim()&&x.length<=24)&&old.rotations?.length===3&&old.rotations.every(Number.isFinite)&&Number.isInteger(old.page)&&old.page>=0&&old.page<3){
      const pages=old.pages.map(cleanLegacy),refunded=sum(old.pages.map(sum))-sum(pages.map(sum));
      const candidate={...fresh(),names:old.names,pages,rotations:old.rotations.map(normalizeRotation),page:old.page};
      if(stateValid(candidate)){state=candidate;migrationNotice=refunded?`旧方案已迁移：不满足前置关系的 ${refunded} 点已返还，旧版备份保留。`:'旧方案已迁移，外圈已按三枚一组对齐。'}
    }
  }
} catch(e) {}
rotation=rotationTarget=state.rotations[state.page];
function save(){window.dispatchEvent(new Event('potentialchange'));try{localStorage.setItem(KEY,JSON.stringify(state));$('save-state').textContent='● 方案已自动保存'}catch(e){$('save-state').textContent='保存不可用，请导出方案'}}
let timer;
function toast(s){$('toast').textContent=s;$('toast').classList.add('show');clearTimeout(timer);timer=setTimeout(()=>$('toast').classList.remove('show'),3400)}
const point=(a,r)=>[720+Math.cos(a*Math.PI/180)*r,699-Math.sin(a*Math.PI/180)*r];
const pt=(a,r)=>point(a,r).join(','),arc=(r,a=180,b=0)=>`M${pt(a,r)} A${r},${r} 0 0 1 ${pt(b,r)}`;
function shot(x,y,r,size=48){const scale=size/(r*2);return `<foreignObject class="shot" x="${-size/2}" y="${-size/2}" width="${size}" height="${size}" style="pointer-events:none"><div xmlns="http://www.w3.org/1999/xhtml" style="width:${size}px;height:${size}px;border-radius:50%;background-image:url(assets/potential-reference.png);background-repeat:no-repeat;background-size:${2048*scale}px ${1070*scale}px;background-position:${-(x-r)*scale}px ${-(y-r)*scale}px"></div></foreignObject>`}
const seals=[[202,823],[244,676],[316,546],[583,287],[715,213],[860,169],[1230,169],[1377,215],[1508,281],[1773,543],[1848,676],[1893,820]];
function branchPoints(b,v=values()){return sum(nodes.filter(n=>n.b===b).map(n=>v[n.id]))}
function outerInfo(slot,angle=rotation){
  const seal=mod(slot,12),family=Math.floor(seal/3),tier=seal%3;
  const branch=mod(Math.floor(slot/3)-Math.round(angle/ROTATE_STEP),4);
  const data=OUTER_DATA[family],points=branchPoints(branch),threshold=THRESHOLDS[tier];
  return {seal,family,tier,branch,points,threshold,active:points>=threshold,name:`${data.name} · ${data.items[tier][0]}`,effect:data.items[tier][1],file:`潜能内容/外圈/${data.file}`};
}
function outerMarkup(){
  let s=`<path d="${arc(635)}" fill="none" stroke="#a18b60" stroke-opacity=".5"/><path class="outer-hit" data-rotate="true" d="${arc(635)}" fill="none" stroke="transparent" stroke-width="65"/>`;
  for(let i=0;i<24;i++){
    const [x,y]=point(172.5-i*15+rotation,635),[sx,sy]=seals[i%12],info=outerInfo(i);
    s+=`<g class="outer-seal ${info.active?'activated':''}" data-rotate="true" data-seal="${i%12}" data-slot="${i}" tabindex="0" role="button" aria-label="${info.name}，${info.active?'已激活':'未激活'}，需要${info.threshold}点" transform="translate(${x},${y})"><title>${info.name} · ${info.points}/${info.threshold} · 自动激活</title><circle class="seal-glow" r="33"/><path class="seal-border" d="M0-32 L32 0 L0 32 L-32 0Z" fill="#38302c" stroke="#9b8256"/>${shot(sx,sy,42,54)}<text class="seal-progress" text-anchor="middle" y="44">${info.points}/${info.threshold}</text></g>`;
  }
  return s;
}
function updateOuter(settled=false){
  const root=$('outer-ring');if(!root)return;
  root.classList.toggle('turning',!settled);
  root.querySelectorAll('[data-slot]').forEach(el=>{
    const slot=Number(el.dataset.slot),[x,y]=point(172.5-slot*15+rotation,635);
    el.setAttribute('transform',`translate(${x},${y})`);
    if(settled){
      const info=outerInfo(slot);el.classList.toggle('activated',info.active);
      el.setAttribute('aria-label',`${info.name}，${info.active?'已激活':'未激活'}，${info.points}/${info.threshold}点`);
      el.querySelector('.seal-progress').textContent=`${info.points}/${info.threshold}`;
      el.querySelector('title').textContent=`${info.name} · ${info.points}/${info.threshold} · 自动激活`;
    }
  });
  $('rotation-value').textContent=`三枚一组 · 第 ${mod(Math.round(rotation/45),4)+1} 档`;
  if(settled&&outerSelected!==null)detail();
}
function coreMarkup(){
  const e=ELEMENTS[element()];
  return `<g id="element-core" data-core="true" tabindex="0" role="button" aria-label="当前${e.name}元素，点击切换元素" transform="translate(720 650)"><circle r="73" fill="transparent"/><foreignObject x="-84" y="-85" width="168" height="135" style="pointer-events:none"><div xmlns="http://www.w3.org/1999/xhtml" class="core-art" style="background-image:url(assets/elements/${e.file});background-size:168px auto"></div></foreignObject><text text-anchor="middle" class="corevalue" y="66" style="fill:${e.color}">${MAX-sum(values())}</text><text text-anchor="middle" class="corelabel" y="87">剩余潜能点</text><text text-anchor="middle" class="element-switch" y="111">${e.name} · 切换元素 ⌄</text><text text-anchor="middle" y="135" fill="#938c9e" font-size="10">已分配 ${sum(values())} / ${MAX}</text></g>`;
}
function draw(){
  const v=values();
  let svg=`<defs><filter id="glow"><feGaussianBlur stdDeviation="3" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter><radialGradient id="center"><stop stop-color="${ELEMENTS[element()].color}" stop-opacity=".28"/><stop offset="1" stop-color="#baa1e0" stop-opacity="0"/></radialGradient><clipPath id="upper-ring"><rect x="35" y="30" width="1370" height="658"/></clipPath></defs><circle cx="720" cy="699" r="365" fill="url(#center)"/>`;
  for(const r of [145,159,275,320,464,585,602])svg+=`<path class="ring" d="${arc(r)}"/>`;
  for(let a=0;a<=180;a+=3)svg+=`<path class="ray" d="M${pt(a,150)} L${pt(a,585)}"/>`;
  for(let a=0;a<=180;a+=45)svg+=`<path d="M${pt(a,150)} L${pt(a,586)}" stroke="#c5b299" stroke-opacity=".25"/>`;
  svg+=`<g id="outer-ring" clip-path="url(#upper-ring)">${outerMarkup()}</g>`;
  nodes.forEach(n=>{
    const parent=n.parent===null?null:nodes[n.parent];
    let from=parent?[parent.x,parent.y]:point(180-n.b*45-22.5,150);
    const middle=[(from[0]+n.x)/2,(from[1]+n.y)/2],active=available(n,v);
    // 所见即规则：连线与依赖共用同一份 parent 数据。
    const path=n.type?`M${from} L${n.x},${n.y}`:`M${from} Q${middle[0]},${from[1]} ${n.x},${n.y}`;
    svg+=`<path class="dependency ${active?'open':''}" data-edge="${n.code}" d="${path}" stroke="${active?'#bca16c':'#685d49'}" stroke-opacity="${active?.85:.42}" fill="none"/>`;
  });
  nodes.forEach(n=>{
    const g=groups[n.b],on=v[n.id]>0,locked=!available(n,v);
    svg+=`<g class="node ${n.type?'skill':'small'} ${on?'active':''} ${locked?'locked':''} ${selected===n.id?'selected':''}" data-id="${n.id}" tabindex="0" role="button" aria-label="${n.name} ${v[n.id]}/${n.max}${locked?'，前置未满':''}" transform="translate(${n.x},${n.y})" style="--color:${g.color};--dark:#191922"><title>${n.code} · ${n.name}${locked?' · 需点满'+nodes[n.parent].name:''}</title><circle r="${n.type?26:18}" fill="transparent"/><circle class="halo" r="${n.type?26:12}"/><circle class="orb" r="${n.type?22:5}"/>${n.type?shot(n.sx,n.sy,26,43):''}${n.type?(on?'<path d="M14 13 l4 4 8-9" fill="none" stroke="#ffe1a1" stroke-width="2"/>':locked?'<path d="M15 18v-5a4 4 0 0 1 8 0v5m-9 0h10v8H14z" fill="#15141b" stroke="#a59c87"/>':''):`<path class="rank-bg" d="M-17 10 H17 L21 18 L17 26 H-17 L-21 18Z"/><text y="22">${v[n.id]}/5</text>`}</g>`;
  });
  svg+=`<path d="${arc(143)}" stroke="#e9e1f6" stroke-width="2" fill="none" filter="url(#glow)"/>`;
  [22.5,67.5,112.5,157.5].forEach(a=>{const [x,y]=point(a,143);svg+=`<circle cx="${x}" cy="${y}" r="4" fill="#fff1d7" filter="url(#glow)"/>`});
  svg+=coreMarkup();
  [-1,1].forEach(dir=>{let x=dir<0?83:1357;svg+=`<g class="rotation-control" data-dir="${dir}" tabindex="0" role="button" aria-label="${dir<0?'向左':'向右'}旋转一组三个神通" transform="translate(${x} 697)"><rect x="-20" y="-20" width="40" height="40" fill="#3e332c" stroke="#dab781"/><path d="M-8-7 L0 1 L8-7 M-8 1 L0 9 L8 1" stroke="#f8e5bc" stroke-width="3" fill="none"/></g>`});
  svg+=`<text id="rotation-value" class="rotation-hint" x="1050" y="755" text-anchor="middle">三枚一组 · 第 ${mod(Math.round(rotation/45),4)+1} 档</text><text class="rotation-hint" x="385" y="755" text-anchor="middle">外圈按内圈 12 / 24 / 36 点自动激活</text>`;
  $('tree').innerHTML=svg;
  $('legend').innerHTML=groups.map((g,b)=>`<button data-group="${b}" style="--color:${g.color}"><i></i>${g.name}潜能<b>${branchPoints(b)}</b></button>`).join('');
  $('plans').selectedIndex=state.page;[...$('plans').options].forEach((o,i)=>o.textContent=state.names[i]);
  document.documentElement.style.setProperty('--element-color',ELEMENTS[element()].color);updateBudget();detail();
}
function updateBudget(){
  const count=sum(values());if($('allocated-total'))$('allocated-total').textContent=count;
  if($('allocation-fill'))$('allocation-fill').style.transform='scaleX('+(count/MAX)+')';
}
function refreshAllocation(){
  const v=values(),reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  nodes.forEach(n=>{
    const el=document.querySelector('[data-id="'+n.id+'"]'),locked=!available(n,v),wasLocked=el.classList.contains('locked');
    el.classList.toggle('active',v[n.id]>0);el.classList.toggle('locked',locked);
    el.setAttribute('aria-label',n.name+' '+v[n.id]+'../'+n.max+(locked?'，前置未满':''));
    el.querySelector('title').textContent=n.code+' · '+n.name+(locked?' · 需点满'+nodes[n.parent].name:'');
    if(!n.type)el.querySelector('text').textContent=v[n.id]+'../5';
    else {
      let marker=el.querySelector('.state-marker');if(!marker){marker=document.createElementNS('http://www.w3.org/2000/svg','g');marker.setAttribute('class','state-marker');el.append(marker)}
      el.querySelectorAll(':scope > path:not(.rank-bg)').forEach(p=>p.remove());
      marker.innerHTML=v[n.id]?'<path d="M14 13 l4 4 8-9" fill="none" stroke="#ffe1a1" stroke-width="2"/>':locked?'<path d="M15 18v-5a4 4 0 0 1 8 0v5m-9 0h10v8H14z" fill="#15141b" stroke="#a59c87"/>':'';
    }
    const edge=document.querySelector('[data-edge="'+n.code+'"]');edge.classList.toggle('open',!locked);edge.setAttribute('stroke',locked?'#685d49':'#bca16c');edge.setAttribute('stroke-opacity',locked?'.42':'.85');
    if(wasLocked&&!locked&&!reduced)el.querySelector('.orb').animate([{opacity:.35,transform:'scale(.72)'},{opacity:1,transform:'scale(1.12)'},{opacity:1,transform:'scale(1)'}],{duration:420,easing:'ease-out'});
  });
  const counter=document.querySelector('.corevalue');counter.textContent=MAX-sum(v);
  if(!reduced)counter.animate([{opacity:.4,transform:'translateY(3px)'},{opacity:1,transform:'translateY(0)'}],{duration:260,easing:'ease-out'});
  document.querySelector('#element-core > text:last-child').textContent='已分配 '+sum(v)+' / '+MAX;
  document.querySelectorAll('[data-group]').forEach(el=>el.querySelector('b').textContent=branchPoints(Number(el.dataset.group)));
  updateOuter(true);updateBudget();detail();
}
function nodeEffect(n){
  if(n.levels)return `${n.effect} + ${n.levels.map(x=>x+n.unit).join(' / ')}`;
  if((n.code==='R6B'||n.code==='P6B')&&element()!=='lightning')return `当前选择：${ELEMENTS[element()].name}。此潜能随起始元素改变；已提供的截图为电元素版本，${ELEMENTS[element()].name}元素的专属名称与完整效果待补充。`;
  return n.effect;
}
function setSourceButton(file){
  let button=$('view-source');if(!button){button=document.createElement('button');button.id='view-source';button.className='view-source';button.textContent='查看游戏内原图 ↗';document.querySelector('.detail').append(button)}
  button.hidden=!file;button.onclick=()=>{if(!file)return;$('source-title').textContent=$('name').textContent;$('source-image').src=file;$('source-dialog').showModal()};
}
function detail(){
  const n=selected===null?null:nodes[selected];
  if(outerSelected!==null){
    const info=outerInfo(outerSelected);$('type').textContent='外圈神通 · 自动激活';$('name').textContent=info.name;$('description').textContent=info.effect;
    $('condition').textContent=`${groups[info.branch].name}分支 ${info.points} / ${info.threshold} 点`;
    $('rank').textContent=info.active?'已激活':'未激活';$('plus').disabled=$('minus').disabled=true;
    setSourceButton(info.file);return;
  }
  $('minus').disabled=!n||!values()[n.id];$('plus').disabled=!n||!available(n)||values()[n.id]>=n.max||sum(values())>=MAX;
  if(!n){$('type').textContent='潜能详情';$('name').textContent='选择一枚潜能';$('description').textContent='点满前置，循脉解锁。外圈按对应分支的投入点数自动激活。';$('condition').textContent='总潜能点数 · 48';$('rank').textContent='—';setSourceButton(null);return}
  $('type').textContent=`${n.code} / ${groups[n.b].name}分支`;$('name').textContent=n.name;$('description').textContent=nodeEffect(n);
  let condition=n.parent===null?'起始节点 · 可直接投入':`前置：${nodes[n.parent].name} ${values()[n.parent]}/${nodes[n.parent].max} · ${available(n)?'已解锁':'需点满'}`;
  if(n.levels)condition+=`\n当前：${n.effect} +${values()[n.id]?n.levels[values()[n.id]-1]:0}${n.unit}`;
  $('condition').textContent=condition;$('rank').textContent=n.type?(values()[n.id]?'已点亮':'未点亮'):`${values()[n.id]} / 5`;
  setSourceButton(n.file);
}
function inspectNode(id){if(selected!==id){const panel=document.querySelector('.detail');panel.classList.remove('reveal');requestAnimationFrame(()=>panel.classList.add('reveal'))}selected=id;outerSelected=null;document.querySelectorAll('.node.selected').forEach(el=>el.classList.remove('selected'));document.querySelector(`[data-id="${id}"]`)?.classList.add('selected');detail()}
function inspectOuter(slot){selected=null;outerSelected=slot;detail()}
function pulse(id,delta){
  const el=document.querySelector(`[data-id="${id}"]`);if(!el||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  const c=document.createElementNS('http://www.w3.org/2000/svg','circle');c.setAttribute('class',`pulse ${delta>0?'burst':'refund'}`);el.append(c);c.addEventListener('animationend',()=>c.remove());
  el.querySelector('.orb').animate([{filter:'brightness(2.7)'},{filter:'brightness(1)'}],{duration:420,easing:'ease-out'});
}
function change(id,delta,multi=false){
  inspectNode(id);const n=nodes[id],v=values();
  if(delta>0&&!available(n)){toast(`请先点满「${nodes[n.parent].name}」`);return}
  const amount=delta>0?Math.min(multi?n.max:1,n.max-v[id],MAX-sum(v)):-Math.min(multi?n.max:1,v[id]);
  if(!amount){if(delta>0)toast(v[id]===n.max?'该潜能已满':'48 点已全部分配');return}
  const next=[...v];next[id]+=amount;
  if(!valid(next)){toast('后置节点已有投入，请先从末端退点');return}
  state.pages[state.page]=next;save();refreshAllocation();pulse(id,delta);
}
function finishRotation(){
  rotation=normalizeRotation(rotationTarget);rotationTarget=rotation;state.rotations[state.page]=rotation;save();updateOuter(true);
}
function rotateTo(target){
  cancelAnimationFrame(animation);rotationTarget=Math.round(target/ROTATE_STEP)*ROTATE_STEP;
  const start=rotation,t0=performance.now(),duration=matchMedia('(prefers-reduced-motion: reduce)').matches?0:720;
  function frame(now){const t=duration?Math.min(1,(now-t0)/duration):1;rotation=start+(rotationTarget-start)*(1-Math.pow(1-t,4));updateOuter();if(t<1)animation=requestAnimationFrame(frame);else{animation=0;finishRotation()}}
  animation=requestAnimationFrame(frame);
}
function rotateBy(dir){rotateTo(rotationTarget+dir*ROTATE_STEP)}
function angleAt(e){let p=$('tree').createSVGPoint();p.x=e.clientX;p.y=e.clientY;p=p.matrixTransform($('tree').getScreenCTM().inverse());return Math.atan2(699-p.y,p.x-720)*180/Math.PI}
function stopRotation(){cancelAnimationFrame(animation);animation=0;rotationTarget=Math.round(rotation/45)*45;rotation=normalizeRotation(rotationTarget);rotationTarget=rotation;state.rotations[state.page]=rotation;drag=null;save()}
function showElements(){
  document.querySelectorAll('[data-element]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.element===element())));
  $('element-current').textContent=`当前元素：${ELEMENTS[element()].name} · 选择后自动保存`;$('element-dialog').showModal();
  document.querySelector(`[data-element="${element()}"]`).focus();
}
function selectElement(key){
  if(!Object.hasOwn(ELEMENTS,key))return;state.elements[state.page]=key;save();draw();$('element-dialog').close();
  if(!matchMedia('(prefers-reduced-motion: reduce)').matches)$('element-core').animate([{opacity:.2},{opacity:1}],{duration:500});
  $('element-core').focus();toast(`已选择${ELEMENTS[key].name}元素`);
}
$('tree').addEventListener('pointerdown',e=>{
  const el=e.target.closest('[data-rotate]');if(!el||e.button!==0)return;
  cancelAnimationFrame(animation);animation=0;
  drag={start:angleAt(e),rotation,x:e.clientX,y:e.clientY,moved:false,slot:el.dataset.slot===undefined?null:Number(el.dataset.slot)};
  $('tree').setPointerCapture(e.pointerId);e.preventDefault();
});
$('tree').addEventListener('pointermove',e=>{
  if(!drag)return;if(Math.hypot(e.clientX-drag.x,e.clientY-drag.y)>4)drag.moved=true;
  let diff=angleAt(e)-drag.start;if(diff>180)diff-=360;if(diff< -180)diff+=360;
  rotation=drag.rotation+diff;updateOuter();
});
function endDrag(e){
  if(!drag)return;const finished=drag;drag=null;suppressClick=finished.moved;
  if($('tree').hasPointerCapture(e.pointerId))$('tree').releasePointerCapture(e.pointerId);
  if(!finished.moved&&finished.slot!==null)inspectOuter(finished.slot);
  rotateTo(Math.round(rotation/ROTATE_STEP)*ROTATE_STEP);setTimeout(()=>suppressClick=false,100);
}
$('tree').addEventListener('pointerup',endDrag);$('tree').addEventListener('pointercancel',endDrag);
$('tree').addEventListener('wheel',e=>{if(e.target.closest('[data-rotate]')){e.preventDefault();rotateBy(e.deltaY>0?-1:1)}},{passive:false});
$('tree').addEventListener('click',e=>{
  if(suppressClick)return;if(e.target.closest('[data-core]')){showElements();return}
  const control=e.target.closest('[data-dir]');if(control){rotateBy(Number(control.dataset.dir));return}
  const el=e.target.closest('[data-id]');if(el)change(+el.dataset.id,1,e.shiftKey);
});
$('tree').addEventListener('contextmenu',e=>{const el=e.target.closest('[data-id]');if(el){e.preventDefault();change(+el.dataset.id,-1,e.shiftKey)}});
$('tree').addEventListener('focusin',e=>{const el=e.target.closest('[data-id]');if(el)inspectNode(+el.dataset.id)});
$('tree').addEventListener('pointerover',e=>{if(drag)return;const el=e.target.closest('[data-id]');if(el)inspectNode(+el.dataset.id)});
$('tree').addEventListener('keydown',e=>{
  const node=e.target.closest('[data-id]'),control=e.target.closest('[data-dir]'),seal=e.target.closest('[data-rotate]'),core=e.target.closest('[data-core]');
  if(core&&['Enter',' '].includes(e.key)){e.preventDefault();showElements()}
  else if(node&&['Enter',' ','-'].includes(e.key)){e.preventDefault();const id=+node.dataset.id;change(id,e.key==='-'?-1:1,e.shiftKey);document.querySelector(`[data-id="${id}"]`).focus()}
  else if(control&&['Enter',' '].includes(e.key)){e.preventDefault();rotateBy(Number(control.dataset.dir))}
  else if(seal&&['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();rotateBy(e.key==='ArrowLeft'?-1:1)}
  else if(seal&&['Enter',' '].includes(e.key)){e.preventDefault();inspectOuter(Number(seal.dataset.slot))}
});
$('plus').onclick=()=>selected!==null&&change(selected,1);$('minus').onclick=()=>selected!==null&&change(selected,-1);
$('legend').onclick=e=>{const el=e.target.closest('[data-group]');if(el)inspectNode(+el.dataset.group*14)};
$('plans').onchange=e=>{stopRotation();state.page=e.target.selectedIndex;rotation=rotationTarget=state.rotations[state.page];selected=outerSelected=null;save();draw()};
$('help').onclick=()=>$('help-dialog').showModal();$('reset').onclick=()=>$('reset-dialog').showModal();
$('confirm-reset').onclick=()=>{state.pages[state.page]=Array(nodes.length).fill(0);save();draw();$('reset-dialog').close();toast('潜能点已全部返还，外圈激活状态已更新')};
$('rename').onclick=()=>{$('plan-name').value=state.names[state.page];$('rename-dialog').showModal();$('plan-name').focus()};
$('confirm-name').onclick=()=>{const name=$('plan-name').value.trim();if(!name)return;state.names[state.page]=name;save();draw();$('rename-dialog').close()};
document.querySelectorAll('[data-element]').forEach(button=>button.onclick=()=>selectElement(button.dataset.element));
$('export').onclick=()=>{
  stopRotation();const payload={version:3,maxPoints:48,name:state.names[state.page],points:values(),rotation,element:element()};
  const url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='永劫无间-潜能方案.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('方案已导出（含元素与外圈位置）');
};
$('import').onclick=()=>$('file').click();
$('file').onchange=async e=>{
  try{
    const file=e.target.files[0];if(!file)return;if(file.size>20000)throw Error();const p=JSON.parse(await file.text());
    if(p.maxPoints!==48||typeof p.name!=='string'||!p.name.trim()||p.name.length>24)throw Error();
    let refunded=0;
    if(p.version===2&&budgetValid(p.points)&&Number.isFinite(p.rotation)){
      const previous=sum(p.points);p.points=cleanLegacy(p.points);refunded=previous-sum(p.points);p.rotation=normalizeRotation(p.rotation);p.element='lightning';
    }else if(p.version!==3)throw Error();
    if(!valid(p.points)||!validRotation(p.rotation)||!Object.hasOwn(ELEMENTS,p.element))throw Error();
    stopRotation();state.pages[state.page]=p.points;state.names[state.page]=p.name;state.elements[state.page]=p.element;state.rotations[state.page]=rotation=rotationTarget=normalizeRotation(p.rotation);selected=outerSelected=null;save();draw();
    toast(refunded?`旧方案已导入，返还前置不合法的 ${refunded} 点`:'方案已导入当前页');
  }catch(e){toast('导入失败：请检查点数、前置关系、元素及外圈档位')}finally{$('file').value=''}
};
$('tree').setAttribute('tabindex','-1');draw();if(migrationNotice){save();toast(migrationNotice)}

// Touch users can select every node without hitting small SVG targets.
const touchNode=document.getElementById('touch-node');
if(touchNode){
 for(let b=0;b<groups.length;b++){
  const group=document.createElement('optgroup');group.label=groups[b].name+'经脉';
  for(const n of nodes.filter(n=>n.b===b)){const option=document.createElement('option');option.value=String(n.id);option.textContent=n.code+' · '+n.name;group.append(option)}
  touchNode.append(group);
 }
 touchNode.addEventListener('change',()=>{if(touchNode.value==='')return;inspectNode(Number(touchNode.value));document.querySelector('.detail').scrollIntoView({block:'center',behavior:'instant'})});
}
const arena=document.querySelector('.arena');
if(matchMedia('(max-width:600px)').matches&&arena)requestAnimationFrame(()=>{arena.scrollLeft=(arena.scrollWidth-arena.clientWidth)/2});
