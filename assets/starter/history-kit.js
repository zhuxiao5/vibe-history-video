import {drawTextBeat, impactAt, flash} from './motion-kit.js';
export {drawTextBeat, renderTextBeats, resolveTextBeats, textBeatState, cameraLayer, impactAt, flash} from './motion-kit.js';
export {accentAt,accentLayer,textLayout,TEXT_PROFILES} from './motion-kit.js';
export {pulseRing,pulseState,pathSignal,makeSignalPath,signalState,countState} from './signal-kit.js';
// Original dark-diagram drawing primitives. Coordinates use a 1920x1080 artboard.
export const C = { bg:'#0d0c0a', earth:'#2a2115', ink:'#f1e9d3', gold:'#d9ad58', blue:'#78b9d5', teal:'#78bfb0', red:'#c76550', muted:'#8a8170' };
export const serif='"Songti SC","Noto Serif CJK SC","Source Han Serif SC",serif';
export const sans='"PingFang SC","Noto Sans CJK SC",sans-serif';
export const clamp=(v,a=0,b=1)=>Math.min(b,Math.max(a,v));
export const mix=(a,b,p)=>a+(b-a)*p;
export const phase=(t,a,b)=>clamp((t-a)/(b-a));
export const ease=u=>{u=clamp(u);return u*u*(3-2*u);};
export const hash=n=>{let x=Math.sin(n*127.1+311.7)*43758.5453;return x-Math.floor(x);};
export function layer(g,opacity,fn){g.save();g.globalAlpha*=clamp(opacity);fn();g.restore();}
export function at(g,x,y,s,fn){g.save();g.translate(x,y);g.scale(s,s);fn();g.restore();}
export function line(g,pts,color=C.gold,w=2){g.beginPath();pts.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.strokeStyle=color;g.lineWidth=w;g.lineJoin='round';g.lineCap='round';g.stroke();}
export function poly(g,pts,fill,stroke=null,w=1){g.beginPath();pts.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.closePath();if(fill){g.fillStyle=fill;g.fill();}if(stroke){g.strokeStyle=stroke;g.lineWidth=w;g.stroke();}}
export function ellipse(g,x,y,rx,ry,color){g.beginPath();g.ellipse(x,y,rx,ry,0,0,Math.PI*2);g.fillStyle=color;g.fill();}
export function text(g,s,x,y,size=48,color=C.ink,align='left',font=serif){g.font=`600 ${size}px ${font}`;g.fillStyle=color;g.textAlign=align;g.textBaseline='alphabetic';g.fillText(s,x,y);}
export function glow(g,x,y,r,color='217,173,88',strength=.3){let q=g.createRadialGradient(x,y,0,x,y,r);q.addColorStop(0,`rgba(${color},${strength})`);q.addColorStop(1,`rgba(${color},0)`);g.fillStyle=q;g.fillRect(x-r,y-r,r*2,r*2);}

export function background(g,{paper=false}={}){
 g.fillStyle=paper?'#e8dfc5':C.bg;g.fillRect(0,0,1920,1080);
 if(!paper){glow(g,1330,600,1050,'120,86,44',.19);glow(g,460,1030,750,'89,67,42',.13);}
 // Optional grain is applied by the composition to an explicitly chosen layer.
 const v=g.createRadialGradient(960,470,290,960,470,1150);v.addColorStop(0,'transparent');v.addColorStop(1,paper?'#46351b16':'#0000008a');g.fillStyle=v;g.fillRect(0,0,1920,1080);
}

