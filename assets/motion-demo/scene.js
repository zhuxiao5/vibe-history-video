import {background,terrain,poly,line,text,glow,C,serif,layer,ease,phase} from './history-kit.js';
import {resolveTextBeats,renderTextBeats,cameraLayer,accentAt,accentLayer} from './motion-kit.js';
import {pulseRing,makeSignalPath,pathSignal,countState} from './signal-kit.js';
export const width=1920,height=1080,duration=24;
export const title='文字动效语法 · 信号演示';
export const description='24秒静音技术示例：字波、同行重点、描线、多轴重音、信号接力。地形、建筑和读数为示意。';
export const silent=true;
let beats,contract,motion=true;
export function setMotion(enabled){motion=Boolean(enabled);}
export const ready=(async()=>{
 await document.fonts.load(`600 80px ${serif}`);await document.fonts.load(`700 98px ${serif}`);
 const r=await fetch('./shots.json');if(!r.ok)throw Error('Missing shots');contract=await r.json();
 beats=resolveTextBeats(contract,contract.shots.map(s=>({name:s.id,start:s.start,dur:s.end-s.start})));
})();
function flame(g,x,y,t,s=1){
 g.save();g.translate(x,y);g.scale(s,s);
 const sway=5*Math.sin(t*7)+3*Math.sin(t*13);
 glow(g,0,-22,130,'227,137,39',.30);
 const q=g.createLinearGradient(0,-95,0,0);q.addColorStop(0,'#ce6025');q.addColorStop(.6,'#ffb535');q.addColorStop(1,'#fff6b1');
 g.fillStyle=q;g.beginPath();g.moveTo(-22,0);g.bezierCurveTo(-35,-25,-9,-50,sway,-94);
 g.bezierCurveTo(9,-62,32,-38,23,0);g.closePath();g.fill();
 g.fillStyle='#fff6c3';g.beginPath();g.moveTo(-12,0);g.quadraticCurveTo(-12,-27,4,-43);g.quadraticCurveTo(18,-19,13,0);g.fill();
 for(let i=0;i<5;i++){const u=((t*.6+i*.19)%1+1)%1;g.globalAlpha=(1-u)*.45;g.fillStyle=C.gold;g.fillRect(Math.sin(i*4+t)*17,-100-u*85,2,4);}
 g.restore();
}
function tower(g,x,y,s,t,lit){
 g.save();g.translate(x,y);g.scale(s,s);
 poly(g,[[-74,0],[-47,-205],[47,-205],[74,0]],'#52412a');
 poly(g,[[22,-205],[47,-205],[74,0],[42,0]],'#382c1d');
 for(let j=0;j<8;j++)line(g,[[-50-j*2,-190+j*23],[48+j*2,-190+j*23]],'#a18b5c',.6);
 for(let i=0;i<6;i++)g.fillRect(-47+i*16,-218,10,15);
 g.fillStyle='#15110c';g.fillRect(-12,-46,24,46);
 if(lit)flame(g,0,-212,t,.75);g.restore();
}
const routePoints=[[300,730],[480,665],[690,704],[870,565],[1080,595],[1290,480],[1560,530]];
const signalPath=makeSignalPath(routePoints);
export function renderVariant(g,t,{enabled=true}={}){
 t=Math.max(0,Math.min(duration-.0001,t));background(g);
 const index=t<8?0:t<15?1:2,s=contract.shots[index],local=t-s.start;
 const fade=local<.22?ease(local/.22):local>s.end-s.start-.25?ease((s.end-t)/.25):1;
 const events=contract.shots.flatMap(s=>s.accents??[]);
 const hit=enabled?accentAt(t,events):{dx:0,dy:0,zoom:1};
 layer(g,fade,()=>accentLayer(g,hit,()=>{
  const zoom=index===0?1+.055*ease(phase(local,1,6)):index===2?1+.035*ease(phase(local,0,8)):1;
  cameraLayer(g,{x:960,y:540,zoom},()=>{
   terrain(g,{x:-60,y:380,w:2040,h:650,seed:41});
   if(index===0){
    line(g,[[0,857],[1920,857]],'#5b472b',2);
    tower(g,1070,850,1.7,local,true);
    if(enabled)pulseRing(g,1070,489,local,{at:1,radius:160,duration:1.8,gap:.4,flatten:.55,dash:[12,8]});
   }else if(index===1){
    const c=countState(t,s.counter);const level=c.level;
    for(let i=0;i<4;i++){const x=440+i*360;tower(g,x,850,.8,t,i<level);
     text(g,['一','二','三','四'][i],x,945,64,i<level?C.gold:C.muted,'center');
     if(enabled&&i<level)pulseRing(g,x,674,t,{at:s.accents[i].at,radius:75,duration:1,rings:2,gap:.16});}
    text(g,String(c.value).padStart(3,'0'),1450,390,92,C.gold,'center');text(g,'演示读数',1650,385,34,C.muted);
   }else{
    const state=pathSignal(g,signalPath,t,{...s.signal,tail:.18,lit_alpha:.5,head:enabled,trails:enabled,arrival_ring:enabled?{}:false});
    routePoints.forEach(([x,y],i)=>{const lit=state.progress>=signalPath.stops[i];tower(g,x,y,.3,t,lit);});
    text(g,'起点',300,817,52,C.muted,'center');text(g,'接力节点',870,650,52,C.muted,'center');text(g,'终点',1560,619,52,C.gold,'center');
    if(enabled)pulseRing(g,1560,476,t,{at:21.1,duration:1.3,radius:145,gap:.3,dash:[10,7]});
   }
  });
 },{strength:1}));
 const current=beats.filter(b=>b.start>=s.start&&b.end<=s.end);
 const display=enabled?current:current.map(b=>({...b,hold:{mode:'static'},
  highlights:b.highlights.map(h=>({...h,font_px:b.font_px,entry:undefined,underline:false}))}));
 accentLayer(g,hit,()=>renderTextBeats(g,display,t),{pivot:[105,160],strength:.16});
 text(g,'动效演示 · 地形、建筑与读数为示意 · 无声',1810,1044,24,C.muted,'right');
}
export function render(g,t){renderVariant(g,t,{enabled:motion});}
