// World-coordinate signal primitives. No frame accumulation or random state.
const clamp=v=>Math.max(0,Math.min(1,v));
function positive(v,name){if(!Number.isFinite(v)||v<=0)throw Error(`Invalid ${name}`);return v;}
export function pulseState(t,{at=0,duration=1.4,radius=90,rings=3,gap=.2}={}){
 positive(duration,'pulse duration');positive(radius,'pulse radius');
 if(!Number.isInteger(rings)||rings<1||rings>20||!Number.isFinite(gap)||gap<0)throw Error('Invalid pulse rings/gap');
 return Array.from({length:rings},(_,i)=>{
  const u=(t-at-i*gap)/duration,active=u>0&&u<1;
  return {radius:radius*clamp(u),alpha:active?Math.sin(Math.PI*u)*(1-u):0};
 });
}
export function pulseRing(g,x,y,t,options={}){
 const {color='#d9ad58',width=2,flatten=1,dash=[]}=options;
 positive(width,'ring width');positive(flatten,'ring flatten');
 const rings=pulseState(t,options);
 g.save();g.strokeStyle=color;g.lineWidth=width;g.setLineDash(dash);
 for(const r of rings){if(r.alpha<=0)continue;g.save();g.globalAlpha*=r.alpha;
  g.beginPath();g.ellipse(x,y,r.radius,r.radius*flatten,0,0,Math.PI*2);g.stroke();g.restore();}
 g.restore();return rings;
}
export function makeSignalPath(points){
 if(!Array.isArray(points)||points.length<2||points.some(p=>p.length!==2||p.some(v=>!Number.isFinite(v))))throw Error('Invalid signal path');
 const lengths=points.slice(1).map((p,i)=>Math.hypot(p[0]-points[i][0],p[1]-points[i][1]));
 const length=lengths.reduce((a,b)=>a+b,0);positive(length,'path length');
 let cumulative=0;const stops=[0,...lengths.map(v=>(cumulative+=v)/length)];
 return {length,stops,point(u){let d=clamp(u)*length;
  for(let i=0;i<lengths.length;i++){
   if(lengths[i]===0)continue;
   if(d<=lengths[i]||i===lengths.length-1){const p=clamp(d/lengths[i]);return points[i].map((v,j)=>v+(points[i+1][j]-v)*p);}
   d-=lengths[i];
  }return [...points.at(-1)];
 }};
}
export function signalState(t,{at=0,duration=3,tail=.18,linger=.7}={}){
 positive(duration,'signal duration');positive(tail,'signal tail');positive(linger,'signal linger');
 const u=(t-at)/duration,fade=u<=1?1:clamp(1-(t-at-duration)/linger);
 return {progress:clamp(u),active:u>=0&&fade>0,alpha:fade,arrived:u>=1,arrival:at+duration,tail};
}
export function pathSignal(g,path,t,options={}){
 const {color='#d9ad58',spacing=18,dot=2.5,base_alpha=.2,lit_alpha=.4,head=true,trails=true}=options;
 positive(spacing,'dot spacing');positive(dot,'dot radius');
 const state=signalState(t,options),n=Math.ceil(path.length/spacing);
 g.save();g.fillStyle=color;
 for(let i=0;i<=n;i++){
  const u=i/n,behind=state.progress-u;
  const trail=trails&&state.active&&behind>=0&&behind<=state.tail?Math.pow(1-behind/state.tail,2)*state.alpha:0;
  const lit=t>=(options.at??0)&&behind>=0?lit_alpha:base_alpha;
  const [x,y]=path.point(u);g.save();g.globalAlpha*=Math.max(lit,trail);
  g.beginPath();g.arc(x,y,dot+trail*1.5,0,Math.PI*2);g.fill();g.restore();
 }
 if(head&&state.active){const [x,y]=path.point(state.progress);g.save();g.globalAlpha*=state.alpha;
  const glow=g.createRadialGradient(x,y,0,x,y,35);glow.addColorStop(0,color);glow.addColorStop(1,'transparent');
  g.fillStyle=glow;g.fillRect(x-35,y-35,70,70);g.fillStyle='#fff1bd';g.beginPath();g.arc(x,y,4,0,Math.PI*2);g.fill();g.restore();}
 g.restore();
 if(state.arrived&&options.arrival_ring!==false){const [x,y]=path.point(1);pulseRing(g,x,y,t,{at:state.arrival,color,radius:75,duration:1.1,rings:2,gap:.18,...options.arrival_ring});}
 return state;
}
export function countState(t,{at=0,duration=2,from=0,to=100,thresholds=[]}={}){
 positive(duration,'count duration');
 if(![at,from,to].every(Number.isFinite)||thresholds.some(v=>!Number.isFinite(v)))throw Error('Invalid count values');
 const p=clamp((t-at)/duration),raw=from+(to-from)*p,value=to>=from?Math.floor(raw+1e-9):Math.ceil(raw-1e-9);
 return {value,progress:p,level:thresholds.filter(v=>value>=v).length};
}
