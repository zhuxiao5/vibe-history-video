// 本题专用画面程序：草船借箭（孙权 · 濡须口 213）
// 依据：references/style.md 的「暗色叙事图解 + 暗色地理机制」两族混用。
// 画面为机制示意，不是文物复原、不是实测比例。
import {
  grain,
  C, serif, sans, background, sentence, sentenceGrow, terrain, scroll, seal, timeline,
  text, line, poly, ellipse, glow, layer, phase, ease, mix, clamp, hash,
  impactAt, flash,
} from './history-kit.js';
// 箭矢落点与场景表都由 cues.json 经 synth.py --emit 生成 —— 音效与画面共用同一份数据。
// 不要在这里手写 27.0 + i*0.4 或分场时长，否则改一处就会音画错位。
import { SCENES, ARROW1, ARROW2 } from './events.js';

const SC = Object.fromEntries(SCENES.map((s) => [s.name, s]));
const LAST = SCENES[SCENES.length - 1];

/* ============================ 通用图元 ============================ */

// 水带：波面随时间起伏（三层正弦叠加），吃水遮盖与船体的水线相对变化都靠它
function water(g, y, t, alpha = 1) {
  const surf = (x) => y
    + Math.sin(x * 0.0073 + t * 1.15) * 3.4
    + Math.sin(x * 0.0161 - t * 1.90) * 1.7
    + Math.sin(x * 0.0037 + t * 0.63) * 2.3;
  g.beginPath();
  g.moveTo(0, surf(0));
  for (let x = 24; x <= 1920; x += 24) g.lineTo(x, surf(x));
  g.lineTo(1920, 1080); g.lineTo(0, 1080); g.closePath();
  const q = g.createLinearGradient(0, y, 0, 1080);
  q.addColorStop(0, `rgba(21,46,53,${alpha})`);
  q.addColorStop(1, `rgba(7,17,23,${alpha})`);
  g.fillStyle = q;
  g.fill();
  for (let i = 0; i < 14; i += 1) {
    const yy = y + 22 + i * 32 + hash(i) * 10;
    const amp = 2.4 + i * 0.24;
    const rr = [];
    for (let x = 0; x <= 1920; x += 32) {
      rr.push([x, yy + Math.sin(x * 0.009 + t * (1.1 + i * 0.07) + i) * amp]);
    }
    line(g, rr, `rgba(120,191,208,${0.026 + hash(i + 3) * 0.03})`, 1);
  }
  const sl = [];
  for (let x = 0; x <= 1920; x += 24) sl.push([x, surf(x)]);
  line(g, sl, 'rgba(120,191,208,0.5)', 2);
}

// 船体晃动：小幅摇摆（不参与机制读数，只让画面活起来）
const rockOf = (t) => 1.1 * Math.sin(t * 0.95) + 0.5 * Math.sin(t * 1.83 + 1.2);
const bobOf = (t) => 2.6 * Math.sin(t * 1.25 + 0.4);

function farBank(g, y, { flip = false, seed = 12 } = {}) {
  g.save();
  if (flip) { g.translate(1920, 0); g.scale(-1, 1); }
  for (let r = 0; r < 4; r += 1) {
    const pts = [];
    for (let i = 0; i <= 60; i += 1) {
      const u = i / 60;
      const peak = Math.pow(Math.sin(u * 3.1 + r * 0.9), 2) * (74 - r * 12)
        + Math.sin(u * 11 + r * 2.3) * 9;
      pts.push([u * 1920, y - 6 + r * 7 - peak]);
    }
    poly(g, [...pts, [1920, y + 40], [0, y + 40]], `rgb(${26 + r * 3},${21 + r * 2},${15 + r})`);
    line(g, pts, `rgba(166,136,77,${0.09 + hash(seed + r) * 0.07})`, 1);
  }
  g.restore();
}

