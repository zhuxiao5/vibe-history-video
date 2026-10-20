#!/usr/bin/env python3
"""为 10 张背景图逐张标定亮度系数，并压暗入调。

⚠️ 为什么必须逐张标定（实测）：
  用户上期给的两张原图，平均亮度 26.5 vs 35.9 —— **差 35%**。
  如果用同一个系数，一张合适、另一张就一定偏亮或偏暗。
  gpt-image 生成的图同样参差（本次 31.6–37.7）。

标定原则：
  让**字幕带（y866–944）够暗**，且**上半幅进系列区间（14–22）**。
  从 0.75 起逐档下探，取第一个满足条件的。

用法：
  cd <工程目录> && python <skill>/scripts/calibrate-bg.py --srcdir assets/bg/gen --outdir assets/bg
"""
import argparse
import json
import pathlib
import sys

import numpy as np
from PIL import Image, ImageFilter

W, H = 1920, 1080
BAND_Y0, BAND_Y1 = 866, 944
TOP_Y1 = 820
# 合格线
BAND_MAX_MEAN = 55          # 字幕带平均亮度上限
BAND_MAX_BRIGHT = 1.0       # 字幕带亮像素(>150) 占比上限 %
TOP_TARGET = (14, 26)       # 上半幅目标区间
TINT = np.array([1.05, 0.99, 0.88])   # 暖褐


def measure(arr):
    g = arr.mean(axis=2)
    band = g[BAND_Y0:BAND_Y1]
    return {
        'top': float(g[:TOP_Y1].mean()),
        'band': float(band.mean()),
        'band_bright_pct': float((band > 150).mean() * 100),
        'full': float(g.mean()),
    }


def process(src, bright, lift_lo=6, lift_hi=238, sat=0.80, blur=0.6):
    im = Image.open(src).convert('RGB').resize((W, H), Image.LANCZOS)
    a = np.asarray(im, dtype=np.float64) * bright
    a = np.clip((a - lift_lo) * (255.0 / lift_hi), 0, 255)
    g = a.mean(axis=2, keepdims=True)
    a = g + (a - g) * sat
    a *= TINT
    out = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))
    return out.filter(ImageFilter.GaussianBlur(blur))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--srcdir', default='assets/bg/gen')
    ap.add_argument('--outdir', default='assets/bg')
    a = ap.parse_args()
    # ⚠️ 必须用**当前工作目录**，不能用脚本所在目录——
    #    技能包脚本要在任意项目目录下可跑。
    root = pathlib.Path.cwd()
    src = pathlib.Path(a.srcdir)
    if not src.is_absolute():
        src = root / a.srcdir
    out = pathlib.Path(a.outdir)
    if not out.is_absolute():
        out = root / a.outdir
    out.mkdir(parents=True, exist_ok=True)

    files = sorted(f for f in src.glob('*.png') if f.name.startswith('fig'))
    if not files:
        sys.exit(f'✖ {src} 下找不到 fig*.png')

    report = {}
    for f in files:
        chosen, m = None, None
        # 从亮到暗逐档下探
        for b in [round(0.80 - i * 0.03, 2) for i in range(14)]:
            arr = np.asarray(process(f, b), dtype=np.float64)
            m = measure(arr)
            if (m['band'] <= BAND_MAX_MEAN
                    and m['band_bright_pct'] <= BAND_MAX_BRIGHT
                    and TOP_TARGET[0] <= m['top'] <= TOP_TARGET[1]):
                chosen = b
                break
        if chosen is None:                       # 退而求其次：只保字幕带
            for b in [round(0.55 - i * 0.03, 2) for i in range(10)]:
                arr = np.asarray(process(f, b), dtype=np.float64)
                m = measure(arr)
                if (m['band'] <= BAND_MAX_MEAN
                        and m['band_bright_pct'] <= BAND_MAX_BRIGHT):
                    chosen = b
                    break
        if chosen is None:
            chosen = 0.40
            m = measure(np.asarray(process(f, chosen), dtype=np.float64))

        dst = out / f.name.replace('fig', 'bg-')
        process(f, chosen).save(dst)
        ok = (m['band'] <= BAND_MAX_MEAN and m['band_bright_pct'] <= BAND_MAX_BRIGHT)
        report[f.name] = {'bright': chosen, 'measures': m,
                          'ok': ok, 'out': dst.name}
        print(f"{f.name}")
        print(f"   系数 {chosen}  →  上半幅 {m['top']:5.1f}  "
              f"字幕带 {m['band']:5.1f}  亮像素 {m['band_bright_pct']:5.2f}%  "
              f"{'✅' if ok else '⚠️'}")

    (out / 'calibrate-report.json').write_text(
        json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')

    bs = [v['bright'] for v in report.values()]
    print(f'\n{len(report)} 张 ｜ 系数范围 {min(bs)}–{max(bs)}'
          f'（跨度 {max(bs)-min(bs):.2f}）')
    print(f'合格 {sum(1 for v in report.values() if v["ok"])}/{len(report)}')
    print(f'报告 → {out}/calibrate-report.json')
    return 0


if __name__ == '__main__':
    sys.exit(main())
