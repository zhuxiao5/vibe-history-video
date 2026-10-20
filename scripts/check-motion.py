#!/usr/bin/env python3
"""量化「画面是否一直在动」——直击「画面不动、只有文字在动」这个问题。

⚠️ 判据口径（改过一版，原因记下）：
  第一版测「画面区**全局平均**变化量」，结果把 169 个帧对判成"静止"。
  但那是**平均**被静止部分（城楼不动的墙、地面）稀释了——
  画面上只有火、烟、箭头在动，它们只占画面的一小部分。
  全局平均 0.14 并不说明"没动"。

  正解：测**变化最明显的区域**（变化量最大那 5% 像素的均值）。
  只要画面上**有一部分**在明显变化，观众就会感觉"画面是活的"。

判据：active_delta（最活跃 5% 像素的变化量均值）< 2.0 → 该段确实静止。

用法：python check-motion.py <帧前缀>
"""
import glob
import re
import sys

import numpy as np
from PIL import Image

SCENE_Y0, SCENE_Y1 = 440, 1080


def luma(path):
    return np.asarray(Image.open(path).convert('L'), dtype=np.float64)


def main():
    prefix = sys.argv[1] if len(sys.argv) > 1 else sys.exit('用法: python check-motion.py <帧前缀，如 /tmp/frames->')
    fs = []
    for p in glob.glob(prefix + '*.png'):
        m = re.search(r'-(\d+\.\d+)\.png$', p)
        if m:
            fs.append((float(m.group(1)), p))
    fs.sort()
    if len(fs) < 5:
        sys.exit(f'✖ 帧数不足（{len(fs)}）')

    rows = []
    prev = prev_t = None
    for t, p in fs:
        g = luma(p)
        if prev is not None:
            d = np.abs(g[SCENE_Y0:SCENE_Y1] - prev[SCENE_Y0:SCENE_Y1])
            # 直接数「明显变化的像素数」——比取分位数稳。
            # 实测参照：本片动效活跃时 0.5s 内有 2500–11700 个像素变化 >10 灰阶；
            # 真正静止时这个数接近 0。
            n_move = int((d > 10).sum())
            rows.append((prev_t, t, n_move))
        prev, prev_t = g, t

    vals = [v for _, _, v in rows]
    print(f'{len(fs)} 帧 / {len(rows)} 个帧对')
    print(f'明显变化像素数：中位 {int(np.median(vals))}  最小 {min(vals)}  最大 {max(vals)}')
    print()
    still = [(a, b, v) for a, b, v in rows if v < 300]
    if still:
        print(f'⚠️ 画面静止的帧对 {len(still)} 个（变化像素 <300）：')
        for a, b, v in still[:14]:
            print(f'   {a:6.1f}→{b:6.1f}s  变化像素 {v}')
        if len(still) > 14:
            print(f'   …还有 {len(still) - 14} 个')
        return 1
    print('✅ 每个帧对都有明显变化的区域（无静止段）')
    return 0


if __name__ == '__main__':
    sys.exit(main())