function arrowShape(g, len = 58, color = '#e2d2a4') {
  g.beginPath(); g.moveTo(0, 0); g.lineTo(-len, 0);
  g.strokeStyle = color; g.lineWidth = 2.4; g.lineJoin = 'round'; g.stroke();
  poly(g, [[4, 0], [-10, -5], [-10, 5]], '#f6ecd0');
  line(g, [[-len + 5, -6], [-len - 5, 0], [-len + 5, 6]], color, 1.8);
}
function arrowAt(g, x, y, ang, len = 58, color = '#e2d2a4') {
  g.save(); g.translate(x, y); g.rotate(ang); arrowShape(g, len, color); g.restore();
}

const EDGE = [[-119, -96], [-107, 0], [-46, 74]];
function edgePoint(u) {
  const L = EDGE.slice(1).map((p, i) => Math.hypot(p[0] - EDGE[i][0], p[1] - EDGE[i][1]));
  const total = L.reduce((a, b) => a + b, 0);
  let d = clamp(u) * total;
  for (let i = 0; i < L.length; i += 1) {
    if (d <= L[i] || i === L.length - 1) {
      const p = L[i] ? d / L[i] : 0;
      return [mix(EDGE[i][0], EDGE[i + 1][0], p), mix(EDGE[i][1], EDGE[i + 1][1], p)];
    }
    d -= L[i];
  }
  return EDGE[0];
}

// 箭矢锚点：flank=+1 右舷 / -1 左舷。全部落在水线以上，避免被水面遮掉。
function anchorFor(i, flank) {
  if (hash(i * 5.7 + 2) > 0.72) {
    return { x: flank * 54, y: -104 - hash(i * 9.1) * 62, ang: flank === -1 ? -0.3 : Math.PI + 0.3 };
  }
  const p = edgePoint(0.03 + hash(i * 3.1 + 11) * 0.37);
  return { x: flank * Math.abs(p[0]), y: p[1], ang: flank === -1 ? -0.2 : Math.PI + 0.2 };
}

function shipSection(g, { cx, waterY, heel, sx, s }) {
  g.save();
  g.translate(cx, waterY);
  g.rotate((heel * Math.PI) / 180);
  g.scale(sx * s, s);
  poly(g, [[-119, -96], [119, -96], [107, 0], [46, 74], [-46, 74], [-107, 0]], '#3b2f1d', '#a58b5c', 2.5);
  poly(g, [[-127, -106], [127, -106], [119, -92], [-119, -92]], '#5a4829', '#c2a165', 1.5);
  line(g, [[-113, -70], [113, -70]], 'rgba(200,170,110,0.35)', 1.5);
  poly(g, [[-62, -106], [62, -106], [56, -176], [-56, -176]], '#4a3b23', '#a58b5c', 1.5);
  g.fillStyle = '#d0a654';
  g.fillRect(-38, -158, 26, 26); g.fillRect(12, -158, 26, 26);
  line(g, [[-58, -176], [58, -176]], C.gold, 2);
  line(g, [[0, -176], [0, -352]], '#a58b5c', 6);
  line(g, [[-100, -300], [100, -300]], '#8a7448', 4);
  poly(g, [[-92, -296], [92, -296], [84, -268], [-84, -268]], '#2a2317', '#6d5a37', 1);
  poly(g, [[7, -352], [58, -352], [51, -326], [7, -326]], C.red);
  text(g, '吴', 32, -333, 15, '#ebcf95', 'center');
  g.restore();
}

