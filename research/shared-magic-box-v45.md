# 蓝紫纹样魔术盒：各阶段共用的往返预览

盒子改为蓝紫色，增加银色边框、卷角纹与盒盖、侧面的星形纹样。只保留拉姆特色的白色椭圆眼睛，不带叶子或红色身体。

完整过程：**原拉姆 → 冒烟遮盖 → 魔术盒 → 再次冒烟遮盖 → 原拉姆**。

## 先看效果

<img src="../artifacts/magic-box-shared-v45/preview.gif" width="288" alt="拉姆变蓝紫纹样魔术盒，再变回原形">

[完整往返动图](../artifacts/magic-box-shared-v45/preview.gif) · [100px 深色背景动图](../artifacts/magic-box-shared-v45/preview-100px.gif) · [逐帧预览页面](../artifacts/magic-box-shared-v45/preview.html)

预览页面需通过本地静态服务器打开，可选八种形态、暂停、逐帧或半速播放；GitHub 文件页面不执行 HTML。

<img src="../artifacts/magic-box-shared-v45/box-poses.png" width="512" alt="蓝紫魔术盒的纹样与眨眼">

## 完整往返的关键时点

下图选取了 39 个编排时间片中的 16 个时点，图上数字是实际时间片编号，并非 16 张独立新绘的变身姿态。

<img src="../artifacts/magic-box-shared-v45/sequence.png" width="800" alt="拉姆、烟雾、魔术盒、烟雾、拉姆的往返序列">

## 不同形态直接复用

各阶段继续使用原有角色图，不为每个形态重新画变身序列。相同的烟雾负责遮盖，遮住后切换到同一个魔术盒；变回时再次播放这套烟雾，再换回当前阶段的原图。盒子尺寸不随阶段变化，纹样与眼睛也保持一致。

<img src="../artifacts/magic-box-shared-v45/forms-overview.png" width="800" alt="八种形态的原形、遮挡、共用盒子、恢复原形对照">

| 形态 | 完整往返预览 |
| --- | --- |
| 种子原素材 | [播放](../artifacts/magic-box-shared-v45/forms/seed.gif) |
| 初级 | [播放](../artifacts/magic-box-shared-v45/forms/junior.gif) |
| 中级 | [播放](../artifacts/magic-box-shared-v45/forms/middle.gif) |
| 高级 | [播放](../artifacts/magic-box-shared-v45/forms/senior.gif) |
| 神力超拉 | [播放](../artifacts/magic-box-shared-v45/forms/super.gif) |
| 水 | [播放](../artifacts/magic-box-shared-v45/forms/water.gif) |
| 木 | [播放](../artifacts/magic-box-shared-v45/forms/wood.gif) |
| 火 | [播放](../artifacts/magic-box-shared-v45/forms/fire.gif) |

遮挡验证覆盖七种形态的红、黄、蓝、粉四种原图，加种子原图，共 29 个角色样本，以及盒子。切换帧中，各样本的不透明轮廓均被烟雾完全覆盖。这里验证的是本预览的静态原图与固定显示范围；装扮、拖拽和游戏实际窗口还没有接入或验证。

## 共用素材与来源

- 新绘素材只有一张 2 × 2 的盒子表情表（4 格）与一张 4 × 4 的烟雾表（16 格）；不是给每个阶段画 39 张动作。
- 39 个时间片共 4.28 秒。同一套烟雾正向播放两次；没有倒放、插值或程序重画。重复使用与停留都记录在时间表中，GIF 编码可能合并相同画面。
- 288 × 288 共用透明画布。盒子、烟雾、角色预览图各自独立；切换发生在烟雾第 8 帧。源图仅切帧、缩放、配准、合成；烟雾越过原格边界的团块按连通域归属提取，避免截断。
- 原角色来自项目现有原页游素材；新盒子与烟雾是图片模型绘制的候选，不是官方动作。本轮保留原种子素材的中性颜色，没有重新制作种子四色。
- [烟雾帧表预览](../artifacts/magic-box-shared-v45/smoke-sequence.png)、[共用盒子 PNG](../artifacts/magic-box-shared-v45/shared/box/)、[共用烟雾 PNG](../artifacts/magic-box-shared-v45/shared/smoke/)、[时序、原素材哈希与覆盖验证](../artifacts/magic-box-shared-v45/manifest.json)。
- [生成提示词与参考](../skills/mole-classic-art/references/v45/generation.json)、[盒子原表](../skills/mole-classic-art/references/v45/box-sheet.png)、[烟雾原表](../skills/mole-classic-art/references/v45/smoke-sheet.png)、[导出脚本](../scripts/art/preview-shared-magic-box.py)。

这是素材预览分支中的候选，尚未接入游戏或发版。重新导出需要 Pillow、NumPy 和 SciPy：

```sh
python scripts/art/preview-shared-magic-box.py --box-sheet skills/mole-classic-art/references/v45/box-sheet.png --smoke-sheet skills/mole-classic-art/references/v45/smoke-sheet.png --out artifacts/magic-box-shared-v45
```
