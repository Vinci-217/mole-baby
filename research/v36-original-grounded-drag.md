# 中级原版造型，移除拖拽腾空段 · 未发布

用户要求保留原版身体和叶片，只在拖动时去掉跳跃。前一版跨阶段拼接初级身体和中级叶片破坏了造型，本轮停止使用该方案。

## 先生成帧，再接入逐帧播放

1. 从原页游 `lamubone.swf` 导出12倍分辨率的中级完整动作，逐帧检查。原动作的第7–15帧有明显拉长、腾空和回落，第16帧是清空/重置。
2. 取同一中级角色的贴地姿态：第1帧原形、第5帧轻微压缩。身体与叶片使用同一套原始画面生成补间，未再拼接初级身体或单独换叶片。
3. 眼白、瞳孔和高光保留原始矢量符号148、12、94，按原始放置矩阵生成过渡，避免直接混合两张脸造成重影。身体/叶片画面使用双向运动补间，再以固定比例注册整个角色。
4. 每个方向生成17张PNG，共五方向85帧；先生成对照GIF和帧序列，再打包为应用使用的透明图集。客户端根据拖动时钟平滑取帧，不实时计算光流或绘制新脸。

这是基于原画关键姿态生成的桌宠适配，并非核实到的官方完整拖拽动画。左右转身、轻微压缩和回到原形保留，腾空段不参与播放。身体底部固定；压缩会使上沿略向下移动，不将这种压缩描述为“全身完全不变”。

## 可直接查看

- [应用实录：中级拖动不腾空](../artifacts/animation-gallery/middle-nojump.gif)
- [左侧原版行走 / 右侧本轮生成的贴地序列](../artifacts/v36-nojump/original-vs-grounded.gif)
- [PNG帧序列下载，五方向各17张，红色预览](../artifacts/v36-nojump/frames-red.zip)
- [序列图：每方向抽取九帧](../artifacts/v36-nojump/frames.png)
- [初级 / 中级完整拖拽](../artifacts/animation-gallery/drag-young.gif)
- [五阶段实际拖拽](../artifacts/animation-gallery/drag.gif)

原版对照显示原始行走完整周期，包括腾空；右侧只显示本轮贴地帧的往返循环。应用实录另外展示真实鼠标输入驱动的左右移动与松手过程。

## 原始来源

中级完整造型来自原页游主Sprite1532，原文件[社区存档](https://raw.githubusercontent.com/Miigon/RecMoleRes/master/root/resource/NPC/lamubone.swf)的SHA-256为 `01abf65f3e8db098068a830268bd7a7cefefc1edc93a44565788783d23f8a0cf`。

原素材的身体、叶片、眼睛、高光和配色沿用原资源。补间帧、底部注册和桌面拖动响应属于本项目适配。[source.json](../public/assets/original/drag/source.json)记录各方向的原始关键帧、排除的腾空帧、缩放和生成姿态；[checksums.json](../public/assets/original/drag/checksums.json)记录运行图集哈希。

初级沿用已有原帧，本轮修改范围为中级拖动与松手。其他阶段、睡觉、摸摸及已认可的足球未重新绘制。

## 验证

- 逐帧观察生成图，拒绝了最初直接混合整张脸出现重影的试验；当前脸部使用原始矢量符号及原放置矩阵补间。
- 资源生成检查完整身体/叶片没有裁切，底部保持固定，排除腾空姿态。
- 三组应用实录均有多个压缩帧和左右侧脸，中级身体底部的垂直变化为0个CSS像素，压缩范围覆盖0–0.9375。记录见[middle-nojump-checks.json](../artifacts/animation-gallery/middle-nojump-checks.json)。
- 四种颜色、两件装扮、双向拖拽、松手回待机通过浏览器检查；单元测试覆盖底部注册、非腾空帧、方向、连续压缩与减少动态效果。
- 预览GIF、PNG序列ZIP、Java/Python/OpenCV均不进入客户端安装目录。

## 生成步骤

已有原SWF的XML、原动作导出及JPEXS FFDec工具后：

```sh
python3 -m pip install numpy pillow scipy opencv-python-headless==4.11.0.86
python3 scripts/art/prepare-original-actions.py --ordinary-xml /path/lamubone.xml --sources /path/source-xml --work /path/original-export --ffdec /path/ffdec-cli.jar --forms ordinary --actions down,leftdown,left,rightdown,right --omit-middle-insect
java -jar /path/ffdec-cli.jar -selectid 1532 -zoom 12 -ignorebackground -export sprite /path/highres-original/frames /path/original-export/reference.swf
java -jar /path/ffdec-cli.jar -selectid 1532 -zoom 12 -ignorebackground -export sprite /path/highres-original/probe /path/original-export/ordinary-probe.swf
python3 scripts/art/prepare-grounded-layers.py --reference /path/reference.xml --probe /path/ordinary-probe.xml --original-frames /path/highres-original --clips /path/clips.json --ffdec /path/ffdec-cli.jar --output /path/layers
python3 scripts/art/author-grounded-drag.py --source /path/highres-original --layers /path/layers --clips /path/clips.json --output /path/authored --review artifacts/v36-nojump
python3 scripts/art/pack-drag-sequences.py --work /path/original-export --middle-frames /path/authored
npm test
npm run build
node scripts/record-horizontal-drag.cjs --middle
node scripts/record-horizontal-drag.cjs --young
node scripts/record-horizontal-drag.cjs
node scripts/young-drag-regression.cjs
node scripts/compact-production-check.cjs
node scripts/render-animation-readme.cjs
```

只提交 `preview/ramu-drag-study`，未改版本号、main、标签、Release或自动更新渠道。等待用户查看效果后再决定是否发版。
