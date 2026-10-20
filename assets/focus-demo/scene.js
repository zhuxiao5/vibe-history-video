import {C,serif,background,glow,line,ellipse,poly,text,layer,ease,phase,mix} from './history-kit.js';
import {resolveTextBeats,renderTextBeats,cameraLayer,impactAt} from './motion-kit.js';
import {SCENES,DURATION,ARROW1,ARROW2} from './events.js';
import {water,farBank,shipSection,arrowAt,anchorFor,mechState} from './mechanism.js';
export const width=1920,height=1080,duration=DURATION;
export const title='单面受箭，到回船受箭';
export const description='24秒静音焦点示例；船体受箭、掉头、回正均为机制示意。';
let beats,cameraKeys;
const worldCanvas=document.createElement('canvas');worldCanvas.width=width;worldCanvas.height=height;const worldContext=worldCanvas.getContext('2d');
const eventArrays={ARROW1,ARROW2};
export const ready=(async()=>{
 const r=await fetch('./shots.json');if(!r.ok)throw Error('shots.json unavailable');
 const contract=await r.json();beats=resolveTextBeats(contract,SCENES,eventArrays);
 cameraKeys=contract.shots.flatMap(shot=>{
  const scene=SCENES.find(s=>s.name===shot.scene);
  return shot.camera_keyframes.map(k=>({...k,t:k.ref?eventArrays[k.ref.event][k.ref.index??0]+(k.ref.offset??0):scene.start+k.at}));
 }).sort((a,b)=>a.t-b.t);
 await Promise.all([...beats.map(b=>document.fonts.load(`${b.weight??600} ${b.font_px}px ${serif}`))]);
})();
function cameraAt(t){
 let a=cameraKeys[0],b=a;
 for(let i=1;i<cameraKeys.length;i++){b=cameraKeys[i];if(t<=b.t)break;a=b;}
 const p=a===b?0:ease(phase(t,a.t,b.t));return{x:mix(a.x,b.x,p),y:mix(a.y,b.y,p),zoom:mix(a.zoom,b.zoom,p)};
}
function world(g,t){
 const st=mechState(t),cx=900,sy=690,S=1.28,rad=st.heel*Math.PI/180;
 farBank(g,690,{seed:31});
 glow(g,910,630,430,'175,118,62',.085);
 water(g,690,t+20);
 const im=impactAt(t,[...ARROW1,...ARROW2].map(at=>({at,push:1.8})),{pushDur:.04,fallDur:.1});
 for(const pose of st.passes)layer(g,pose.alpha,()=>{
  g.save();g.translate(im.dx,im.dy);
  shipSection(g,{cx,waterY:sy,heel:st.heel,sx:pose.sx,s:S});
  for(const shot of st.shots){if(t<shot.land)continue;
   const a=anchorFor(shot.i,shot.flank);g.save();g.translate(cx,sy);g.rotate(rad);g.scale(pose.sx*S,S);arrowAt(g,a.x,a.y,a.ang,56);g.restore();}
  g.restore();
 });
 water(g,690,t+20);
 for(const shot of st.shots){
  const a=anchorFor(shot.i,shot.flank),x=st.sx*S*a.x,y=S*a.y;
  const target={x:cx+x*Math.cos(rad)-y*Math.sin(rad)+im.dx,y:sy+x*Math.sin(rad)+y*Math.cos(rad)+im.dy};
  const p=(t-shot.land+1.15)/1.15;
  if(p>0&&p<1)arrowAt(g,mix(1730,target.x,ease(p)),mix(560,target.y,ease(p))-Math.sin(p*Math.PI)*45,Math.PI,50);
  if(t>=shot.land&&t<shot.land+.15)glow(g,target.x,target.y,34,'242,219,160',.3);
 }
 // Visible world reference: compare waterline with the hull, not a competing dashboard.
 line(g,[[650,690],[1150,690]],'rgba(120,191,208,.35)',1.5);
}
function turnPlan(g,t){
 const st=mechState(t),cx=960,cy=625;
 g.fillStyle='#10120f';g.fillRect(0,285,1920,680);
 for(let y=400;y<=850;y+=65)line(g,[[250,y],[1670,y]],'rgba(120,191,208,.05)',1.2);
 glow(g,cx,cy,360,'161,122,58',.11);
 g.save();g.translate(cx,cy);g.rotate(st.heading);
 g.beginPath();g.moveTo(0,-178);g.bezierCurveTo(68,-98,83,42,62,142);g.quadraticCurveTo(0,192,-62,142);g.bezierCurveTo(-83,42,-68,-98,0,-178);g.closePath();
 g.fillStyle='#4a3a23';g.fill();g.strokeStyle='#ba9d64';g.lineWidth=4;g.stroke();
 line(g,[[0,-154],[0,105]],C.gold,4);
 poly(g,[[0,-172],[-13,-144],[13,-144]],C.gold);
 for(let i=0;i<8;i++)arrowAt(g,71,(-92+i*26),Math.PI,42);
 g.restore();
 // Incoming direction remains fixed while the previously loaded flank rotates away.
 line(g,[[1540,cy],[1265,cy]],'rgba(201,118,93,.65)',3);
 poly(g,[[1250,cy],[1280,cy-10],[1280,cy+10]],C.red);
 text(g,'来箭方向',1500,cy-45,42,C.muted,'center');
 text(g,'俯视：受箭侧随船掉转',960,905,54,C.gold,'center');
}
export function render(g,t){
 background(g);const bounded=Math.min(duration-.00001,Math.max(0,t));
 const turnIn=ARROW2[0]-3.15,turnOut=ARROW2[0]-.9;
 const planAlpha=ease(phase(bounded,turnIn,turnIn+.3))*(1-ease(phase(bounded,turnOut,turnOut+.4)));
 const q=worldContext;q.reset();
 layer(q,1-planAlpha,()=>cameraLayer(q,cameraAt(bounded),()=>world(q,bounded),{viewport:{x:0,y:285,w:1920,h:680}}));
 if(planAlpha>.001)layer(q,planAlpha,()=>turnPlan(q,bounded));
 // Mask the world itself, so edges reveal the exact shared background.
 q.globalCompositeOperation='destination-in';
 const vertical=q.createLinearGradient(0,285,0,965);vertical.addColorStop(0,'rgba(0,0,0,0)');vertical.addColorStop(.11,'#000');vertical.addColorStop(.83,'#000');vertical.addColorStop(1,'rgba(0,0,0,0)');q.fillStyle=vertical;q.fillRect(0,0,width,height);
 const horizontal=q.createLinearGradient(0,0,1920,0);horizontal.addColorStop(0,'rgba(0,0,0,0)');horizontal.addColorStop(.04,'#000');horizontal.addColorStop(.96,'#000');horizontal.addColorStop(1,'rgba(0,0,0,0)');q.fillStyle=horizontal;q.fillRect(0,0,width,height);
 q.globalCompositeOperation='source-over';g.drawImage(worldCanvas,0,0);
 g.__textAudit=[];renderTextBeats(g,beats,bounded);
 text(g,'据《三国志》裴松之注引《魏略》 · 画面为机制示意，非船型复原',1810,1038,23,C.muted,'right');
}
export function inspect(t){return{camera:cameraAt(t),state:mechState(t),text:beats.filter(b=>t>=b.start&&t<=b.end).map(b=>({id:b.id,text:b.text,font_px:b.font_px,start:b.start,end:b.end}))};}
