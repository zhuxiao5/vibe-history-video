// Deterministic motion channels. Parameters are design controls, not inferred source formulas.
const clamp=(v,a=0,b=1)=>Math.min(b,Math.max(a,v));
const smooth=v=>{v=clamp(v);return v*v*(3-2*v);};
const fontFamily='"Songti SC","Noto Serif CJK SC","Source Han Serif SC",serif';
const charsOf=s=>Array.from(s);
function finite(value,label){if(!Number.isFinite(value))throw Error(`${label} must be finite`);return value;}
export const TEXT_PROFILES={v02:{mode:'wave',amp:4,hz:.41,phase_step:-.65,decay:0}};

export function textBeatState(beat,t,index=0,count=charsOf(beat.text).length){
 const entry=beat.entry||{},exit=beat.exit||{},requested=beat.hold||{};
 if(requested.profile&&!TEXT_PROFILES[requested.profile])throw Error('Unknown text hold profile');
 const hold={...(TEXT_PROFILES[requested.profile]||{}),...requested};
 if(!['static','wave','line'].includes(hold.mode??'static'))throw Error('Unknown text hold mode');
 const start=beat.start??0;
 const duration=entry.duration??.45,stagger=entry.stagger??.025;
 if(duration<=0||stagger<0)throw Error('Invalid text entry duration/stagger');
 const e=smooth((t-start-index*stagger)/duration);
 const end=beat.end??Infinity;
 const outDuration=exit.duration??.35,outStagger=exit.stagger??.012;
 if(outDuration<=0||outStagger<0)throw Error('Invalid text exit duration/stagger');
 const outStart=exit.start??(end-outDuration-Math.max(0,count-1)*outStagger);
 const o=Number.isFinite(outStart)?smooth((t-outStart-index*outStagger)/outDuration):0;
 const alpha=e*(1-o);
 const size=beat.font_px??72;
 const assemble=entry.type==='assemble';
 const tracking=entry.tracking_from??(assemble?-size*.62:0);
 const moveX=(entry.x_from??(assemble?-12:0))*(1-e)+(exit.x_to??0)*o;
 const moveY=(entry.y_from??0)*(1-e)+(exit.y_to??0)*o;
 const amp=hold.mode==='wave'||hold.mode==='line'?finite(hold.amp??3,'hold amp'):0;
 const hz=finite(hold.hz??.25,'hold hz'),decay=finite(hold.decay??.2,'hold decay');
 if(amp<0||hz<0||decay<0||decay>1)throw Error('Invalid hold amp/hz/decay');
 const ph=2*Math.PI*hz*(t-finite(hold.time_origin??0,'time_origin'))+finite(hold.phase??0,'phase')+
  (hold.mode==='line'?0:finite(hold.phase_step??.38,'phase_step')*index);
 const wave=amp*(1-(hold.mode==='line'?0:decay)*(count>1?index/(count-1):0))*Math.sin(ph);
 return {alpha,x:moveX+index*tracking*(1-e),y:moveY+wave*e*(1-o),
  scale:1+((entry.scale_from??1)-1)*(1-e)+((exit.scale_to??1)-1)*o,
  blur:(entry.blur??7)*(1-e)*(1-e)+(exit.blur??8)*o*o,
  entry_progress:e,exit_progress:o,
  phase:alpha<.001?'hidden':o>0?'exit':e<1?'entry':'hold'};
}

function resolveHighlights(beat){
 const ranges=(beat.highlights||[]).map(h=>{
  if(Number.isInteger(h.start)&&Number.isInteger(h.end))return h;
  if(!h.text)throw Error('Highlights require a substring');
  const at=beat.text.indexOf(h.text);if(at<0)throw Error(`Highlight not found: ${h.text}`);
  return {...h,start:charsOf(beat.text.slice(0,at)).length,end:charsOf(beat.text.slice(0,at+h.text.length)).length};
 });
 const count=charsOf(beat.text).length;
 for(const h of ranges){if(h.start<0||h.end<=h.start||h.end>count)throw Error('Invalid highlight range');}
 for(let i=0;i<ranges.length;i++)for(let j=i+1;j<ranges.length;j++)
  if(ranges[i].start<ranges[j].end&&ranges[j].start<ranges[i].end)throw Error('Overlapping highlights');
 return ranges;
}