function planInset(g, { x, y, heading }) {
  const w = 300, h = 200, cx = x + w / 2, cy = y + h / 2 + 14;
  g.fillStyle = 'rgba(20,17,12,0.8)';
  g.fillRect(x, y, w, h);
  g.strokeStyle = 'rgba(165,139,92,0.45)'; g.lineWidth = 1.5;
  g.strokeRect(x, y, w, h);
  text(g, '俯视 · 船身与曹营方向', x + 14, y + 26, 20, C.muted, 'left', sans);
  line(g, [[x + w - 26, cy], [x + w - 78, cy]], C.red, 2);
  poly(g, [[x + w - 18, cy], [x + w - 38, cy - 6], [x + w - 38, cy + 6]], C.red);
  g.save(); g.translate(cx, cy); g.rotate(heading);
  g.beginPath();
  g.moveTo(0, -44);
  g.bezierCurveTo(15, -28, 18, 8, 12, 37);
  g.quadraticCurveTo(0, 46, -12, 37);
  g.bezierCurveTo(-18, 8, -15, -28, 0, -44);
  g.closePath();
  g.fillStyle = '#5a4829'; g.fill();
  g.strokeStyle = '#c2a165'; g.lineWidth = 1.8; g.stroke();
  g.beginPath(); g.moveTo(0, -56); g.lineTo(0, 20);
  g.strokeStyle = C.gold; g.lineWidth = 3; g.stroke();
  poly(g, [[0, -62], [-7, -46], [7, -46]], C.gold);
  g.restore();
}

// 曹营：整体位于水线之上，绘制在水面之后，避免被水遮断
function camp(g, y) {
  const bx = 1500;
  poly(g, [[bx, y], [1700, y - 44], [1920, y - 66], [1920, y], [bx, y]], '#1f1a12');
  line(g, [[bx, y], [1700, y - 44], [1920, y - 66]], 'rgba(165,139,92,0.5)', 2);
  for (let i = 0; i < 3; i += 1) {
    const tx = bx + 76 + i * 108, ty = y - 34 - i * 12, s = 1 - i * 0.05;
    poly(g, [[tx - 42 * s, ty], [tx + 42 * s, ty], [tx + 27 * s, ty - 46 * s], [tx - 27 * s, ty - 46 * s]], '#392e1e', '#8a7448', 1.4);
    line(g, [[tx, ty - 46 * s], [tx, ty - 60 * s]], '#8a7448', 2);
  }
  for (let i = 0; i < 11; i += 1) {
    const px = bx + 26 + i * 28;
    line(g, [[px, y - 52 - (i % 3) * 5], [px, y - 2]], 'rgba(140,116,72,0.5)', 2);
  }
  for (let i = 0; i < 5; i += 1) {
    const px = bx + 54 + i * 62, py = y - 56 - (i % 2) * 8;
    ellipse(g, px, py - 10, 4, 5, C.ink);
    line(g, [[px, py - 5], [px, py + 13]], C.ink, 4);
    line(g, [[px, py], [px - 14, py - 6]], C.ink, 3);
  }
  text(g, '曹军营垒 · 示意', 1904, y - 84, 22, C.red, 'right', sans);
}

function tiltGauge(g, x, y, heel, phase) {
  text(g, '船体平衡 · 示意', x, y - 48, 22, C.muted, 'left', sans);
  line(g, [[x, y], [x + 320, y]], 'rgba(120,191,208,0.6)', 1.5);
  g.save();
  g.translate(x + 160, y);
  g.rotate((heel * Math.PI) / 180);
  line(g, [[-160, 0], [160, 0]], Math.abs(heel) > 9 ? C.red : C.gold, 3.5);
  ellipse(g, 0, 0, 5, 5, C.gold);
  g.restore();
  const tone = phase === '偏重' || phase === '加重中' ? C.red
    : phase === '正浮' ? C.muted : C.gold;
  text(g, phase, x, y + 54, 30, tone, 'left', sans);
}

// 状态分阶段，不能只看倾角大小：加重中和回正中都可能落在同一角度上
function gaugePhase(T) {
  if (T < HEEL_UP_A) return '正浮';
  if (T < HEEL_UP_B) return '加重中';
  if (T <= TURN_B) return '偏重';
  if (T <= HEEL_DN_B) return '回正';
  return '箭均船平';
}

