# 经典拉姆画风：变身预览 v41

2026-10-27：重新对照[经典拉姆素材资料库](references/ramu-2008-2010/README.md)、[四色与形态参考板](../skills/mole-classic-art/references/v41/original-form-colours.png)和[原足球动作参考板](../skills/mole-classic-art/references/v41/football-middle-original-poses.png)，针对兔、鸟、树重新绘制 16 格关键姿态。原本的红色身体保留无黑色外描边；眼睛的黑色瞳孔和叶片的深绿色边界不删除。小鸟闭眼的候选另经图片模型修改为睁眼。

GIF 为概念预览：每组使用 16 格模型新绘姿态，首尾使用原中级红色拉姆静态图，帧间定时切换。它们并非官方变身动作，也没有逐个手工绘制补间；角色眼位、帧间尺寸和节奏仍需用户审阅，尚未接入桌面应用或实现随机变身。模型图片提示词及实际输入参考见 [生成记录](../skills/mole-classic-art/references/v41/generation-prompts.md)。

经典 SWF 的来源、下载哈希和年代限制见资料库。现有证据不能逐文件证明属于 2008—2010 年，也不能保证涵盖互联网上所有相关素材。项目里的原素材静帧颜色包含现有适配。

复现命令见 `scripts/art/preview-transform-v41.py --help`；独立姿态数与 GIF 输出帧数另见预览 `manifest.json`。
