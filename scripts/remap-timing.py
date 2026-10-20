#!/usr/bin/env python3
"""按新文案自动重排画面时刻。

**为什么需要这个工具**：
压缩片长（比如 180s → 115s）之后，`scene.js` 里几十处写死的
`phase(t, a, b)` 全都不再对准文案，`check-timing.py` 会一次报出十几处越界。
手工逐处改又慢又容易漏。

本工具建一个**分段线性映射**：
    旧场相对秒 → 新场相对秒
锚点 =「该场每句的起点与终点」（旧 beat.start/end ↔ 新 beat.start/end）。
然后把它套到该场内每一处 `phase(t, a, b)`，以及带 `i*Y` 偏移的形式。

这样画面动作**自动跟住文案**：原本「第 3 句说到 X 时触发」，
重排后仍在第 3 句的对应位置触发。

用法：
    # 必须先准备好新旧两份 shots.json
    python check-timing.py --root <工程目录>            # 先看越界
    python remap-timing.py --root <工程目录> \\
        --old <旧 shots.json> [--dry-run]
    python check-timing.py --root <工程目录>            # 复查应为 0
"""
import argparse
import json
import pathlib
import re
import sys


def build_map(old, new):
    maps = {}
    for so, sn in zip(old['shots'], new['shots']):
        if so['id'] != sn['id']:
            sys.exit(f'✖ 场次对不上：{so["id"]} vs {sn["id"]}')
        pts = [(0.0, 0.0), (so['end'] - so['start'], sn['end'] - sn['start'])]
        for bo, bn in zip(so['text_beats'], sn['text_beats']):
            pts.append((bo['start'], bn['start']))
            pts.append((bo['end'], bn['end']))
        pts.sort()
        mono = [pts[0]]
        for p in pts[1:]:
            if p[0] > mono[-1][0] + 1e-9:
                mono.append(p)
        maps[so['id']] = mono
    return maps


def make_remap(m):
    def remap(v):
        if m[-1][0] <= m[0][0]:
            return v
        if v <= m[0][0]:
            return m[0][1]
        if v >= m[-1][0]:
            (x0, y0), (x1, y1) = m[-2], m[-1]
            k = (y1 - y0) / (x1 - x0) if x1 > x0 else 1.0
            return y1 + (v - x1) * k
        for (x0, y0), (x1, y1) in zip(m, m[1:]):
            if x0 <= v <= x1:
                k = (y1 - y0) / (x1 - x0) if x1 > x0 else 1.0
                return y0 + (v - x0) * k
        return v
    return remap


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--root', default='.', help='工程目录（含 scene.js / shots.json）')
    ap.add_argument('--old', required=True, help='旧 shots.json（重排前的时间轴）')
    ap.add_argument('--backup', action='store_true', help='重排前把 scene.js 备份到 /tmp')
    ap.add_argument('--dry-run', action='store_true', help='只打印，不写回')
    a = ap.parse_args()

    root = pathlib.Path(a.root).resolve()
    scene = root / 'scene.js'
    old = json.loads(pathlib.Path(a.old).read_text(encoding='utf-8'))
    new = json.loads((root / 'shots.json').read_text(encoding='utf-8'))
    if not scene.exists():
        sys.exit(f'✖ 找不到 {scene}')

    maps = build_map(old, new)
    src = scene.read_text(encoding='utf-8')
    if a.backup:
        import shutil, time
        dst = pathlib.Path(f'/tmp/scene-before-remap-{time.strftime("%H%M%S")}.js')
        shutil.copy(scene, dst)
        print(f'已备份 scene.js → {dst}')

    report = []
    for sh in new['shots']:
        sid = sh['id']
        if sid not in maps:
            print(f'  ⚠️ {sid} 不在旧时间轴里，跳过')
            continue
        remap = make_remap(maps[sid])
        i = src.find(f'function {sid.lower()}(g,t)')
        if i < 0:
            print(f'  ⚠️ 找不到 function {sid.lower()}')
            continue
        j = src.find('\nfunction ', i + 10)
        if j < 0:
            j = src.find('// ══', i + 10)
        body = src[i:j]

        def sub(m):
            x, y = float(m.group(1)), float(m.group(2))
            nx, ny = round(remap(x), 1), round(remap(y), 1)
            if ny <= nx:
                ny = round(nx + 0.3, 1)
            report.append((sid, x, y, nx, ny, ''))
            return f'phase(t,{nx},{ny})'

        def sub_i(m):
            a0, ai, b0, bi = [float(v) for v in m.groups()]
            na0 = round(remap(a0), 1)
            nai = round(remap(a0 + ai) - remap(a0), 2)
            nb0 = round(remap(b0), 1)
            nbi = round(remap(b0 + bi) - remap(b0), 2)
            if nbi <= 0:
                nbi = round(nai, 2)
            report.append((sid, a0, b0, na0, nb0, f'i*{nai}/{nbi}'))
            return f'phase(t,{na0}+i*{nai},{nb0}+i*{nbi})'

        body = re.sub(
            r'phase\(t,\s*([\d.]+)\s*\+\s*i\s*\*\s*([\d.]+)\s*,\s*'
            r'([\d.]+)\s*\+\s*i\s*\*\s*([\d.]+)\s*\)', sub_i, body)
        body = re.sub(r'phase\(t,\s*([\d.]+)\s*,\s*([\d.]+)\s*\)', sub, body)
        src = src[:i] + body + src[j:]

    print(f'\n重排 {len(report)} 处：')
    print(f'{"场":5s} {"旧":>15s} {"新":>15s}')
    for sid, x, y, nx, ny, extra in report:
        print(f'{sid:5s} {x:6.1f}→{y:6.1f} {nx:6.1f}→{ny:6.1f}  {extra}')

    if a.dry_run:
        print('\n(dry-run，未写回)')
    else:
        scene.write_text(src, encoding='utf-8')
        print(f'\n已写回 {scene}')
    print('下一步：python check-timing.py --root ' + a.root + '   → 应为 0 越界')
    return 0


if __name__ == '__main__':
    sys.exit(main())