// Optional dark-layer microtexture. This is a design control, not a universal source model.
let _grainBuf = null, _grainCtx = null;
export function grain(g,t,{cell=8,base=2,color=[198,186,160],size=1.4,falloff=18,alpha=[0.08,0.16]}={}){
 const W=1920,H=1080;
 if(!_grainBuf){_grainBuf=document.createElement('canvas');_grainBuf.width=W;_grainBuf.height=H;
   _grainCtx=_grainBuf.getContext('2d');}
 const c=_grainCtx;
 c.clearRect(0,0,W,H);
 // 关键：读一次已绘制的画面，得到"局部亮度"图，用它调制密度
 let src=null;
 try{src=g.getImageData(0,0,W,H);}catch(e){src=null;}
 const frame=Math.round((t||0)*30);

 if(src){
  const d=src.data;
  // 按 cell 栅格采样：算格子平均亮度 → 暗格多撒、亮格不撒
  for(let y=0;y<H;y+=cell){
   for(let x=0;x<W;x+=cell){
    const idx=((y*W)+x)*4;
    const lum=(d[idx]+d[idx+1]+d[idx+2])/3;
    // 指数衰减：lum=30 → 0.19；50 → 0.062；70 → 0.020；90 → 0.007
    const p=Math.exp(-lum/falloff);
    // 每格放 base*p 个点（base 对应最暗处的密度）
    const n=base*p*(cell*cell)/1000;
    const cnt=Math.floor(n)+((_hash2(frame,x,y)<(n%1))?1:0);
    for(let i=0;i<cnt;i++){
     const px=x+_hash2(frame,x,y,i*3)*cell;
     const py=y+_hash2(frame,x,y,i*3+1)*cell;
     const a=alpha[0]+_hash2(frame,x,y,i*3+2)*(alpha[1]-alpha[0]);
     c.fillStyle=`rgba(${color[0]},${color[1]},${color[2]},${a.toFixed(3)})`;
     const s=size*(0.75+_hash2(frame,py,px)*0.7);        // 固定种子尺寸变化
     c.fillRect(px,py,s,s);
    }
   }
  }
  g.drawImage(_grainBuf,0,0);
 }
}
// 确定性哈希：同一 (帧, 坐标, 序号) 恒得同一值；换帧则整体重排 → 实现"每帧重绘"
function _hash2(a,b,c,d=0){
 let x=Math.sin(a*127.1+b*311.7+c*74.7+d*269.5)*43758.5453;
 return x-Math.floor(x);
}

// Runs remain in place while each phrase fades in; no incremental drawing state.
export function sentence(g,rows,t,{x=105,y=142,size=72,lineHeight=96}={}){
 rows.forEach((row,j)=>{let cx=x;for(const run of row){const r=typeof run==='string'?{text:run}:run;g.font=`600 ${size}px ${serif}`;const w=g.measureText(r.text).width;const p=ease(phase(t,r.at??0,(r.at??0)+.48));layer(g,p,()=>{text(g,r.text,cx,y+j*lineHeight+5*(1-p),size,r.color||C.ink);if(r.underline)line(g,[[cx,y+j*lineHeight+11],[cx+w,y+j*lineHeight+11]],r.color||C.gold,2);});cx+=w;}});
}

// Legacy rows API retained. Static hold is the default; choose a measured wave explicitly.
// New compositions use drawTextBeat/resolveTextBeats for full entry/hold/exit contracts.
export function sentenceGrow(g,rows,t,{x=105,y=142,size=72,lineHeight=96,
  perChar=.04,resolve=.45,blurMax=7,from=0,out,
  floatAmp=0,floatHz=.25,floatWave=.38,floatDecay=.2}={}){
 rows.forEach((row,j)=>{let cursor=x;
  for(const run of row){const r=typeof run==='string'?{text:run}:run;
   g.save();g.font=`600 ${size}px ${serif}`;const w=g.measureText(r.text).width;g.restore();
   drawTextBeat(g,{text:r.text,x:cursor,y:y+j*lineHeight,font_px:size,font:serif,color:r.color||C.ink,
    start:(r.at??0)+from,end:r.out??out??Infinity,underline:r.underline,
    entry:{type:'resolve',duration:resolve,stagger:perChar,blur:blurMax},
    hold:{mode:floatAmp?'wave':'static',amp:floatAmp,hz:floatHz,phase_step:floatWave,decay:floatDecay}},t);
   cursor+=w;
  }
 });
}

export function pathPoint(points,u){
 const lengths=points.slice(1).map((p,i)=>Math.hypot(p[0]-points[i][0],p[1]-points[i][1]));const total=lengths.reduce((a,b)=>a+b,0);let d=clamp(u)*total;
 for(let i=0;i<lengths.length;i++){if(d<=lengths[i]||i===lengths.length-1){const p=lengths[i]?d/lengths[i]:0;return [mix(points[i][0],points[i+1][0],p),mix(points[i][1],points[i+1][1],p)];}d-=lengths[i];}return points[0];
}
export function route(g,points,p,{color=C.gold,width=4,head=true}={}){
 layer(g,.23,()=>line(g,points,color,1.5));if(p<=0)return;
 const q=[];for(let i=0;i<=Math.ceil(p*200);i++)q.push(pathPoint(points,Math.min(i/200,p)));
 g.save();g.shadowColor=color;g.shadowBlur=15;line(g,q,color,width);g.shadowBlur=0;line(g,q,'#fff0c6',Math.max(1,width*.25));g.restore();
 if(head){const [x,y]=pathPoint(points,p);glow(g,x,y,52);ellipse(g,x,y,4,4,'#fff3cc');}
}

