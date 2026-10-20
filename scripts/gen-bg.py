#!/usr/bin/env python3
"""调用本地 gpt-image-2.5 生成背景图。

⚠️ 实测要点（2026-10-15 摸清）：
  1. 端点必须是 **/v1/images/generations**
     —— 用 /v1/chat/completions 会返回 `model xxx is only supported on ...`
  2. **size 参数被忽略**（传 1536x1024/1792x1024/1024x1024 都返回 1254x1254）
     → 必须在 **prompt 里明确写「16:9 横版」**，才会返回 **1672×941**
  3. 返回体：`data[0].b64_json`（base64 PNG）+ `data[0].generation_id`
  4. 单张耗时 **22–28 秒**
  5. 负向约束写在 prompt 里**有效**，但"不要出现 X"这种否定句
     有时会被误读成"要出现 X" → 优先用**正向描述**
     （「地平线上没有任何建筑」比「不要有城楼」更稳）

用法：
  python tools/gen-bg.py --prompts tools/prompts-c2b.json --keys fig01 fig05
  python tools/gen-bg.py --prompts tools/prompts-c2b.json          # 全部
"""
import argparse
import base64
import json
import pathlib
import subprocess
import sys
import time

# ⚠️ 不要把 key 写进代码。按优先级读取：
#   1) 命令行 --api / --key
#   2) 环境变量 IMG_API / IMG_KEY
#   3) 项目内 local-endpoint.json（{ "api": "...", "key": "..." }，应加入 .gitignore）
DEFAULT_API = 'http://127.0.0.1:8317/v1/images/generations'
MODEL = 'gpt-image-2.5'


def resolve_endpoint(root, cli_api=None, cli_key=None):
    import os
    api = cli_api or os.environ.get('IMG_API')
    key = cli_key or os.environ.get('IMG_KEY')
    cfg = root / 'local-endpoint.json'
    if (not api or not key) and cfg.exists():
        d = json.loads(cfg.read_text(encoding='utf-8'))
        api = api or d.get('api')
        key = key or d.get('key')
    return api or DEFAULT_API, key


def gen(prompt, api, key, timeout=300):
    payload = json.dumps({'model': MODEL, 'prompt': prompt, 'n': 1},
                         ensure_ascii=False)
    r = subprocess.run(
        ['curl', '-s', '-m', str(timeout), api,
         '-H', f'Authorization: Bearer {key}',
         '-H', 'Content-Type: application/json',
         '-d', payload],
        capture_output=True, text=True)
    if not r.stdout.strip():
        return None, f'空响应（curl rc={r.returncode}）'
    try:
        d = json.loads(r.stdout)
    except Exception as e:
        return None, f'非 JSON：{r.stdout[:150]}'
    if 'data' not in d:
        return None, str(d)[:200]
    return base64.b64decode(d['data'][0]['b64_json']), None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--prompts', required=True)
    ap.add_argument('--outdir', default='assets/bg/gen')
    ap.add_argument('--keys', nargs='*')
    ap.add_argument('--overwrite', action='store_true')
    ap.add_argument('--api', help='图片接口 URL（默认读环境变量或 local-endpoint.json）')
    ap.add_argument('--key', help='API key（同上）')
    a = ap.parse_args()

    root = pathlib.Path.cwd()
    api, key = resolve_endpoint(root, a.api, a.key)
    if not key:
        print('✖ 缺少 API key。三种给法：')
        print('   ① --key sk-xxx')
        print('   ② export IMG_KEY=sk-xxx')
        print('   ③ 在项目根建 local-endpoint.json: {"api":"...","key":"..."}')
        return 2
    print(f'端点 {api}')
    pfile = pathlib.Path(a.prompts)
    if not pfile.is_absolute():
        pfile = root / a.prompts
    specs = json.loads(pfile.read_text(encoding='utf-8'))
    outdir = pathlib.Path(a.outdir)
    if not outdir.is_absolute():
        outdir = root / a.outdir
    outdir.mkdir(parents=True, exist_ok=True)

    keys = a.keys or list(specs.keys())
    report = []
    for k in keys:
        if k not in specs:
            print(f'✖ 未知键 {k}')
            continue
        spec = specs[k]
        dst = outdir / f'{k}-{spec["name"]}.png'
        if dst.exists() and not a.overwrite:
            print(f'⏭  {k} 已存在，跳过（加 --overwrite 重生成）')
            report.append({'key': k, 'status': 'skipped', 'file': str(dst)})
            continue

        print(f'▶ {k} ｜ {spec["scene"]} ｜ {spec["func"]} ｜ {spec["name"]}')
        t0 = time.time()
        raw, err = gen(spec['prompt'], api, key)
        dt = time.time() - t0
        if err:
            print(f'   ✖ 失败（{dt:.1f}s）：{err}')
            report.append({'key': k, 'status': 'fail', 'error': err})
            continue

        dst.write_bytes(raw)
        # 量尺寸
        try:
            from PIL import Image
            w, h = Image.open(dst).size
            ratio = w / h
            wide = abs(ratio - 16 / 9) < 0.06
            print(f'   ✅ {dt:.1f}s  {len(raw):,} bytes  {w}×{h}'
                  f'  {"16:9 ✅" if wide else "⚠️ 非 16:9"}')
        except Exception:
            print(f'   ✅ {dt:.1f}s  {len(raw):,} bytes')
        report.append({'key': k, 'status': 'ok', 'file': str(dst),
                       'seconds': round(dt, 1), 'bytes': len(raw)})

    rp = outdir / 'gen-report.json'
    rp.write_text(json.dumps(report, ensure_ascii=False, indent=2),
                  encoding='utf-8')
    ok = sum(1 for r in report if r['status'] == 'ok')
    print(f'\n完成 {ok}/{len(keys)} ｜ 报告 → {rp}')
    return 0 if ok == len(keys) else 1


if __name__ == '__main__':
    sys.exit(main())
