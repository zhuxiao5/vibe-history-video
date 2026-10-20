#!/usr/bin/env python3
"""排版体检：检测文字行重叠与出界。

⚠️ 判据演进（两次都错在「怎么把文字从背景里分出来」）：

  v1 · 阈值 195（只认近白像素）
      → 干净，但**只认主字幕**。场景内的彩色标注
        （朱红 #e08a72、金 rgba(214,182,130,.9)、灰 #a99b7e，亮度 140–185）
        **全部漏掉**。用户截图指出的三处重叠，脚本一处都没报。

  v2 · 阈值 130
      → 把所有彩色标注抓到了，但**灰色地形等高线**（峰值 185）也一起涌入，
        报出 71 处假问题。

  v3 · 亮度 + 彩度（现用）
      → 文字 = 近白像素 **或** 高彩度像素；
        地形线/尘埃是灰的（R≈G≈B，彩度≈0），被自然排除。
        实测：文字彩度 30–120，地形线彩度 <12。

判据：
  1. 同 x 区域的文字带，若垂直间距 gap < 8px（含重叠）判为问题；
  2. 文字带超出安全边距（左右 60px、上下 40px）判为出界。

用法：python check-layout.py <帧.png> [更多帧...]
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image

SAFE_L, SAFE_R, SAFE_T, SAFE_B = 60, 60, 46, 40

GRAY_HI = 195      # 近白主字幕
GRAY_LO = 120      # 彩色标注的最低亮度
CHROMA_MIN = 22    # 彩度下限（max(R,G,B) - min(R,G,B)）


def text_mask(path):
    """返回「文字像素」的布尔掩码：近白 OR 高彩度。"""
    im = Image.open(path).convert('RGB')
    a = np.asarray(im, dtype=np.float64)
    gray = a.mean(axis=2)
    chroma = a.max(axis=2) - a.min(axis=2)
    return (gray > GRAY_HI) | ((gray > GRAY_LO) & (chroma > CHROMA_MIN))


def text_bands(mask):
    rowsum = mask.sum(axis=1)
    H, W = mask.shape
    bands = []
    i = 0
    while i < H:
        if rowsum[i] >= 6:
            j = i
            while j < H and rowsum[j] >= 6:
                j += 1
            if j - i >= 6:
                sub = mask[i:j]
                cols = np.where(sub.sum(axis=0) >= 2)[0]
                px = int(sub.sum())
                x0 = int(cols[0]) if len(cols) else -1
                x1 = int(cols[-1]) if len(cols) else -1
                span = (x1 - x0) if x0 >= 0 else 0
                density = px / max(1, (j - i) * max(1, span))
                # ① 地形线：横贯很宽且很细
                is_terrain = span > 0.72 * W and (j - i) < 26
                # ② 虚线/格网：亮列**极稀疏**（每行亮列数 / 带高 < 4）。
                #    实测：探方格网 0.4–3.9，而文字行通常 >8。
                #    这条是补漏：有些虚线不够宽（只占 5% 画幅），过不了 ① 的横贯判据。
                col_density = len(cols) / max(1, (j - i))
                is_dash = col_density < 4.0
                if density < 0.03 or is_terrain or is_dash:
                    i = j
                    continue
                bands.append({'y0': i, 'y1': j, 'h': j - i,
                              'x0': x0, 'x1': x1, 'px': px})
            i = j
        else:
            i += 1

    # 合并「被一行暗像素切开」的同一行字（汉字中部横画间隙）
    merged = []
    for b in bands:
        if merged and b['y0'] - merged[-1]['y1'] <= 4 \
                and abs(b['x0'] - merged[-1]['x0']) < 0.35 * max(1, merged[-1]['x1'] - merged[-1]['x0'] + 1):
            m0 = merged[-1]
            m0['y1'] = b['y1']; m0['h'] = m0['y1'] - m0['y0']; m0['px'] += b['px']
            m0['x0'] = min(m0['x0'], b['x0']); m0['x1'] = max(m0['x1'], b['x1'])
        else:
            merged.append(dict(b))
    return merged


def main():
    frames = [Path(p) for p in sys.argv[1:]]
    if not frames:
        sys.exit('用法: python check_layout.py <帧.png> ...')
    total = 0
    for f in frames:
        mask = text_mask(f)
        H, W = mask.shape
        bands = text_bands(mask)
        bad = []
        notes = []
        for b in bands:
            if b['x0'] >= 0 and (b['x0'] < SAFE_L or b['x1'] > W - SAFE_R):
                bad.append(f"出界 x: [{b['x0']},{b['x1']}] y={b['y0']}-{b['y1']}")
            if b['y0'] < SAFE_T or b['y1'] > H - SAFE_B:
                bad.append(f"出界 y: {b['y0']}-{b['y1']}")
        for i in range(len(bands)):
            for j in range(i + 1, len(bands)):
                a, b = bands[i], bands[j]
                if a['x0'] < 0 or b['x0'] < 0:
                    continue
                ox = min(a['x1'], b['x1']) - max(a['x0'], b['x0'])
                if ox <= 0:
                    # 水平不交叠：不该判叠字。但若**垂直方向贴得太近**
                    # （间距 < 12px）且水平间隙也小（< 40px），视觉上仍会糊成一块
                    # —— 这是压缩片长后画面元素没跟着挪时最容易出的问题。
                    ogap = -ox
                    vgap = max(a['y0'], b['y0']) - min(a['y1'], b['y1'])
                    if ogap < 40 and vgap < 12:
                        notes.append(
                            f"元素过近: y{a['y0']}-{a['y1']} 与 y{b['y0']}-{b['y1']} "
                            f"(水平隙 {ogap}px / 垂直隙 {vgap}px)")
                    continue
                gap = b['y0'] - a['y1']
                if gap < 0:
                    bad.append(f"垂直重叠 {(-gap)}px: y{a['y0']}-{a['y1']} 与 y{b['y0']}-{b['y1']} (x 交叠 {ox}px)")
                elif gap < 8:
                    bad.append(f"行距过窄 {gap}px: y{a['y0']}-{a['y1']} 与 y{b['y0']}-{b['y1']}")
        status = 'OK' if not bad else f'{len(bad)} 处问题'
        print(f'{f.name}  文字带 {len(bands)} 条  → {status}')
        for x in bad:
            print(f'    ⚠️ {x}')
        for x in notes:
            print(f'    💡 {x}')
        total += len(bad)
    print()
    print(f'合计问题 {total} 处')
    return 1 if total else 0


if __name__ == '__main__':
    sys.exit(main())