// Stylized landscape, NOT DEM or historical geography. Seed-stable contour ridges.
export function terrain(g,{x=600,y=400,w=1200,h=450,seed=30}={}){
 g.save();g.beginPath();g.rect(x,y,w,h);g.clip();
 for(let r=0;r<23;r++){
  let pts=[];for(let i=0;i<=100;i++){let u=i/100;let peak=Math.pow(Math.sin(u*6.5+r*.047),2)*h*.17+Math.sin(u*19+r*.19)*h*.032;pts.push([x+u*w,y+r*h/27+peak]);}
  const base=y+h+30;poly(g,[...pts,[x+w,base],[x,base]],`rgb(${18+r*.35},${17+r*.27},${13+r*.17})`);
  line(g,pts,`rgba(166,136,77,${.10+hash(seed+r)*.11})`,1.1);
  for(let k=0;k<45;k++){let a=Math.floor(hash(seed+r*63+k)*96);const [px,py]=pts[a];line(g,[[px,py],[px+7,py+10+hash(k)*18]],'#5e4d3020',1);}
 }
 g.restore();
}

export function station(g,x,y,s=1,{lit=true,flag=true}={}){at(g,x,y,s,()=>{
 ellipse(g,0,8,111,13,'#00000060');if(lit)glow(g,0,-49,120,'220,149,59',.12);
 poly(g,[[-76,0],[76,0],[76,-96],[-76,-96]],'#534329',C.muted,1);
 poly(g,[[76,0],[110,-20],[110,-107],[76,-96]],'#241e15','#716044',1);
 g.fillStyle='#181711';g.fillRect(-26,-71,52,71);g.fillStyle='#b58c43';g.fillRect(-28,-75,56,5);
 for(const px of [-63,43]){g.fillStyle=lit?'#d0a654':'#453b2c';g.fillRect(px,-67,20,30);line(g,[[px+10,-67],[px+10,-37]],'#534329',2);}
 poly(g,[[-108,-93],[-65,-128],[68,-128],[105,-94],[70,-101],[-73,-101]],'#947445','#c2a165',1.5);
 poly(g,[[68,-128],[104,-143],[145,-111],[105,-94]],'#4a3925','#947445',1);
 for(let i=-69;i<83;i+=10)line(g,[[i,-101],[i*.79,-124]],'#c1a36680',1);
 line(g,[[-67,-131],[69,-131],[106,-146]],C.gold,2);
 g.fillStyle='#271f15';g.fillRect(-26,-103,53,20);text(g,'驿',0,-86,17,C.ink,'center');
 if(flag){line(g,[[106,-35],[106,-206]],'#a58b5c',2);poly(g,[[107,-203],[150,-203],[145,-185],[107,-185]],C.red);text(g,'驿',126,-190,12,'#ebcf95','center');}
 });}

export function person(g,x,y,s=1,{color=C.ink,arm=0}={}){at(g,x,y,s,()=>{
 ellipse(g,0,-79,10,12,color);poly(g,[[-10,-65],[10,-65],[17,-24],[-13,-24]],color);
 line(g,[[-8,-29],[-11,0]],color,6);line(g,[[8,-28],[13,0]],color,6);
 line(g,[[8,-58],[24,-47-arm*18],[36,-48-arm*20]],color,5);line(g,[[-9,-58],[-17,-31]],color,5);
 poly(g,[[-16,-88],[0,-101],[17,-88]],'#c7ac75');
 });}

