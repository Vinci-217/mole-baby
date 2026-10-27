# 变身魔术预览

2026-10-27：把旧的帽子变花改为拉姆在原地变成小兔、小鸟或小树，停留后恢复。三种造型是图片模型新绘候选；GIF 两端使用原版中级红色拉姆，中间是新绘姿态，切换与停顿由程序编排，不是原著完整动作或逐帧手绘。当前只提供 GIF 供审阅，游戏里的帽子魔术和随机行为尚未替换。

后续接入计划：学会魔术课后，用户触发或桌面空闲时触发，选一个已解锁变身，尽量不连续重复；一次表演选定后保持不变，结束或中断恢复原来的形态和配色。睡觉、拖拽、游戏等忙碌状态下不自动触发。课程展示和日常魔术需共用同一套效果。

制作参考与完整提示词：[变身帧表](../skills/mole-classic-art/references/v40/transform-sheet.png)和[生成记录](../skills/mole-classic-art/references/v40/prompts.md)。

重现：`python scripts/art/preview-transform.py --sheet skills/mole-classic-art/references/v40/transform-sheet.png --out artifacts/transform-preview`。
