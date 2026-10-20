#!/usr/bin/env python3
"""检查 scene.js 里所有动画时刻是否超出各场场长。

为什么需要：
  把文案从 210 秒压到 180 秒时，**文案改短了，但画面里写死的时刻没跟着改**。
  S03 的卡片三写着 `phase(t, 45.0, 47.5)`，而 S03 只有 42 秒 ——
  45 秒超出场长，于是**这张卡片永远不会出现**，观众看到的是"第三份文献
  还没显示就直接跳到下一个画面"。

  这类错误**不会报错、不会崩**，只是画面里少了一段内容。
  靠肉眼很难发现（我看了好几遍都没注意到）。

判据：每一场内，所有 `phase(t, a, b)` 的 b 必须 ≤ 该场场长。
      带 `i*Y` 偏移的形式（如年代轴三点）按 i 最大 2 计算。

用法：python check-timing.py --root <工程目录>
"""
import argparse
import json
import re
import sys
from pathlib import Path


def main():
    ap = argparse.ArgumentParser(description='检查动画时刻是否超出场长')
    ap.add_argument('--root', default='.', help='工程目录（含 scene.js / shots.json）')
    a = ap.parse_args()
    root = Path(a.root).resolve()
    SCENE = root / 'scene.js'
    SHOTS = root / 'shots.json'
    if not SCENE.exists() or not SHOTS.exists():
        sys.exit(f'✖ {root} 下找不到 scene.js / shots.json')
    s = SCENE.read_text(encoding='utf-8')
    c = json.loads(SHOTS.read_text(encoding='utf-8'))
    total = 0
    for sh in c['shots']:
        sid = sh['id']
        d = sh['end'] - sh['start']
        # 场函数名可能带后缀（如 s01Map）——用正则找「function s01...」，
        # 不要硬匹配 function s01(，否则会漏检整个场。
        import re as _re
        m = _re.search(rf'function {sid.lower()}\w*\(g,t\)', s)
        if not m:
            print(f'  {sid}: 找不到函数（检查命名是否以 {sid.lower()} 开头）')
            continue
        i = m.start()
        j = s.find('\nfunction ', i + 10)
        if j < 0:
            j = s.find('// ══', i + 10)
        body = s[i:j if j > 0 else len(s)]

        bad = []
        for m in re.finditer(r'phase\(t\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*\)', body):
            a, b = float(m.group(1)), float(m.group(2))
            if b > d + 0.01:
                bad.append((b, m.group(0)))
        for m in re.finditer(
                r'phase\(t\s*,\s*([\d.]+)\s*\+\s*i\s*\*\s*([\d.]+)\s*,\s*'
                r'([\d.]+)\s*\+\s*i\s*\*\s*([\d.]+)\s*\)', body):
            a0, ai, b0, bi = [float(x) for x in m.groups()]
            bmax = b0 + 2 * bi
            if bmax > d + 0.01:
                bad.append((bmax, m.group(0)[:46] + ' [i=2]'))

        if bad:
            print(f'  ⚠️ {sid}（场长 {d:.0f}s）：')
            for b, txt in bad:
                print(f'      {txt}  → 结束 {b:.1f}s，越界 {b - d:.1f}s')
            total += len(bad)
        else:
            print(f'  ✅ {sid}（场长 {d:.0f}s）')
    print()
    print(f'越界合计：{total} 处')
    return 1 if total else 0


if __name__ == '__main__':
    sys.exit(main())