export function rider(g,x,y,s=1,{t=0,moving=true,color='#c9b68a',letter=false}={}){at(g,x,y,s,()=>{
 const gait=moving?Math.sin(t*10):0;
 ellipse(g,0,1,75,11,'#00000050');
 // Haunch, barrel, rising neck, muzzle and ears create a readable horse silhouette.
 g.beginPath();g.moveTo(-46,-42);g.bezierCurveTo(-71,-44,-75,-82,-47,-86);g.bezierCurveTo(-23,-93,2,-80,26,-84);g.lineTo(43,-122);g.lineTo(41,-139);g.lineTo(49,-132);g.lineTo(58,-140);g.lineTo(58,-127);g.lineTo(88,-111);g.quadraticCurveTo(87,-99,76,-101);g.lineTo(54,-108);g.lineTo(49,-56);g.quadraticCurveTo(21,-42,-12,-49);g.closePath();g.fillStyle=color;g.fill();
 for(let i=0;i<4;i++){const front=i>1;let a=(i%2?1:-1)*gait*15;let ox=front?37:-46;line(g,[[ox,-54],[ox+a,-29],[ox-a*.65+(front?8:-3),0]],i%2?'#928267':color,8);}
 line(g,[[-63,-76],[-87,-65],[-91,-42]],color,4);line(g,[[53,-120],[73,-111]],'#3d3222',2);ellipse(g,65,-119,2,2,'#221c14');
 poly(g,[[-25,-87],[8,-87],[14,-68],[-22,-67]],'#745037');
 ellipse(g,-6,-151,10,12,C.ink);poly(g,[[-17,-137],[1,-137],[13,-98],[-20,-98]],C.ink);
 line(g,[[3,-129],[24,-109],[57,-112]],C.ink,5);line(g,[[-5,-103],[11,-76],[4,-52]],C.ink,6);
 poly(g,[[-19,-161],[-6,-172],[10,-161]],'#c7ac75');
 if(letter){g.fillStyle=C.red;g.fillRect(-31,-132,16,23);line(g,[[-31,-126],[-15,-126]],C.gold,1);}
 });}

export function scroll(g,x,y,w,h){
 const q=g.createLinearGradient(x,0,x+w,0);q.addColorStop(0,'#b9a476');q.addColorStop(.10,'#e2d4ac');q.addColorStop(.88,'#d9c798');q.addColorStop(1,'#ac925f');g.fillStyle=q;g.fillRect(x,y,w,h);
 g.strokeStyle='#7c6238';g.lineWidth=3;g.strokeRect(x+10,y+10,w-20,h-20);
 for(let i=0;i<90;i++)line(g,[[x+13,y+15+i*(h-30)/90],[x+w-13,y+15+i*(h-30)/90]],'#8e764409',1);
 for(const px of [x-9,x+w-3]){let z=g.createLinearGradient(px,0,px+15,0);z.addColorStop(0,'#4d3319');z.addColorStop(.5,'#a4844f');z.addColorStop(1,'#523a1e');g.fillStyle=z;g.fillRect(px,y-15,15,h+30);ellipse(g,px+7,y-15,11,5,'#b59860');ellipse(g,px+7,y+h+15,11,5,'#684922');}
}

export function seal(g,x,y,label='交',p=1){layer(g,p,()=>{g.save();g.translate(x,y);g.rotate(-.07);g.strokeStyle=C.red;g.lineWidth=3;g.strokeRect(-24,-24,48,48);g.strokeRect(-20,-20,40,40);text(g,label,0,14,34,C.red,'center');g.restore();});}
export function timeline(g,labels,active,{x=390,y=1000,w=1140}={}){line(g,[[x,y],[x+w,y]],'#655b48',1);labels.forEach((s,i)=>{let px=x+i*w/(labels.length-1);ellipse(g,px,y,4,4,i===active?C.gold:'#756a53');text(g,s,px,y-19,22,i===active?C.ink:C.muted,'center',sans);});}

// Cross-section primitive: values are design-space points, not physical heights.
export function riverSection(g,{x=230,y=490,w=1460,h=350,water=.6}={}){
 const bank=[[0,.12],[.16,.12],[.28,.86],[.71,.86],[.84,.12],[1,.12]].map(([a,b])=>[x+a*w,y+b*h]);
 poly(g,[...bank,[x+w,y+h],[x,y+h]],'#554029','#aa8c59',2);
 g.save();g.beginPath();bank.forEach(([a,b],i)=>i?g.lineTo(a,b):g.moveTo(a,b));g.lineTo(x+w,y);g.lineTo(x,y);g.closePath();g.clip();
 const top=y+h*(1-clamp(water));g.fillStyle='#377d85';g.fillRect(x,top,w,h);line(g,[[x,top],[x+w,top]],C.blue,3);g.restore();
 text(g,'河道剖面示意 · 非实测比例',x+w,y+h+44,23,C.muted,'right',sans);
}

