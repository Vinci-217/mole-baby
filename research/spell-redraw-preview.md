# 魔术与法术 GIF 候选

2026-10-27 的审阅预览；尚未接入游戏。查看 [魔术](../artifacts/spell-preview/magic.gif)、[旋风术](../artifacts/spell-preview/wind.gif)、[流火术](../artifacts/spell-preview/fire.gif)、[寒冰术](../artifacts/spell-preview/ice.gif)、[陨石术](../artifacts/spell-preview/meteor.gif)。

每个四系动画使用图片模型绘制的 4 张不同关键姿态，魔术使用 8 张；其间的淡化和停顿由预览脚本编排，不是手绘中间帧。原拉姆使用项目原图且在本次预览中静止，供核对同屏尺寸和遮挡，不代表最终施法动作。

[勇士截图参考和审查规则](../skills/mole-classic-art/references/spell-animation-guide.md)及[完整提示词](../skills/mole-classic-art/references/v39/prompts.md)。尚未找到可核对的《摩尔勇士》四系完整技能帧；这些是参考同系列画风的新绘候选，不是官方动作。直接参考勇士截图的另一张候选带大面积彩色底，透明修订仍未去除，因此没有放入 GIF。当前 GIF 使用无大面积背景的第一组新绘。

重现：`python scripts/art/preview-spells.py --elements skills/mole-classic-art/references/v39/elements-sheet-initial.png --magic skills/mole-classic-art/references/v39/magic-sheet.png --out artifacts/spell-preview`。