export function textLayout(g,beat){
 const highlights=resolveHighlights(beat),chars=charsOf(beat.text);
 g.save();
 try{
  const glyphs=chars.map((char,index)=>{
   const highlight=highlights.find(h=>index>=h.start&&index<h.end);
   const size=finite(highlight?.font_px??beat.font_px??72,'font_px');
   if(size<=0)throw Error('font_px must be positive');
   const font=`${highlight?.weight??beat.weight??600} ${size}px ${beat.font??fontFamily}`;
   g.font=font;
   return {char,index,highlight,size,font,width:g.measureText(char).width};
  });
  const total=glyphs.reduce((a,b)=>a+b.width,0);
  let cursor=(beat.x??105)-(beat.align==='center'?total/2:beat.align==='right'?total:0);
  for(const glyph of glyphs){glyph.x=cursor;cursor+=glyph.width;}
  return {glyphs,total,highlights};
 }finally{g.restore();}
}

export function drawTextBeat(g,beat,t){
 if(typeof beat.text!=='string'||!beat.text)throw Error('Text beat needs text');
 const {glyphs,highlights}=textLayout(g,beat);
 g.save();
 g.textAlign='left';g.textBaseline='alphabetic';
 glyphs.forEach(({char:ch,index:i,font,width,x:cursor,highlight,size})=>{
  const state=textBeatState({...beat,font_px:size,entry:{...beat.entry,...highlight?.entry}},t,i,glyphs.length);
  if(state.alpha>.001){
   g.save();g.globalAlpha*=state.alpha;
   g.font=font;
   const existing=g.filter||'none';
   if(state.blur>.01)g.filter=`${existing==='none'?'':existing+' '}blur(${state.blur.toFixed(3)}px)`;
   const x=cursor+state.x,y=(beat.y??142)+state.y;
   g.translate(x+width/2,y);g.scale(state.scale,state.scale);
   g.fillStyle=highlight?.color??beat.color??'#f1e9d3';
   g.fillText(ch,-width/2,0);
   if(beat.underline){g.fillRect(-width/2,10,width,beat.underline_width??2);}
   if(Array.isArray(g.__textAudit))g.__textAudit.push({id:beat.id??null,source_text:beat.text,char:ch,index:i,
    font:g.font,alpha:g.globalAlpha,x,y,scale:state.scale,phase:state.phase});
   g.restore();
  }
 });
 // Phrase rules remain anchored to the line, rather than breaking into waving glyph blocks.
 for(const h of highlights){if(!h.underline)continue;
  const u=h.underline===true?{}:h.underline;
  const first=glyphs[h.start],last=glyphs[h.end-1];
  const at=(beat.start??0)+(u.delay??.45),dur=finite(u.duration??.45,'underline duration');
  if(dur<=0)throw Error('Invalid underline duration');
  const p=smooth((t-at)/dur),state=textBeatState(beat,t,h.start,glyphs.length);
  if(p>0&&state.alpha>0){g.save();g.globalAlpha*=state.alpha;
   g.fillStyle=u.color??h.color??beat.color??'#d9ad58';
   g.fillRect(first.x,(beat.y??142)+(u.offset??12),(last.x+last.width-first.x)*p,u.width??2);g.restore();}
 }
 g.restore();
}

export function renderTextBeats(g,beats,t){for(const beat of beats)drawTextBeat(g,beat,t);}

export function resolveTextBeats(contract,scenes,eventArrays={}){
 const table=Object.fromEntries(scenes.map(s=>[s.name,s]));
 const ids=new Set();
 return contract.shots.flatMap(shot=>{
  const scene=table[shot.scene??shot.id];if(!scene)throw Error(`Unknown text scene ${shot.scene??shot.id}`);
  return (shot.text_beats||[]).map(beat=>{
   if(!beat.id||ids.has(beat.id))throw Error(`Missing/duplicate text id ${beat.id}`);ids.add(beat.id);
   let start=scene.start+finite(beat.start??0,`${beat.id}.start`);
   if(beat.start_ref){const r=beat.start_ref,array=eventArrays[r.event];
    if(!array||!Number.isInteger(r.index??0)||array[r.index??0]===undefined)throw Error(`Unknown event for ${beat.id}`);
    start=array[r.index??0]+finite(r.offset??0,'event offset');}
   const end=scene.start+finite(beat.end,`${beat.id}.end`);
   if(start<scene.start||end>scene.start+scene.dur+1e-6||end<=start)throw Error(`Text beat outside scene: ${beat.id}`);
   const count=charsOf(beat.text).length,entry=beat.entry||{},exit=beat.exit||{};
   const highlights=resolveHighlights(beat);
   const complete=Math.max(...charsOf(beat.text).map((_,i)=>{
    const h=highlights.find(h=>i>=h.start&&i<h.end),en={...entry,...h?.entry};
    return start+(en.duration??.45)+i*(en.stagger??.025);
   }));
   const outStart=exit.start===undefined?end-(exit.duration??.35)-Math.max(0,count-1)*(exit.stagger??.012):scene.start+exit.start;
   if(outStart<complete||outStart+(exit.duration??.35)+Math.max(0,count-1)*(exit.stagger??.012)>end+1e-6)
    throw Error(`Text exit overlaps entry or exceeds end: ${beat.id}`);
   return {...beat,start,end,exit:{...beat.exit,start:beat.exit?.start===undefined?undefined:scene.start+beat.exit.start},highlights};
  });
 });
}

