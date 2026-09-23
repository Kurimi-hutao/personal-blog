(function(root){
'use strict';
const add=(o,k,v)=>o[k]=(o[k]||0)+v,clamp=(n,a,b)=>Math.max(a,Math.min(b,n)),num=n=>Number.isFinite(Number(n))?Number(n):0;
// Effects below are transcribed from the atlas's user-provided screenshots.
// Each conditional rule is opt-in; an equipped jade does not imply buff uptime.
const MAIN={
'卫士':[['护甲',250]],'铜皮':[['体力',40]],'反噬':[['攻击',20]],'掣电术':[['攻击',20]],
'快攻':[['攻击',15,'未在最近5秒使用蓄力攻击']],
'驭惊蛰':[['攻击',15,'惊蛰命中后5秒']], '凛霜莲煞':[['攻击',25,'灵莲冲击命中后5秒']],
'碎星劲':[['攻击',20,'星爆后15秒']], '同印强元':[['攻击',12,'两个同类印效果生效'],['元素伤害',25,'两个同类印效果生效']],
'焚燃':[['攻击',25,'水火相激后10秒']], '疗愈劲':[['攻击',20,'获得回复后4秒']],
'碎锋啸':[['攻击',18,'武器消耗耐久后10秒']], '四象·疾凝':[['攻击',20,'四象后15秒'],['元素积累效率',40,'四象后15秒']],
'四象·破罡':[['攻击',25,'四象后10秒']], '醒春':[['攻击',55,'霜冻非自然衰减后10秒']],
'寒天劲':[['攻击',15,'霜冻值上升后5秒'],['霜冻元素积累',45,'霜冻值上升后5秒']],
'蚀骨春':[['攻击',25,'施加瘴毒后18秒']], '奔元劲':[['攻击',15,'元素奔涌期间']],
'舍元劲':[['元素伤害',-50],['招式伤害',100]], '烈元诀':[['元素暴击率',30],['招式伤害',-5]],
'魂燃一线':[['伤害加成',20,'体力低于50%']], '炼甲劲':[['伤害加成',10,'护甲高于50%']],
'暴凌':[['伤害加成',15,'目标没有罡气']], '利刃':[['伤害加成',15,'使用武备匣后8秒']],
'封霜劲':[['打击伤害',20,'体力高于50%']], '神躯':[['受到的伤害减免',12,'体力全满']],
'三才御':[['受到的伤害减免',12,'存在任意三才印']], '寒冰甲':[['受到的伤害减免',15,'自身有霜冻值']],
'续命术':[['受到的伤害减免',40,'免死触发后5秒']],
'爆冰诀':[['冰爆伤害',35]], '冰渊爆':[['冰爆伤害',60]], '封雷诀':[['天雷伤害',30,'诛魔印·电存在']],
'冰环破':[['元素积累效率',30]],'游雷振':[['元素积累效率',60]],'淬毒术':[['元素积累效率',60]],
'疾凝诀':[['元素积累效率',30,'施加瘴毒或灼烧后25秒']], '强运':[['幸运值',1000]],
'天赐·武备匣':[['武备匣不消耗概率',65]], '巧匠':[['武器耐久上限',25]],'激怒':[['攻击怒气获取效率',45]],
'四象·夺魂':[['四象招式触发恢复',400]],'四象·反击':[['四象反击伤害',60,'四象槽满时的反击']],
'连续冰爆':[['单次连续冰爆伤害',-45]],'散射强化':[['弓箭伤害',-70]],
'烊霜':[['近抗',-10,'霜冻满后5秒'],['打击伤害',-10,'霜冻满后5秒']]
};
const POT={G1B:[['元素伤害',30,'振刀反击命中后20秒']],G2B:[['罡气伤害',20,'四象反击命中后10秒']],G4B:[['对首领伤害增加',12,'破罡命中后10秒']],G5B:[['攻击',10,'获得三才印后10秒']],R1B:[['攻击',10,'施放技能后8秒']],R2B:[['攻击',15,'元素奔涌结束后']],R3B:[['断厄斩伤害',10]],R4B:[['元素伤害',20,'元素奔涌期间']],R5B:[['攻击',15,'元素奔涌期间']],R7B:[['元素积累效率',40]],P1B:[['攻击',10,'暴击后6秒']],P3B:[['元素暴击伤害',60]],P4B:[['罡气伤害',15,'暴击后6秒']],P5B:[['流星打击与星爆伤害',20]],P7B:[['元素伤害',30,'星爆后20秒']],B2B:[['自身受到灼烧伤害',10],['水火相激结算伤害',15]],B3B:[['灼烧持续时长',10]],B4B:[['水火相激伤害',10]]};
const aliases={'攻击力':'攻击','体力值':'体力','护甲值':'护甲','对首领伤害':'对首领伤害增加','伤害怒气转换':'伤害怒气转化'};
function readPotential(raw,data){
 if(!raw)return {valid:true,points:[],spent:0,name:'未选择潜能',rotation:0};
 const page=num(raw.page),v=raw.pages?.[page];
 if(!Number.isInteger(page)||page<0||page>2||!Array.isArray(v)||v.length!==56||v.some((x,i)=>!Number.isInteger(x)||x<0||x>(i%2?1:5))||v.reduce((a,b)=>a+b,0)>48)return {valid:false,points:[],spent:0,name:'潜能存档无效，未计入'};
 const points=[];for(let id=0;id<56;id++){let b=Math.floor(id/14),i=Math.floor(id%14/2),type=id%2,parent=type?id-1:i===0?null:b*14+(i<=3?1:5);if(v[id]&&parent!==null&&v[parent]!== (parent%2?1:5))return {valid:false,points:[],spent:0,name:'潜能前置关系无效，未计入'};const code=['B','G','R','P'][b]+(i+1)+(type?'B':'A');if(v[id])points.push({id,code,rank:v[id],data:data[code],branch:b})}
 return {valid:true,points,spent:v.reduce((a,b)=>a+b,0),name:raw.names?.[page]||'潜能方案',rotation:num(raw.rotations?.[page]),element:raw.elements?.[page]||'lightning'};
}
function getEffects(config,potential,jades){
 const effects=[];const push=(id,label,rules)=>rules.forEach(([stat,value,condition],i)=>effects.push({id:id+':'+i,label,stat,value,condition:condition||'',source:id.startsWith('p:')?'potential':'main'}));
 config.slots.forEach((slot,i)=>{const jade=jades.find(j=>j.id===slot.jade);if(!jade)return;push('j:'+i,jade.name,MAIN[jade.name]||[]);if(jade.name==='守缺化劲')push('j:'+i,jade.name,[['近战武器招式增伤',(48-potential.spent)*3.6]]);});
 potential.points.forEach(p=>{if(!p.data)return;const [name,stat,levels]=p.data;if(levels)push('p:'+p.code,name,[[aliases[stat]||stat,levels[p.rank-1]]]);else push('p:'+p.code,name,POT[p.code]||[])});
 // Family zero / tier 3 is the dodge attack buff; rotating changes its aligned branch.
 const dodgeBranch=((0-Math.round(potential.rotation/45))%4+4)%4;
 if(potential.points.filter(p=>p.branch===dodgeBranch).reduce((s,p)=>s+p.rank,0)>=36)push('p:outer-dodge','外圈·强袭',[['攻击',10,'精准闪避后10秒']]);
 return effects;
}
function calculate(config,potential,jades,affixes){
 const sub={},main={},pot={},manual={},conditional=[],effects=getEffects(config,potential,jades),notes=[],seen=new Set();
 for(const [i,slot] of config.slots.entries()){
  if(!slot.jade)continue;
  if(seen.has(slot.jade)){notes.push('第'+(i+1)+'栏魂玉重复，未重复计入');continue}seen.add(slot.jade);
  const he=slot.rows.filter(r=>r.name==='合道').reduce((s,r)=>s+clamp(num(r.value),0,50),0);
  for(const row of slot.rows){const a=affixes.find(a=>a.name===row.name);if(!a)continue;let value=Math.max(0,num(row.value));if(slot.mode==='base'){value=Math.min(value,a.max);if(a.kind==='普通副属性')value*=1+he/100;}if(a.name!=='合道')add(sub,a.name,value);}
 }
 for(const e of effects){if(e.condition){conditional.push(e);if(!config.active[e.id])continue;}add(e.source==='potential'?pot:main,e.stat,e.value);}
 for(const row of config.manual||[])if(row.name)add(manual,row.name,num(row.value));
 const preCap=sub['暴击率']||0;if(config.critCap){sub['暴击率']=Math.min(preCap,42);if(preCap>42)notes.push('魂玉副属性暴击率原合计'+preCap.toFixed(2)+'%，按4月公告上限计42%。');}
 const totals={};for(const bucket of [sub,main,pot,manual])for(const [k,v] of Object.entries(bucket))add(totals,k,v);
 if(potential.points.some(p=>p.code==='B6B')){const lost=Math.max(0,num(config.base.hpBonus)+(totals['体力']||0));totals['体力']=-num(config.base.hpBonus);add(totals,'灼烧伤害',lost*.3);notes.push('焚身炽炎：体力百分比加成已转为灼烧加成（每1%转0.3%）。');}
 if(config.slots.some(s=>jades.find(j=>j.id===s.jade)?.name==='铜皮')){totals['护甲']=-num(config.base.armor);notes.push('铜皮：护甲归零。');}
 if(config.slots.some(s=>jades.find(j=>j.id===s.jade)?.name==='激怒'))notes.push('激怒：每秒自然怒气回复失效；表中保留词条原合计供核对。');
 const crit=clamp(num(config.base.crit)+(totals['暴击率']||0),0,100),critDamage=Math.max(100,num(config.base.critDamage)+(totals['暴击伤害']||0));
 const atkBonus=totals['攻击']||0,permanent=num(config.base.atkBonus),attack=num(config.base.attack)>0?num(config.base.attack)*Math.max(0,1+(permanent+atkBonus)/100):null;
 const unknownConversion=config.slots.some(s=>jades.find(j=>j.id===s.jade)?.name==='坚甲');
 if(unknownConversion)notes.push('坚甲的体力转护甲缺少完整数值，本页暂停体力与护甲最终值预估，请使用补充数值核对。');
 const hp=!unknownConversion&&num(config.base.hp)>0?num(config.base.hp)*Math.max(0,1+(num(config.base.hpBonus)+(totals['体力']||0))/100):null;
 const armor=!unknownConversion&&num(config.base.armor)>0?Math.max(0,num(config.base.armor)+(totals['护甲']||0)):null;
 const meibu=clamp(totals['枚卜']||0,0,100)/100,p=crit/100,effective=p+meibu*p*(1-p);
 return {sub,main,pot,manual,totals,conditional,effects,notes,attack,atkBonus,hp,armor,crit,critDamage,elementCrit:clamp(crit+(totals['元素暴击率']||0),0,100),elementCritDamage:critDamage+(totals['元素暴击伤害']||0),effectiveCrit:effective*100,critExpected:1+effective*(critDamage/100-1)};
}
root.PanelEngine={MAIN,POT,readPotential,getEffects,calculate};
})(typeof window==='undefined'?globalThis:window);
