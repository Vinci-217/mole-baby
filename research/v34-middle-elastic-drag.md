# 中级黏糯拉扯与回弹 · 未发布

> 本页为上一轮独立中级形变的历史研究，已按用户澄清由[v35：共用初级身体，只增加叶片](v35-shared-drag-body.md)替换。[上一轮固定版本GIF](https://raw.githubusercontent.com/Vinci-217/mole-baby/6f7582a5b462297f402c237d5740798122b0e217/artifacts/animation-gallery/middle-elastic.gif)保留用于对照。

用户希望中级也有初级那种柔软、被拉扯的感觉，同时继续避免额外的上下弹跳。上一轮中级主要切换原侧脸，形变仅约1.8%，换向时没有明显的挤压，松手时形变帧也没跟随弹簧回弹。

## 可查看预览

- [中级特写 GIF](../artifacts/animation-gallery/middle-elastic.gif)：实际组件放大1.44倍，抓取点固定，便于看清拉长、换向压缩和松手回弹。
- [初级 / 中级实际拖拽](../artifacts/animation-gallery/drag-young.gif)：正常100像素预览，包含随手部移动的位置变化。
- [五阶段实际拖拽](../artifacts/animation-gallery/drag.gif)
- [帧序列对照](../artifacts/v34-middle-elastic-sequence.png)
- [全部动画](../README.md)

## 具体变化

中级五种原朝向各有22档形变，合计110帧，取代上轮80帧的小幅循环。它们覆盖压缩、原形和拉长，按实际弹簧的有符号形变量采样：拖动越快，延展越明显；缓慢换向也会触发短暂压缩，再朝另一边展开。鼠标停止后逐渐回到原形；松手后允许形变量越过零点，产生衰减的回弹，不会因为转回正面就立刻切断。

身体使用横向网格重新采样，而不是直接缩放整张角色图。各行的横坐标变化不同，身体下半部稍稍拖后，叶冠有小幅跟随。原眼白定位出脸部保护区域，对眼白所在的脸部区域降低形变强度，保留原眼睛和小嘴素材。纵向坐标始终为 `y'=y`，中级拖动/松手期间继续关闭呼吸、旋转和纵向缩放。原生窗口的上下拖动不变。叶冠留出安全边距，导出时逐帧检查全部110帧不会裁掉叶片或身体。

初级的原始动作周期与图片保持原样。种子、高级、超拉的动作、已认可的足球、睡觉及摸摸素材未修改。

## 来源和适配范围

角色仍来自原页游 `lamubone.swf`，SHA-256为 `01abf65f3e8db098068a830268bd7a7cefefc1edc93a44565788783d23f8a0cf`，主Sprite1532。原五种正面/斜侧/侧面、小眼睛、小嘴和叶冠作为基础；横向网格、形变采样和弹簧交互是桌宠自行适配，不称为完整官方拖拽动作。导出方式与来源链接见[v33记录](v33-directional-drag.md)。

## 验证与体积

单元测试增加了中级缓慢拉扯、轻微换向压缩、停止/松手回弹、有形变时的正面姿态以及保持纵向注册的检查。真实代码录屏进一步检查同一侧脸下的实际身体宽度变化，避免只靠转身或整只平移通过验证；同时检查扩张/压缩都出现、上下边界稳定。具体数值见[middle-elastic-checks.json](../artifacts/animation-gallery/middle-elastic-checks.json)和[young-drag-checks.json](../artifacts/animation-gallery/young-drag-checks.json)。

浏览器检查覆盖四种颜色、两件原装扮、初级/中级、左右换向及松手回到待机。生产构建检查八种形态、实际鼠标左右拖动、松手后摸摸能立即响应，以及无损图片路径无缺失。232项Vitest与54项Node测试通过。

新增30个中级形变帧后，运行图片共710张，构建前85.64 MB，无损WebP后51.10 MB，比上一轮图片增加约0.44 MB。每张图继续核对全部透明度和可见RGB一致。预览GIF和逐帧图不打进安装目录；没有构建或发布Windows/macOS安装包。

```sh
python3 scripts/art/pack-drag-sequences.py --work /path/drag-export --contact artifacts/v34-middle-elastic-sequence.png
npm test
npm run build
node scripts/young-drag-regression.cjs
node scripts/compact-production-check.cjs
node scripts/record-horizontal-drag.cjs --middle
node scripts/record-horizontal-drag.cjs --young
node scripts/record-horizontal-drag.cjs
node scripts/render-animation-readme.cjs
```

本轮只提交 `preview/ramu-drag-study`，等待效果审阅；不修改版本号、main、标签、Release或自动更新渠道。