// Finite, deterministic, multi-axis accents; compose with a slow camera separately.
export function accentAt(t,events=[]){
 let dx=0,dy=0,zoom=1;
 for(const e of events){
  const at=finite(e.at,'accent at'),duration=finite(e.duration??.45,'accent duration');
  if(duration<=0)throw Error('Invalid accent duration');
  const x=finite(e.x??0,'accent x'),y=finite(e.y??0,'accent y'),z=finite(e.zoom??0,'accent zoom');
  const hz=finite(e.hz??9,'accent hz');if(hz<0||Math.abs(z)>.25)throw Error('Invalid accent hz/zoom');
  const d=t-at;if(d<=0||d>=duration)continue;
  const u=d/duration,env=Math.sin(Math.PI/2*Math.min(1,u/.15))*Math.exp(-5*u)*(1-u)*(1-u);
  dx+=x*env*Math.sin(2*Math.PI*hz*d);
  dy+=y*env*Math.sin(2*Math.PI*hz*d+Math.PI/3);
  zoom*=1+z*env;
 }
 return {dx,dy,zoom};
}

export function accentLayer(g,state,draw,{pivot=[960,650],strength=1}={}){
 if(!Number.isFinite(strength)||strength<0||strength>1)throw Error('Invalid accent strength');
 const z=1+(state.zoom-1)*strength;
 g.save();g.translate(state.dx*strength+pivot[0],state.dy*strength+pivot[1]);g.scale(z,z);g.translate(-pivot[0],-pivot[1]);
 try{draw(g);}finally{g.restore();}
}

export function cameraLayer(g,camera,draw,{viewport={x:0,y:0,w:1920,h:1080}}={}){
 const {x=960,y=540,zoom=1}=camera;
 if(!Number.isFinite(x)||!Number.isFinite(y)||!Number.isFinite(zoom)||zoom<=0)throw Error('Invalid camera');
 g.save();g.beginPath();g.rect(viewport.x,viewport.y,viewport.w,viewport.h);g.clip();
 g.translate(viewport.x+viewport.w/2,viewport.y+viewport.h/2);g.scale(zoom,zoom);g.translate(-x,-y);
 try{draw(g);}finally{g.restore();}
}

// New events use darken = black overlay opacity. Legacy dark remains a transmittance alias.
export function impactAt(t,events,{pushDur=.13,fallDur=.08,darkRise=.15,darkFall=.2}={}){
 if([pushDur,fallDur,darkRise,darkFall].some(v=>!Number.isFinite(v)||v<=0))throw Error('Invalid impact durations');
 let dx=0,dy=0,transmittance=1;
 for(const e of events){
  const at=finite(e.at??0,'impact at'),d=t-at;
  if(e.push){const k=d<=0?clamp((d+pushDur)/pushDur):clamp(1-d/fallDur);
   const angle=e.angle??Math.PI/2;dx+=k*e.push*Math.cos(angle);dy+=k*e.push*Math.sin(angle);}
  const opacity=e.darken??(e.dark===undefined?0:1-e.dark);
  if(!Number.isFinite(opacity)||opacity<0||opacity>1)throw Error('darken must be in [0,1]');
  const k=d<=0?clamp((d+darkRise)/darkRise):clamp(1-d/darkFall);
  transmittance*=1-opacity*k;
 }
 return {dx,dy,dark:transmittance,opacity:1-transmittance};
}

export function flash(g,t,events,{color='#000',w=1920,h=1080,...timing}={}){
 const opacity=impactAt(t,events,timing).opacity;
 if(opacity>.001){g.save();g.globalAlpha*=opacity;g.fillStyle=color;g.fillRect(0,0,w,h);g.restore();}
}
