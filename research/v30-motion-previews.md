# 原帧交互动作预览（待确认，不发版）

> 本页为历史研究。当前方案见[v38：中央叶柄、课程与小屋](v38-school-room.md)。本页描述的是当时实现，不能作为当前效果说明。

本页保留v30的四个历史研究GIF，方便与最新方案对照；当前拖拽和摸摸效果以本页开头链接的新修订为准。没有修改版本号，没有创建标签或Release，没有把预览接入客户端自动更新。正式版仍为v0.29.1。睡眠与界面修复见 [本轮修订记录](v31-animation-review.md)。

## 动作来源与适配

普通拉姆使用原页游 [lamubone.swf 社区存档](https://raw.githubusercontent.com/Miigon/RecMoleRes/master/root/resource/NPC/lamubone.swf)，原文件SHA-256为 `01abf65f3e8db098068a830268bd7a7cefefc1edc93a44565788783d23f8a0cf`。神力超拉源为 `http://mole.61.com/resource/petcloth/swf2/pet101/skill_7.swf`；既有来源与核对记录见 [SOURCE-RECORD.md](../public/assets/classic/SOURCE-RECORD.md)。种子的原身体、花盆和配色蒙版沿用现有原素材。

| 形态 | 主Sprite | 左右与正面原帧数（每方向） | 开心原帧数 |
| --- | --- | --- | --- |
| 初级 | 936 | 15 | 95 |
| 中级 | 1532 | 16 | 11 |
| 高级 | 1777 | 11 | 32 |
| 神力超拉 | 940 | 21 | 86 |

- 移动和拖拽：使用完整 `down / left / right` 时间轴、原侧脸、原眼睛和叶片。拖拽增加悬挂位置、短暂惯性和松手衔接；没有整张图的非等比拉伸。鼠标圆点只是预览的抓取位置指示。
- 追蝶：使用中级原 `boring` 的217帧追看、拍飞虫动作（子Sprite1507）。叶片组1506完整保留，只隐藏其中飞虫子Sprite1481；原身体和叶片在左右两栏相同。右栏另加蝴蝶和网，调整小画框内的飞行路线并补齐离场、回场，让蝴蝶绕开网后飞走；它不是原游戏的同名“抓蝴蝶”动作。
- 摸摸：初、中、高级使用原 `happy` 时间轴；神力超拉使用正常 `down` 悬浮周期，不再播放大笑和大幅翻转。手掌靠近、接触和离开，按实际角色轮廓选择接触点。表情来自原帧，没有手工重新画脸。种子身体摆动为适配，花盆端正。
- 原资源中没有核实到名为“拖拽”“摸摸”“抓蝴蝶”的完整官方标签，这三类交互都明确标为桌宠适配。
- 手掌、捕蝶网和四帧蝴蝶是本轮用图片模型生成的独立配套道具，不是官方素材，不参与角色脸部绘制。原始生成图保留于 `artifacts/v30-source/interaction-props-sheet.png`。
- 身体、道具与接触由同一预览时钟驱动，各自采样原角色帧或道具帧。原帧按24fps、原顺序播放；Flash清空/重置帧按一个原始帧的时长保留上一姿态，避免瞬间消失。完整翻身使用整体等比镜头跟随，避免裁掉身体或叶片；不改变身体各部分比例。

原著人物动作与新道具效果需分别审阅。本轮只展示无装扮红色角色的动作方案；其它颜色及装扮接入后仍需单独检查，不能把这些GIF当作已完成正式版全形态适配。

## 可查看文件

- [初级/中级移动与拖拽对照](../artifacts/v30-preview/move.gif)
- [五阶段拖拽](../artifacts/v30-preview/drag.gif)
- [追蝶对照](../artifacts/v30-preview/butterfly.gif)
- [五阶段摸摸](../artifacts/v30-preview/pet.gif)

## 验证与复现

`scripts/art/prepare-original-actions.py`新增按形态导出的参数和预览素材分离选项，默认足球导出行为保留。`scripts/art/pack-interaction-preview.py`将原帧、身体配色蒙版、原飞虫参考和新道具打包到预览目录；全部PNG哈希记于 `manifest.json`。

`scripts/source-motion-preview.mjs`为独立预览渲染器，没有被正式应用导入。运行 `node scripts/record-source-motion-preview.cjs`，从浏览器实际渲染帧生成GIF和WebM：移动154帧、拖拽154帧、追蝶245帧、摸摸135帧，均为24fps。

检查覆盖原帧索引和时序、完整身体不超出图格、追蝶时原叶片没有丢层、实际侧向帧/手掌接触/蝴蝶轨迹、初中级水平拖拽不跳动、超拉摸摸不调用大笑，以及浏览器零渲染异常。结果见 [recording-checks.json](../artifacts/v30-preview/recording-checks.json)。足球原素材、播放模块未改动；后续睡眠和界面源码修复仍只在预览分支，未发版。
