# 动作继续修订与空间精简 · 未发布

> 本页记录上一轮方案及当时的空间测量。固定侧向拖拽已由[本轮多朝向、多帧拖拽](v33-directional-drag.md)替换：初级保留弹性，仅中级限制额外纵向运动。

当前代码和GIF只在 `preview/ramu-drag-study`。未更改版本号、main、标签、Release或latest，正式版保持v0.29.1。

## 本轮动作

- 中级手动拖动：上轮只消除了抓取点的Y位移，原步行帧仍改变身体高度，旋转和呼吸层也会造成上下晃动。本轮拖拽使用固定侧向姿态，初级/中级的实际应用拖动和松手阶段只保留水平惯性；自动散步继续使用原步行帧。检查最终渲染的红色身体，上下边界的垂直变化均小于0.05px。新GIF使用实际 `useElasticDrag`，不只检查预览参数。
- 第五阶段摸摸：重新使用原素材 `happy` 开头的闭眼微笑，去掉后续大笑和翻转。神力超拉只用前四个原始帧；高级、水、木、火使用开头正面的微笑姿态，由小幅靠向手掌和触摸时钟驱动。身体中心和底部固定注册，手掌、原笑眼与爱心共同构成回应。原素材与选帧记录在 [affection/source.json](../public/assets/original/affection/source.json)。这是对原动作的轻柔片段编排，不称为完整官方摸摸动作。
- 睡觉：移除上一轮的大哈欠入口和附加的身体缩放，眼睑改为原闭眼轮廓35/1726，宽度从原眼部跨度的52%调整为88%，保留原眼线色。小嘴使用原形状743，保持轻微呼吸和原Z字上浮。种子花盆和身体端正，高级/神力形态保持悬空高度；边缘探头所需的位置偏移继续保留。它属于原素材的桌宠睡眠适配。
- 认可的足球素材、原始接触帧和播放时钟继续保留。

## README完整性

README默认全部展开，按 `RAM_ACTIONS` 自动核对44个动作名、32种用品与九件装扮。当前包含28组应用内GIF（含实际拖动），九件装扮分别展示八种形态；足球也展示八种形态。相同动作的兼容入口逐项列出，原帧研究与其余已有历史GIF单独标注。

[catalogue-coverage.json](../artifacts/animation-gallery/catalogue-coverage.json)记录清单，[checks.json](../artifacts/animation-gallery/checks.json)记录各组实际录制帧数、阶段和用品，[horizontal-checks.json](../artifacts/animation-gallery/horizontal-checks.json)记录真实水平拖动验证。生成README时，缺少动作、用品、装扮形态或GIF会直接失败。

## 运行空间

| 测量对象 | 精简前 | 精简后 | 减少 |
| --- | ---: | ---: | ---: |
| 706张运行图片 | 82.51 MB | 49.03 MB | 33.48 MB |
| 相同Electron 35.7.5的Linux安装目录 | 408.81 MB | 303.51 MB | 105.31 MB，约26% |
| 安装目录中的语言包 | 43.06 MB | 1.00 MB | 42.06 MB |

图片在构建阶段转换为无损WebP，对本轮新版资源逐张检查全部Alpha值和可见RGB像素一致。源PNG保留，角色、表情和服饰不靠降低帧率、删帧或模糊纹理来缩小。构建器同步改写代码、JSON图片字段和CSS中的路径，原生图标继续保留PNG/ICO/ICNS。

前端React、ReactDOM、图标库和scheduler已编入前端脚本，安装目录移除它们的重复完整副本；自动更新所需的Node依赖保留。构建工具sharp/Babel、测试、预览GIF和原始录屏帧均不打进安装目录。Electron语言资源只保留中文、英文；发布压缩设置为maximum。

数值为本机同版本Linux目录的实际字节对比，详见 [asset-size-report.json](../artifacts/asset-size-report.json)。Windows/macOS共用图片和打包优化，但本轮未构建、发布两平台安装包，不将Linux数字当作它们的最终大小。剩余空间主要由Electron运行时占用。

录屏中间PNG默认在GIF编码后删除；`npm run clean:previews`只清理未跟踪、纯数字文件名的预览帧目录，保留源素材、GIF和用户存档。本轮另清理了约347 MiB旧临时帧，这部分是开发工作区空间，不算作安装目录减小。

## 验证与复现

- 225项Vitest和54项Node测试通过；原动作选帧、摸摸注册、睡眠和更新器回归均保留。
- 32种形态/颜色组合的睡眠、摸摸、足球、减少动态效果和动作完成回调通过浏览器验证。
- 压缩后的生产构建检查八种形态、服饰、用品和商店，未发现丢图或页面异常。
- 实际精简后的独立Electron程序启动通过：前端库重复副本移除后界面正常，WebP睡眠及第五阶段摸摸正常，原生空标题保持有效。
- README生成验证每个清单条目、图片文件和录制参数；图集录制关闭热更新，避免代码变更打断录制。

```sh
npm test
npm run build
node scripts/compact-production-check.cjs
node scripts/record-horizontal-drag.cjs
node scripts/record-animation-gallery.cjs
node scripts/record-source-motion-preview.cjs
node scripts/render-animation-readme.cjs
```

使用 `KEEP_ANIMATION_FRAMES=1` 可保留录屏中间帧用于逐帧排查。所有操作保持本地/预览分支，不创建Release。
