#!/usr/bin/env python3
"""运行时文字重叠检查：逐帧真的调一次 render()，收集该帧实际画出的所有文字，
按包围盒两两比对。

为什么不用静态解析：
  scene.js 里大量坐标是函数内变量（ix/iy/sx+sw/2…），静态解析抓不全。
  实测：静态法只抓到 6 个元素，而运行时能抓到每帧全部。

做法：
  用 render.mjs 的同一套浏览器（Playwright），在页面里设 t，调 render()，
  然后读 TEXT_LOG（history-kit 在 text()/mid() 里记的实参）。

用法：
  python check-overlap-live.py --root <工程目录> [--step 0.5]
"""
import argparse
import json
import pathlib
import subprocess
import sys

JS = r"""
async (times) => {
  const scene = window.__scene;
  const canvas = document.querySelector('#preview') || document.createElement('canvas');
  canvas.width = scene.width; canvas.height = scene.height;
  const ctx = canvas.getContext('2d');
  const out = {};
  for (const t of times) {
    scene.TEXT_LOG.length = 0;
    try { await scene.render(ctx, t); } catch (e) { out[t] = {error: String(e)}; continue; }
    out[t] = scene.TEXT_LOG.map(b => ({s: b.s, x: b.x, y: b.y, size: b.size, align: b.align}));
  }
  return out;
}
"""


def text_w(s, size, align):
    w = sum(size if ord(c) > 0x2E80 else size * 0.52 for c in s)
    if align == 'center':
        return -w / 2, w / 2
    if align == 'right':
        return -w, 0
    return 0, w


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--root', default='.')
    ap.add_argument('--step', type=float, default=0.5)
    ap.add_argument('--gap-warn', type=float, default=10.0)
    a = ap.parse_args()
    root = pathlib.Path(a.root).resolve()

    shots = json.loads((root / 'shots.json').read_text(encoding='utf-8'))
    total = shots['duration']
    times = [round(x * a.step, 2) for x in range(1, int(total / a.step) + 1)]

    # 借 render.mjs 的浏览器启动方式：写一个临时驱动
    driver = root / '.check-overlap-driver.mjs'
    driver.write_text(f"""
import pw from '{pathlib.Path.home()}/.workbuddy/binaries/node/workspace/node_modules/playwright/index.js';
const {{ chromium }} = pw;
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const ROOT = {json.dumps(str(root))};
const MIME = {{'.html':'text/html','.js':'text/javascript','.json':'application/json','.png':'image/png','.jpg':'image/jpeg'}};
const server = http.createServer((req,res)=>{{
  let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html';
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f)) {{ res.writeHead(404); return res.end(); }}
  res.writeHead(200, {{'Content-Type': MIME[path.extname(f)] || 'application/octet-stream'}});
  fs.createReadStream(f).pipe(res);
}});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const port = server.address().port;
const browser = await chromium.launch();
const page = await browser.newPage({{ viewport: {{ width: 1920, height: 1080 }} }});
await page.goto(`http://127.0.0.1:${{port}}/index.html`);
await page.waitForFunction(() => window.__sceneReady === true, null, {{ timeout: 30000 }});
const times = {json.dumps(times)};
const data = await page.evaluate(async (ts) => {{
  const scene = window.__scene;
  const canvas = document.querySelector('#preview');
  canvas.width = scene.width; canvas.height = scene.height;
  const ctx = canvas.getContext('2d');
  const out = {{}};
  for (const t of ts) {{
    if (!scene.TEXT_LOG) {{ out[t] = {{error: 'TEXT_LOG 未导出'}}; continue; }}
    scene.TEXT_LOG.length = 0;
    try {{ await scene.render(ctx, t); }} catch (e) {{ out[t] = {{error: String(e)}}; continue; }}
    out[t] = scene.TEXT_LOG.map(b => ({{s:b.s, x:b.x, y:b.y, size:b.size, align:b.align}}));
  }}
  return out;
}}, times);
console.log('RESULT_JSON::' + JSON.stringify(data));
await browser.close(); server.close();
""", encoding='utf-8')

    # index.html 需要暴露 window.__scene / __sceneReady —— 检查是否存在
    idx = (root / 'index.html').read_text(encoding='utf-8')
    if '__sceneReady' not in idx:
        print('⚠️ index.html 未暴露 window.__sceneReady，先打补丁')
        idx = idx.replace("scene = await import('./scene.js');",
                          "scene = await import('./scene.js');\n        window.__scene = scene; window.__sceneReady = true;")
        (root / 'index.html').write_text(idx, encoding='utf-8')

    r = subprocess.run(['node', str(driver)], capture_output=True, text=True, cwd=str(root))
    driver.unlink(missing_ok=True)
    if r.returncode != 0 or not r.stdout.strip():
        print('✖ 驱动失败：')
        print('--- stdout ---'); print((r.stdout or '')[-1200:])
        print('--- stderr ---'); print((r.stderr or '')[-1200:])
        return 2
    try:
        line = [l for l in r.stdout.splitlines() if l.startswith('RESULT_JSON::')][-1]
        data = json.loads(line[len('RESULT_JSON::'):])
    except Exception as e:
        print('✖ 输出不是 JSON：', e)
        print((r.stdout or '')[-800:]); print((r.stderr or '')[-800:])
        return 2

    bad, warn, n = [], [], 0
    for t, items in data.items():
        if isinstance(items, dict) and 'error' in items:
            print(f'⚠️ t={t}s 渲染报错：{items["error"][:80]}')
            continue
        boxes = []
        for it in items:
            if not it['s'] or it['s'].strip() == '':
                continue
            x0, x1 = text_w(it['s'], it['size'], it['align'])
            boxes.append({'s': it['s'], 'x0': it['x'] + x0, 'x1': it['x'] + x1,
                          'y0': it['y'] - it['size'] * 0.82,
                          'y1': it['y'] + it['size'] * 0.18})
        n += len(boxes)
        for i in range(len(boxes)):
            for j in range(i + 1, len(boxes)):
                A, B = boxes[i], boxes[j]
                ox = min(A['x1'], B['x1']) - max(A['x0'], B['x0'])
                oy = min(A['y1'], B['y1']) - max(A['y0'], B['y0'])
                if ox > 0 and oy > a.gap_warn:
                    bad.append((t, A['s'][:16], B['s'][:16], ox, oy))
                elif ox > 0 and oy > 0:
                    warn.append((t, A['s'][:16], B['s'][:16], ox, oy))

    print(f'检查 {len(times)} 帧，共 {n} 个文字元素')
    print()
    if bad:
        print(f'⚠️ 明显重叠 {len(bad)} 处（按时刻）：')
        for rec in sorted(bad, key=lambda r: float(r[0]))[:40]:
            t_, s1, s2, ox, oy = rec
            print(f'   t={float(t_):6.1f}s  「{s1}」×「{s2}」  {ox:.0f}×{oy:.0f}px')
    else:
        print('✅ 无明显重叠')
    if warn:
        print()
        print(f'💡 轻微交叠 {len(warn)} 处（同帧内，可能只是背景元素）：')
        seen = set()
        for rec in sorted(warn, key=lambda r: float(r[0])):
            t_, s1, s2, ox, oy = rec
            k = (s1, s2)
            if k in seen:
                continue
            seen.add(k)
            print(f'   t={float(t_):6.1f}s  「{s1}」×「{s2}」  {ox:.0f}×{oy:.0f}px')
            if len(seen) >= 15:
                break
    return 1 if bad else 0


if __name__ == '__main__':
    sys.exit(main())
