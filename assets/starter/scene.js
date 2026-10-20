import {resolveTextBeats,renderTextBeats} from './motion-kit.js';
import {C,serif,background,sentence,terrain,route,pathPoint,station,rider,person,scroll,seal,timeline,text,line,ellipse,glow,layer,phase,ease,mix} from './history-kit.js';
export const width=1920,height=1080;
export let duration=24;
export const title='一封急信的路';
export const description='24 秒静音风格技术样片；驿递机制示意，非特定朝代复原。';
export const fontReady=typeof document!=='undefined'?document.fonts.load(`600 84px ${serif}`):Promise.resolve();
let beats,scenes;
export const ready=(async()=>{await fontReady;const r=await fetch('./shots.json');if(!r.ok)throw Error('Missing shots.json');const contract=await r.json();duration=contract.duration;scenes=contract.shots.map(s=>({name:s.id,start:s.start,dur:s.end-s.start}));beats=resolveTextBeats(contract,scenes);})();
const way=[[210,812],[350,775],[470,796],[585,701],[739,689],[883,736],[1027,661],[1180,670],[1330,594],[1490,611],[1693,512]];
const stops=[0,.34,.67,1];

function overview(g,t){
 terrain(g,{x:0,y:360,w:1920,h:570});
 const p=ease(phase(t,1.4,6.2));route(g,way,p);
 stops.forEach((u,i)=>{const [x,y]=pathPoint(way,u);station(g,x,y,.48,{lit:p>=u});text(g,['边地','第一站','第二站','目的地'][i],x,y+80,69,p>=u?C.ink:C.muted,'center');if(p>=u)glow(g,x,y-30,65,'218,164,72',.13);});
 timeline(g,['路途','交接','记录'],0);
}

function handoff(g,t){
 terrain(g,{x:0,y:540,w:1920,h:330});
 line(g,[[70,850],[1840,850]],'#97805b',1.5);
 station(g,978,818,1.48);
 const incoming=mix(220,648,ease(phase(t,0,2.2)));
 rider(g,incoming,844,1.0,{t,moving:t<2.2,letter:t<2.0});
 const outgoing=mix(1248,1830,ease(phase(t,5.2,7.8)));
 rider(g,outgoing,844,1.0,{t,moving:t>5.2,letter:t>=5.2});
 const messenger=mix(786,1116,ease(phase(t,2.5,4.6)));
 person(g,messenger,844,1.15,{arm:1});
 let x=messenger+41,y=766;
 if(t<2.5){const p=ease(phase(t,2.0,2.5));x=mix(625,827,p);y=mix(724,766,p);}
 if(t>4.6){const p=ease(phase(t,4.6,5.2));x=mix(1157,1225,p);y=mix(766,724,p);}
 if(t>=2.0&&t<5.2){glow(g,x,y,45,'225,166,65',.14);g.fillStyle=C.red;g.fillRect(x-8,y-12,16,24);line(g,[[x-8,y-6],[x+8,y-6]],C.gold,1);}
 layer(g,ease(phase(t,2.2,2.7)),()=>text(g,'到站停下',648,936,69,C.muted,'center'));
 layer(g,ease(phase(t,5.2,5.8)),()=>text(g,'接信出发',1370,936,69,C.gold,'center'));
 timeline(g,['路途','交接','记录'],1);
}

function ledger(g,t){
 scroll(g,805,340,914,510);
 line(g,[[852,462],[1670,462]],'#80663d',1);
 station(g,355,728,.84);person(g,250,779,1.5,{arm:1});
 text(g,'文书内容为流程示意',1262,815,24,'#796544','center');
 timeline(g,['路途','交接','记录'],2);
}

export function render(g,t){
 t=Math.max(0,Math.min(duration-.0001,t));background(g);
 const index=scenes.findIndex(s=>t>=s.start&&t<s.start+s.dur),scene=scenes[index],local=t-scene.start;
 // Continuous fade only at cuts; the explanation gets a stable hold at each end.
 const alpha=local<.25?ease(local/.25):local>scene.dur-.3?ease((scene.dur-local)/.3):1;
 layer(g,alpha,()=>[overview,handoff,ledger][index](g,local));
 renderTextBeats(g,beats,t);
 text(g,'驿递机制示意 · 非特定朝代复原',1810,1051,20,C.muted,'right');
}