// Legacy anchor presets, retained for compatibility; not universal measured layouts.
// Choose positions from each project's shots.json and verify actual visibility.
export const LAYOUT = {
  // 左上叙事列：多行向下排，跨 cy 0.19–0.87（即距顶 140–875px）
  main:   { top: 357, left: 111,  note: '左上叙事列；多行，行距约 92px' },
  // 中部：地名/器物标注
  label:  { top: 564, left: 1188, note: '中部标注（地名、器物名）' },
  // 中部：拟声字 —— 与 label 同带，但更短
  sfx:    { top: 534, left: 1156, note: '中部拟声字（2 字以内）' },
  // 底部：来源/免责
  note:   { top: 989, left: 1263, note: '底部来源与免责声明' },
  // 右侧：状态标签
  tag:    { top: 828, left: 1565, note: '右侧标签' },
  // 右上：状态读数（最靠上、最靠右）
  status: { top: 132, left: 1644, note: '右上状态读数（如计数、地名）' },
};

// 按契约取某一类元素的绘制锚点
export function anchor(kind, { w = 1920, h = 1080 } = {}) {
  const c = LAYOUT[kind];
  if (!c) throw Error('未知元素类别: ' + kind);
  return { x: c.left * (w / 1920), y: c.top * (h / 1080) };
}

