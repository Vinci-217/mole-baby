# 困倦眼睑、嘴部呼吸和原版 Z

上版把原开心笑眼用于睡觉、摸头，表情不符合这两个状态。本版摸头使用正常大眼睛；睡觉导出真正的原困倦眼睑：种子 shape35，初级采用原打盹的 shape753，其他形态复用 `boring` 的 shape1726 曲线。为小尺寸显示加深眼线，没有重画曲线。嘴巴沿用原打哈欠的 shape743 轮廓，调为深色并做小幅张合，保持原身体和叶冠的正常位置。原 sprite761 / shape760 是上浮的 Z 字，运行时三枚交错上浮淡出。

这是原素材的桌宠适配；原文件没有统一的 `sleep` 标签，本版不宣称这整段呼吸是官方原动画。保留种子的独立花盆和身体，高级、神力仍缓缓悬浮。每形态八格，种子 96×99，其他 192×208；各帧只改变嘴部，不旋转头部，不切换开心姿势。色彩仍使用原四色身体遮罩，眼白、叶冠和 Z 不跟着身体染色。

[source.json](source.json) 记录原素材编号、原 SWF 校验值、配准、嘴部位置和小尺寸配色适配；[checksums.json](checksums.json) 记录导出图片校验值。

```sh
python3 scripts/art/export-slumber.py \
  --ordinary-xml /path/to/lamubone.xml \
  --sources /path/to/evolution-xml-files \
  --work /tmp/mole-slumber \
  --ffdec /path/to/ffdec-cli.jar
```

依赖 Python 3、Pillow、NumPy、Java、JPEXS 26.3。原 `.swf` 与 `.xml` 放在一起时会直接导出原 Z 字；只有 XML 也可自动转换后导出。完整原帧来源见相邻 `football/source.json`。

v0.22 将嘴型收窄并压低开口高度，眼线改为较柔和的棕色；开合与身体起伏统一为6.4秒。`snorePoint` 根据每种形态身体遮罩的右边界确定，原 Z 图缩至9px，从脸侧发出。仍是原素材适配，不使用重画的眼睛或嘴型。
