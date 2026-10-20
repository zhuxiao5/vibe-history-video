# 文字动作与视觉焦点 · v0.4.0

先决定观众此刻应看哪个对象、哪一次变化，再选择文字、镜头与效果。「横向归位 + 局部稳定」与「持续字波 + 取景/重音」是两类不同的处理路线，各有适用场合；代码参数是可调整的设计控制，不声称复现了任何原片公式。接口与可运行示例见 [文字动效配置](motion-profiles.md)。

## 让分镜成为实际绘制的数据

将 `shots.json` 中每场的 `text_beats` 直接加载，配 `events.js` 的 SCENES 解析。字号、文字、位置与时刻只在此写一份。新示例已经按这一接口实现。

```js
import {resolveTextBeats,renderTextBeats,cameraLayer} from './motion-kit.js';
import {SCENES,ARROW1} from './events.js';
let beats;
export const ready = (async()=>{
  const response=await fetch('./shots.json');
  if(!response.ok)throw Error('Missing shots.json');
  const shots=await response.json();
  beats=resolveTextBeats(shots,SCENES,{ARROW1});
  await document.fonts.load('600 80px "Songti SC"');
})();
export function render(g,t){
  // 先绘制世界中的对象，再绘制屏幕叙事；具体背景按作品实现。
  cameraLayer(g,{x:900,y:590,zoom:1.4},()=>drawWorld(g,t),
    {viewport:{x:80,y:310,w:1760,h:580}});
  renderTextBeats(g,beats,t);
}
```

`text_beats` 支持字段：id、text、role、critical、x/y、font_px、font、weight、color、align、start/end、highlights、entry/hold/exit。`start/end` 是相对该场的秒，end 是全部退出的时刻；没有完整读字窗口时改字数/节奏，不压到旧时长。

```json
{
  "id":"result",
  "text":"船偏重，将覆。",
  "role":"emphasis", "critical":true,
  "font_px":84,"x":105,"y":150,"color":"#c76550",
  "start":6.5,"end":11.8,
  "entry":{"type":"assemble","duration":0.5,"stagger":0.025,"blur":7},
  "hold":{"mode":"static"},
  "exit":{"duration":0.35,"stagger":0.015,"blur":9}
}
```

- `entry.type='assemble'` 提供字符横向归位；`resolve` 只错峰解析。可调 x_from/y_from、tracking_from、scale_from、blur、duration、stagger。它们是独立通道，不凭 OCR 前缀判定是哪种。
- `hold.mode='static'`为代码兼容默认；本片选择V02持续字波时使用 `hold.profile='v02'`，不要漏掉读清后的运动。其他wave可设置amp/hz/phase_step/decay/phase/time_origin；可选line是同相浮动。波浪从入场平滑衔接，没有解析阈值跳位。
- `exit` 支持 duration/stagger/blur/x_to/y_to/scale_to；新旧两句可以短暂交叠，但必须实际退掉旧句。每一行单独规定 start/end。
- `highlights` 用 `{text:'关键词',color:'#d9ad58'}` 子串定位，支持对应短语的font_px/weight/entry及独立基线underline，实际字宽进入布局；缺词或重叠会报错。重复子串用start/end明确定位。地名、引用、年份、读数与大数字强调按各自角色排版，不能都套同一个标题入场。
- 与 cue 相绑的文字起点可用 `start_ref:{event:'ARROW1',index:0,offset:-0.25}`；索引必须存在。此时 JSON 的 start 只作计划阅读预算，实际由事件决定，需按解析结果核对时间。关键声画动作从事件数组消费，不重复写绝对时刻。

## 镜头与注意力

cameraLayer 只改变世界坐标里的主体、地形、路径和地名；屏幕叙事在外层绘制。viewport 负责裁切，镜头不得将仍需理解的对象无意裁掉。推拉应让接触点/机制结果变清楚；总景建立关系，局部看动作，结果再回到可比较状态。

一场定义主对象与必要的辅助对象。仪表、小窗、时间轴、出处按需要出现，材质降低对比。代表段须包含一次真实状态变化与一次焦点切换，不能只有漂亮片头。

## 冲击语义

新事件用 `darken` 表示黑色覆盖比例，0 为不压暗、0.2 为压暗20%。`push` 为像素位移（默认0）；未给字段的事件没有对应效果。旧 dark 保留为“剩余透过率”的兼容别名，不要混用；若已迁移为 darken，就更新事件表的数值含义。

```js
const hits=ARROW1.map(at=>({at,push:2})); // 局部主体重音；不必整幅位移
const {dx,dy}=impactAt(t,hits);
```

flash 继承父图层透明度。用在局部对象、世界层还是全画幅由本片决定；不是每个音效都需要闪/抖。均值下降也可能来自拉远、发光物变小或变景，先看原帧再决定是否加黑遮罩。

V02多轴回弹用accentAt/accentLayer，与旧单次push分开。慢摄影机、世界重音、屏幕文字字波可叠加但不共用同一幅度；调用与事件参数见V02参考。

## 验证

`check-contract.py` 检查计划、真实 text_beats 字号与入/出场预算；它不是渲染后的视觉批准。渲染后看关键句完整清晰/让位，以及动作前/当时/后。调试时可令 `g.__textAudit=[]`，drawTextBeat 会记录实际 ctx.font/alpha/位置；结合最终帧核对合同已被真实消费。用父 alpha 降低、回跳取帧、字的启用过渡与可选效果开/关做真实输出验证。

参考分析的4500帧计算不能替代人工关键窗口审阅。原片的精确复刻与新作品的风格迁移分开验收，不给没有方法的相似度百分比。
