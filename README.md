# history-video-skill

> 把一段历史考据做成**可复现、可量化验收**的科普视频。
> 不是剪辑模板，是**用代码画视频 + 用脚本验片**的工作流。

一个 Agent Skill（Claude Skills / WorkBuddy / Codex 通用格式），用于制作**中国历史与历史地理题材**的横屏科普视频：暗色图解风格、宋体叙事、地图与剖面推演、器物特写。

---

## 它解决什么问题

手工做科普视频，最难的不是画，是**这三件事**：

1. **时长不可控** —— 写完文案才发现 3 分钟，或者只有 90 秒撑不满
2. **画面"看起来不对"但说不出哪不对** —— 叠字、元素堆在一起、某段完全静止
3. **改一次要重做一遍** —— 剪辑软件里没有参数，只有手感

这套东西的答案是：**全部变成数字和脚本。**

| 问题 | 解法 |
|---|---|
| 时长不可控 | `片长 ≈ 字数 ÷ 5.0 + 换句数 × 0.34 + 场数 × 0.56` |
| 说不清哪不对 | 四道量化检查，逐帧给数 |
| 改一次重做 | 画面是 `scene.js`，改参数即可重渲 |

---

## ⚠️ 它不是什么

**不是「输入标题 → 输出成片」的工具。**

你需要：

- 自己查史料、写文案
- 自己写 `scene.js`（Canvas 2D 绘图代码）
- 自己判断画面好不好看——**这个脚本测不出来**

它给你的是一套**工程规范和验收工具**，不是生成器。

---

## 依赖

| 依赖 | 版本 | 用途 |
|---|---|---|
| Node.js | ≥ 22 | 渲染 |
| Python | ≥ 3.9 | 检查脚本、背景图处理 |
| ffmpeg | 任意近版 | 音视频合成 |
| playwright | 1.63.0 | 无头浏览器渲染（`npm i` 自动装） |

**可选**：`frame-sync-sfx`（另一个独立技能）负责音效合成与 BGM 混音。静音项目不需要装。

---

## 快速开始

```sh
npm install

# 生成一个可运行的示例工程
node scripts/create-project.mjs --template starter --out ../my-film
node scripts/create-project.mjs --template focus   --out ../my-focus-demo
node scripts/create-project.mjs --template motion  --out ../my-motion-demo

# 渲染
node scripts/render.mjs --root ../my-film --out ../my-film/film.mp4 --fps 30
```

浏览器预览：直接用静态服务器打开工程里的 `index.html`。

---

## 目录结构

```
SKILL.md                    主流程（Agent 读这个）
references/
  story-and-evidence.md     选题判据、钩子、叙事结构
  style.md                  暗色图解风格规则
  motion-and-focus.md       文字动作与焦点
  motion-profiles.md        行内浮动/信号重音的配置
  background-images.md      写实背景图：分镜设计 → 生成 → 逐张标定
  texture-layers.md         纹理层（按对象归属）
  timing-and-audio.md       节奏、字速、音轨
  production.md             工程、四道检查、踩坑史
  upstream.md               与上游项目的关系
scripts/
  render.mjs                无头渲染（改编自上游 MIT 项目）
  create-project.mjs        从模板生成工程
  check-layout.py           像素法排版检查（叠字/出界）
  check-overlap-live.py     运行时文字重叠检查
  check-motion.py           画面是否一直在动
  check-timing.py           动画时刻是否越界
  check-contract.py         分镜合同字段校验
  gen-bg.py                 调图片模型生成背景图
  calibrate-bg.py           逐张标定背景图亮度
  remap-timing.py           时间轴重映射
assets/
  starter/                  Canvas 组件三件套 + 可运行样片
  focus-demo/               24 秒焦点/换句示例
  motion-demo/              24 秒字波/重点/信号示例
  contracts/                shots.json 合同模板
```

---

## 三条最值得抄的设计

### ① 四道量化检查，不用目视代替

```sh
python scripts/check-layout.py <抽帧.png> ...          # 排版叠字
python scripts/check-motion.py <帧前缀>                # 是否一直有变化
python scripts/check-timing.py --root <工程目录>       # 时刻越界
python scripts/check-overlap-live.py --root <工程目录> # 文字重叠（运行时）
```

`check-overlap-live.py` 的做法值得一提：给 `text()` 挂一个记录钩子，**逐帧真的调一次 `render()`**，把实际画出的每个文字坐标读回来做包围盒比对。

**为什么需要它**：像素法（`check-layout.py`）靠亮度阈值找文字，**灰色/暗色元素根本过不了阈值**，于是完全测不出来。实测中像素脚本报 0 问题，而运行时检查抓到 6 处真重叠。

### ② 字速基准：让时长可算

| 类型 | 字速 |
|---|---|
| 白话句 | **5.0 字/秒** |
| 文言引文 | **4.4 字/秒** |
| 单句下限 | **2.2 秒** |

```
片长 ≈ 字数 ÷ 5.0 + 换句处数 × 0.34 + 场数 × 0.56
```

实测校验：499 字 → 预测 110 秒，实际 120.0 秒（差额来自引文降速与短句下限）。

### ③ 背景图四功能框架

一个 120 秒的视频用 **10 张**背景图，**四种功能必须配齐**：

| 功能 | 作用 | 张数 |
|---|---|---|
| 建立 | 交代时空 | 2 |
| 聚焦 | 物件/人物特写 | 4 |
| 对比 | 前后/左右对照 | 2 |
| 转折/收尾 | 情绪落点 | 2 |

**10 张都是"氛围图"就变成幻灯片**——这是最容易犯的错。

而且**亮度必须逐张标定**：实测 10 张图的系数跨度 **0.41–0.80**，一刀切必然有一半不合格。

---

## 适用范围与限制

**适用**：中文历史、历史地理、制度/器物/工艺类科普，横屏 1.5–3 分钟。

**不适用**：
- 需要真人出镜、实拍素材的项目
- 竖屏短视频（未做适配）
- 非中文题材（选题判据与钩子规律基于中文短视频语料）

**已知依赖判断**：`references/` 里的量化基准来自一批中文历史科普样片的实测统计。这些样片**没有随本包分发**，你只能拿到汇总结论，拿不到逐片数据。

---

## 许可

代码与文档均为 MIT，见 [LICENSE](LICENSE)。

`scripts/render.mjs` 改编自 [Hype-yolo/claude-motion-skill](https://github.com/Hype-yolo/claude-motion-skill)（MIT），原文许可保留在 `licenses/`，署名见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。

**注意**：外部案例、字体、模型、音乐各有自己的许可证，不会因为本项目是 MIT 就变成 MIT。本包**不包含**任何图片、音频、视频或字体文件——背景图与 BGM 需自备。

---

## 致谢

渲染核心来自 Hype-yolo 的 claude-motion-skill。方法论的量化部分（字速、四道检查、背景图框架）来自实际制片的复盘记录，每个坑都有对应的失败样本。