// Optional fixed-position paper flakes with temporal opacity variation.
// This treatment belongs to another style family, not a series-wide default.
export function flakes(g, t, {
  count = 230,            // 可调整数量
  x0 = 0.30,              // 生效区域（归一化，默认避开左侧插画区）
  seed = 31337,
  dark = true,            // true = 暗底上画浅色碎屑；false = 亮底上画深色碎屑
  sizeRange = [0.9, 7.0], // 可调整尺寸范围
  breathe = 0.35,         // 明灭幅度（0 = 完全固定）
  alpha = [0.25, 0.7],
} = {}) {
  const W = 1920, H = 1080;
  const xa = x0 * W;
  const c = dark ? [198, 186, 160] : [18, 15, 12];
  for (let i = 0; i < count; i += 1) {
    // 固定位置（只与 i、seed 有关，与 t 无关 → 图案固定）
    const px = xa + hash(i * 1.7 + seed) * (W - xa);
    const py = hash(i * 3.1 + seed * 1.3) * H;
    // 尺寸：幂分布，制造"小点多、大点少"
    const u = hash(i * 5.3 + seed * 2.1);
    const r = sizeRange[0] + Math.pow(u, 1.6) * (sizeRange[1] - sizeRange[0]);
    // 明灭：缓慢正弦，每片独立相位
    const ph = hash(i * 7.9 + seed * 3.7) * Math.PI * 2;
    const sp = 0.35 + hash(i * 11.3 + seed * 5.1) * 0.5;   // 0.35–0.85 Hz
    const br = 0.5 + 0.5 * Math.sin(t * sp * Math.PI * 2 + ph);   // 0..1
    const a = alpha[0] + (alpha[1] - alpha[0]) * (1 - breathe + breathe * br);
    if (a <= 0.01) continue;
    g.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},${a.toFixed(3)})`;
    // 形状不规则：用 2–3 个错开的短笔画拼出"碎屑"感（不是圆形点）
    const n = 2 + Math.floor(hash(i * 13.7) * 2);
    for (let k = 0; k < n; k += 1) {
      const ox = (hash(i * 17.1 + k * 3.3) - 0.5) * r * 1.6;
      const oy = (hash(i * 19.3 + k * 5.7) - 0.5) * r * 1.6;
      g.fillRect(px + ox, py + oy, r * (0.7 + hash(i * 23.1 + k) * 0.8), r * 0.62);
    }
  }
}

// Optional local stroke texture: seeded width/jitter/breaks and nearby dust.
// Calibrate per project; these defaults are not recovered source parameters.
export function strokeJitter(g, pts, {
  color = [217, 173, 88],
  width = 6,
  widthJitter = 0.35,      // 粗细随机抖动
  press = 0.45,            // 笔压感（0 = 不用；越大起收笔越细）
  wobble = 1.1,            // 横向微抖动幅度（px）—— 手抖的自然弯曲
  grayJitter = 0.2,
  breaks = 0.06,
  step = 5,
  seed = 991,
} = {}) {
  // 沿折线重采样（比 step 更密一点，便于逐点抖动）
  const total = [];
  for (let i = 0; i < pts.length - 1; i += 1) {
    const [x0, y0] = pts[i]; const [x1, y1] = pts[i + 1];
    const n = Math.max(2, Math.round(Math.hypot(x1 - x0, y1 - y0) / step));
    for (let k = 0; k < n; k += 1) {
      const u = k / n;
      total.push([mix(x0, x1, u), mix(y0, y1, u)]);
    }
  }
  total.push(pts[pts.length - 1]);
  const N = total.length;
  if (N < 2) return;

  // 逐点画：连续的微弯曲线（不是分段直线）
  g.lineCap = 'round';
  g.lineJoin = 'round';
  let i = 0;
  while (i < N - 1) {
    const segLen = 14 + Math.floor(hash(seed + i) * 18);
    const j = Math.min(i + segLen, N - 1);
    if (hash(seed * 3.1 + i) > breaks) {
      // 该段的基准粗细与深浅
      const wBase = width * (1 - widthJitter + 2 * widthJitter * hash(seed * 5.7 + i));
      const gw = 1 - grayJitter + 2 * grayJitter * hash(seed * 7.3 + i);
      g.strokeStyle = `rgba(${color[0]},${color[1]},${color[2]},${gw.toFixed(3)})`;
      // 逐点推进，每点单独设 lineWidth → 形成"笔压感"
      for (let k = i; k < j; k += 1) {
        const u = (k - i) / Math.max(j - i, 1);
        // 笔压包络：起收笔细、中段粗
        const env = press > 0 ? (1 - press + press * Math.sin(Math.PI * u)) : 1;
        // 抖动：横向偏移 + 逐点粗细变化
        const jx = (hash(seed * 11.3 + k) - 0.5) * wobble * 2;
        const jy = (hash(seed * 13.7 + k) - 0.5) * wobble * 2;
        g.lineWidth = Math.max(0.6, wBase * env * (0.85 + 0.3 * hash(seed * 17.1 + k)));
        g.beginPath();
        g.moveTo(total[k][0] + jx, total[k][1] + jy);
        g.lineTo(total[k + 1][0] + jx, total[k + 1][1] + jy);
        g.stroke();
      }
    }
    i = j;
  }
}

// 沿笔触周围撒飞白墨点（**距离受限**，模拟笔触毛边，不是满屏噪点）
export function strokeDust(g, pts, {
  color = [217, 173, 88],
  maxDist = 30,               // 可选局部笔触参数，按项目校准
  countPerPoint = 3.0,        // 每个采样点的密度参数
  alpha = [0.10, 0.45],       // 透明度范围，按背景对比校准
  size = 1.2,
  seed = 557,
} = {}) {
  for (let i = 0; i < pts.length - 1; i += 1) {
    const [x0, y0] = pts[i]; const [x1, y1] = pts[i + 1];
    const len = Math.hypot(x1 - x0, y1 - y0);
    const n = Math.max(1, Math.round(len / 10));
    for (let k = 0; k < n; k += 1) {
      const u = k / n;
      const bx = mix(x0, x1, u); const by = mix(y0, y1, u);
      const m = Math.round(countPerPoint);
      const extra = hash(seed * 11.3 + i * 7.7 + k) < (countPerPoint - m) ? 1 : 0;
      for (let q = 0; q < m + extra; q += 1) {
        // 距离：偏向近处（平方分布 → 近处密、远处疏，符合笔触毛边）
        const du = Math.pow(hash(seed * 13.1 + i * 3.3 + k * 5.1 + q), 2);
        const dist = du * maxDist;
        const ang = hash(seed * 17.9 + i * 4.7 + k * 2.3 + q) * Math.PI * 2;
        const a = alpha[0] + (alpha[1] - alpha[0]) * hash(seed * 19.7 + q + i);
        g.fillStyle = `rgba(${color[0]},${color[1]},${color[2]},${a.toFixed(3)})`;
        const s = size * (0.6 + hash(seed * 23.3 + q * 3.1) * 1.1);
        g.fillRect(bx + Math.cos(ang) * dist, by + Math.sin(ang) * dist, s, s);
      }
    }
  }
}

// impactAt/flash are re-exported from motion-kit; darken is overlay opacity.