function shipProfile(g, x, y, s, { arrows = true, rock = 0 } = {}) {
  g.save(); g.translate(x, y); if (rock) g.rotate((rock * Math.PI) / 180); g.scale(s, s);
  poly(g, [[-230, -86], [-198, -62], [186, -62], [232, -92], [196, 0], [-186, 0]], '#3b2f1d', '#a58b5c', 2.5);
  line(g, [[-198, -40], [196, -40]], 'rgba(200,170,110,0.22)', 1.5);
  poly(g, [[-118, -62], [118, -62], [104, -150], [-104, -150]], '#4a3b23', '#a58b5c', 1.6);
  g.fillStyle = '#d0a654';
  for (let i = 0; i < 3; i += 1) g.fillRect(-70 + i * 56, -128, 30, 26);
  line(g, [[0, -150], [0, -320]], '#a58b5c', 6);
  line(g, [[-96, -272], [96, -272]], '#8a7448', 4);
  poly(g, [[7, -320], [58, -320], [51, -294], [7, -294]], C.red);
  text(g, '吴', 32, -301, 15, '#ebcf95', 'center');
  if (arrows) {
    for (let i = 0; i < 17; i += 1) {
      const u = i / 16;
      arrowAt(g, -228 + u * 442, -26 + hash(i * 4.4) * 48, -0.16 + hash(i * 8.8) * 0.3, 44);
    }
    for (let i = 0; i < 7; i += 1) {
      arrowAt(g, -150 + hash(i * 6.1) * 300, -66 - hash(i * 2.2) * 58, -1.1 + hash(i * 3.3) * 0.5, 36);
    }
  }
  g.restore();
}

/* ======================= 机制状态（跨场连续） ======================= */
// 全部时间锚点派生自 cues.json 导出的箭矢落点，改 cue 表则音画同步移动。
const TURN_A = ARROW2[0] - 2.2;              // 掉头开始：第二轮首箭落点前 2.2s
const TURN_B = TURN_A + 0.9;                 // 掉头完成
const HEEL_UP_A = ARROW1[0];                 // 开始倾斜：第一轮首箭落点
const HEEL_UP_B = ARROW1[0] + 6.0;           // 倾斜到最大
const HEEL_DN_B = ARROW2[ARROW2.length - 1] + 0.1;   // 回正完成：末箭落点之后
const TURN_MIN = 0.22;                 // 掉头时横向压缩下限：不归零，避免整帧空白
// 掉头窗口内返回两遍（正/反各一遍）做交叉溶解，避免单帧镜像跳位
function posePasses(raw) {
  if (Math.abs(raw) >= TURN_MIN) return [{ sx: raw, alpha: 1 }];
  const w = (raw + TURN_MIN) / (2 * TURN_MIN);
  return [{ sx: -TURN_MIN, alpha: 1 - w }, { sx: TURN_MIN, alpha: w }];
}
function mechState(T) {
  const raw = T <= TURN_A ? -1 : T >= TURN_B ? 1 : mix(-1, 1, ease(phase(T, TURN_A, TURN_B)));
  const passes = posePasses(raw);
  const sx = passes[passes.length - 1].sx;
  // Illustrative load follows landed arrows; rotation alone cannot rebalance the hull.
  const load=arr=>arr.reduce((sum,at)=>sum+ease(phase(T,at,at+.25)),0)/arr.length;
  const local13=13*(load(ARROW1)-load(ARROW2));
  const heel = -1 * (raw < 0 ? -1 : 1) * local13;
  const heading = -1 * (T <= TURN_A ? 0 : mix(0, Math.PI, ease(phase(T, TURN_A, TURN_B + 0.4))));
  const shots = [
    ...ARROW1.map((land, i) => ({ i, flank: -1, land })),
    ...ARROW2.map((land, i) => ({ i: ARROW1.length + i, flank: 1, land })),
  ];
  return { sx, passes, heel, heading, shots };
}


export {water,farBank,shipSection,arrowAt,anchorFor,mechState,gaugePhase};
