# 行内浮动与信号重音 · v0.4

用于用户选择《唐朝烽火》这类持续字波、节点信号、重音反馈的参考。V32局部稳定段与V02字波都成立；先决定本片参考段，不能只因题材相同就给所有文字加波动。以下参数是风格迁移的设计起点，不是反推得到的原作者公式。

## 参考证据

V02视频流1920×1080/30fps/6990帧/233s。全片自动指标和逐秒总览覆盖全部；局部连续计算/复核包括1.4–4.4s、9–14.4s字波，2–2.6s重点字与描线，11.4–12.8s建筑重音配准，30.4–32.4s扩散环、38.5–40.5s路径亮头。不是6990帧全部人工逐帧审阅。

9–14.4s前四字的拟合振幅约3.86–3.96px、频率约.411Hz、RMSE约.64–.68px，相邻字有相位差。整行看起来在浮动，实际上不是各字同相的刚体平移。带下划线ROI的质心受描线污染；不能拿它估计真实字幅。建筑重音包含横纵反向变化、短暂缩放与慢推近，文字位移更小。

## 文字合同

```json
{
  "id":"signal", "text":"信号沿路线向前。",
  "x":105,"y":150,"font_px":80,"start":0.3,"end":7.9,
  "entry":{"type":"assemble","duration":0.5,"stagger":0.028,"blur":7},
  "hold":{"profile":"v02","time_origin":0,"phase":0.4},
  "highlights":[{
    "text":"信号","font_px":98,"weight":700,"color":"#d9ad58",
    "entry":{"scale_from":1.45,"blur":12,"duration":0.65},
    "underline":{"delay":1.5,"duration":0.55,"width":2,"offset":14}
  }],
  "exit":{"duration":0.35,"stagger":0.015,"blur":9}
}
```

- `hold.profile:'v02'` 等价于wave/amp4/hz.41/phase_step−.65/decay0；显式字段可覆盖。默认仍static，兼容旧作品。`mode:'line'` 是可选同相整行浮动，本轮没把它认定为V02测得的主运动。
- `phase`弧度、`time_origin`是解析后时间轴的绝对秒，跨句连续波动可共用0；想每句重启可填实际入场绝对时刻。不自动把场内time_origin再平移。入场与退出的波幅平滑变化。
- `highlights`的font_px/weight/entry只影响对应短语；entry覆盖该行entry字段，仍按字符在整行的索引错峰，不是独立文本时间轴。实际测量每字的对应字体宽度后布局；不能只换ctx.font而沿用原字号字宽。检查大字入场时的临时重叠与行距。
- 重点词应唯一；重复子串默认第一次，可用start/end显式定位（Unicode字符索引）。重叠范围会报错。`resolveTextBeats`按每字entry检查读清/退场预算。
- `highlight.underline`是整条固定基线描线，delay相对该句开始，duration是左到右描出的时间；不会随每个字上下分裂。旧beat.underline仍是随字逐块画线，仅为兼容保留。

## 分层重音

```js
const events=[{at:9.5,duration:.45,x:16,y:14,zoom:.022,hz:9}];
const hit=accentAt(t,events);
accentLayer(g,hit,()=>cameraLayer(g,slowCamera,()=>drawWorld(g,t)),{pivot:[960,650]});
accentLayer(g,hit,()=>renderTextBeats(g,beats,t),{pivot:[105,160],strength:.16});
```

accentAt在事件at之后发生有限时长的横纵回弹，小幅zoom是比例增量；事件前后精确identity，可回跳。x/y是通道幅度参数，经过包络后的实际峰值小于它，不当作实测位移。strength将位移与zoom衰减，世界/屏幕层按需选择；固定说明通常不参与。慢相机与重音分开叠加，不把持续推近当抖动。旧impactAt/flash仍独立用于单次push/显式压暗，不把亮度跌落自动解释为黑闪。

## 世界坐标里的信号

从 `signal-kit.js` 导入（history-kit也再导出）。

```js
const path=makeSignalPath([[200,760],[600,680],[1000,700],[1500,500]]);
const state=pathSignal(g,path,t,{at:2,duration:4,tail:.18,spacing:18,lit_alpha:.5});
// path.stops是顶点的真实弧长进度；节点点亮用它，不用等分索引。
nodes.forEach((n,i)=>drawNode(n,state.progress>=path.stops[i]));
pulseRing(g,1500,500,t,{at:6,radius:130,duration:1.3,rings:3,gap:.3,dash:[10,7]});
const counter=countState(t,{at:8.5,duration:4.4,from:0,to:440,thresholds:[100,200,300,400]});
// counter.value用于读数，counter.level用于节点数量；共享阈值时刻驱动重音。
```

pathSignal有点列底线、已走亮线、局部衰减尾迹、亮头与到站环；tail为总路长比例，不能把线型全都称省界。到站停留后头光淡掉；已走路线按lit_alpha保留。`head:false,trails:false,arrival_ring:false`用于关掉装饰通道做对照。pulseRing的flatten控制椭圆投影，dash是Canvas虚线数组，rings/gap控制多圈。

数字阈值应来自本片已核实事实；内置示例的100/200等只是技术读数，不能作为唐朝制度依据。countState递增向下取整，避免显示值提前跨阈值；下降读数使用向上取整。场景火/烟、文书、环境染色需继续按对象建模。

## 可运行示例

`create-project.mjs --template v02 --out <新目录>`生成24秒静音示例，预览有同一画面动效开关。完整导出仍使用 `render.mjs --fps 30`。示例的前8秒展示字波/重点/描线，中7秒展示计数阈值/分层轻震，后9秒展示路径/到站环。它是接口验证，地形/建筑/火焰为矢量示意，不能声称与原片材质一致。

验收需要读清后的连续帧、重音前中后和同一时刻开关对照；以真实Canvas字宽/父alpha与filter、回跳输出核对代码实际使用，不能用函数存在代替成片检查。
