# 经典拉姆素材资料库（年代待进一步核实）

本资料库聚焦用户要求的 2008—2010 年经典拉姆画法，记录能取得且能校验的原客户端资源。**目前没有逐个文件在 2008、2009 或 2010 年发布的独立证据**；文件夹名称代表研究目标，不是对文件年代的证明。部分超拉和装扮也可能是更晚推出的，不能当作早期造型的年代依据。

## 在线来源和范围

- 原游戏基础拉姆历史资源地址：`http://mole.61.com/resource/NPC/lamubone.swf`。
- 本次从玩家社区存档 [Miigon/RecMoleRes](https://github.com/Miigon/RecMoleRes/tree/7a6d6b3c7037a85afb28ad6abd4d7f4adfddb5ff) 固定提交 `7a6d6b3c7037a85afb28ad6abd4d7f4adfddb5ff` 取得；对方自述其存档包含原客户端资源，但该仓库不是官方运营来源。
- [manifest.json](manifest.json) 含下载日期、逐文件固定原始 URL、大小、SHA-256。目录 [raw/](raw/) 中有 36 个 SWF：原拉姆骨骼、宠物模型，以及固定提交中 `petcloth/swf/cloth`、`petcloth/swf2`（含 `pet5` 和 `pet101`）能够列出的装扮/动作文件。它们保留原始内容供研究，不需要运行 Flash。
- 五个关键角色 SWF 的 SHA-256 与项目已有 [原动作来源](../../../public/assets/original/football/source.json) 一致。其余装扮文件的用途和年代待逐一核实；文件编号或所在目录不构成时间证据。
- 这不是对互联网上所有拉姆素材的穷尽采集。百度等搜索和一些攻略站在当前环境无法访问；不能根据没看到的资料断言不存在。后续发现可靠出处、年代信息与原文件时可继续扩充清单。

## 可直接查看的原图参考

[images/](images/) 为已在项目使用的原素材导出副本：七种形态各四种颜色共 28 张静帧，加花盆、种子身体和种子动作 GIF。普通拉姆的静帧从原动作图集提取，并依据客户端色彩变换适配红、黄、蓝、粉；神力/元素形态也基于原资源导出。它们不是图片模型重画的角色，但颜色和应用内尺寸属于本项目适配。详见 [静帧来源记录](../../../public/assets/original/pets/source-record.json)、[种子来源记录](../../../public/assets/original/seed/source.json)。

- 原无叶初级： [红](images/junior-red-idle.png) · [黄](images/junior-yellow-idle.png) · [蓝](images/junior-blue-idle.png) · [粉](images/junior-pink-idle.png)
- 原两叶中级： [红](images/middle-red-idle.png) · [黄](images/middle-yellow-idle.png) · [蓝](images/middle-blue-idle.png) · [粉](images/middle-pink-idle.png)
- [原种子完整动作](images/source-motion.gif) · [原花盆](images/pot.png) · [原种子身体](images/body-still.png)
- 已在项目的 [原身体与动作图集](../../../public/assets/classic/)；[原足球完整时间轴](../../../public/assets/original/football/)；[原表情素材](../../../public/assets/original/emotions/)；[原角色参考板](../../../skills/mole-classic-art/references/v38/original-reference.png)。这些目录的各自来源记录应与图片一并阅读。

## 观察重点

角色身体由色块和自身深色底部区域构成，不给身体添加粗黑色描边。眼白、瞳孔、叶片和身体高光分别保持原素材的比例与相互位置；叶子与道具存在自己的绿色或同色深色边缘，不应误读为所有形状一律没有轮廓。静止姿态不能证明动作过程，必须查看对应原始时间轴、动作图集或导出序列。新绘变身的动作设计是本项目原创，不应被称为原著动作。
