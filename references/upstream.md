# 与 Claude Motion 的关系

研究来源：<https://github.com/Hype-yolo/claude-motion-skill>，固定提交 `607fe9801529bb493b1968cd967a3e8a959d42c1`，入口自报 `v0.4.0-beta.1`；展示页 <https://hypeyolo.com/motion/>，读取于 2026-10-13。展示页是筛选案例，不能据此保证全题材效果或声称模型对等。

本包实际复用了上游的 MIT `scripts/render.mjs`，并保留许可证/署名；使用同一个 `scene.js` 确定性接口。新增暗色图解风格指南与原创 Canvas 绘图示例。没有打包上游的任何案例、模型资产或第三方视频；也没有这些视频的原始工程，无法提取其原代码。

上游可选安装后，复杂主体可用：

```sh
node <claude-motion>/scripts/route.mjs --query "<主体 动作 空间 材质需求>" --limit 5
node <claude-motion>/scripts/prepare-case.mjs --case <真实返回ID> --out <新的目录>
```

先运行查询并阅读返回源码/预览，别编造 case ID。选择能补充本题造型或动作的一个主实现，再统一到本片视觉规则。也可按上游当前说明使用 scene/extension 生成器。外部案例/字体/模型各有许可证，不能因为导出器 MIT 就把所有素材当 MIT。

只需本包暗色图解示例时不必安装整个上游。需要 HyperFrames 或 Remotion 时，保留当前项目原生预览/导出器，只移植画面和绝对时间求值；不要同时启动多个框架争夺同一个时间轴。用户指定既有制作流程时，该流程优先。
