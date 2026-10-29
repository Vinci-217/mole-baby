# 拉姆 · mole-baby

> **本分支有待确认的动画预览 v2**：[校正 SWF 循环帧序、鼠标手速驱动叶片、五阶段甩出惯性](docs/previews/rotor-throw/README.md)。只供审阅，尚未接入客户端或发版。

> **Windows 与 Mac 桌面拉姆。** [下载与安装](https://github.com/Vinci-217/mole-baby/releases/latest) · [自动更新说明](docs/UPDATES.md)。修正比例、更新确认与Windows老系统兼容，玩法与动画见下方，构建进度见 [GitHub Actions](https://github.com/Vinci-217/mole-baby/actions/workflows/windows-build.yml)。

## 本轮更新 · v0.31.4

本版已完成五平台正式成品验收并发布。[下载与安装说明](https://github.com/Vinci-217/mole-baby/releases/tag/v0.31.4) · [正式发布与线上增量验证](research/release-0.31.4-validation.md)。

Windows 与 Mac 新增增量下载：优先复用本地旧安装包，只下载变化部分，校验后安装。**旧版首次升级到本版仍可能下载完整包；安装本版后，后续更新才能使用新逻辑。** 新增大量素材或没有匹配缓存时会回退完整下载，下载与安装继续分别确认。[更新方式与安装指引](docs/UPDATES.md) · [增量自测结果](docs/INCREMENTAL-UPDATES-PREVIEW.md)。

拉姆名字下方常驻显示具体状态，如“精神不足 · 需要清洁”；点状态可打开状态窗，睡眠时可点“叫醒”。状态小窗改用浅色圆角进度条，底部背包按钮完整显示，计时数字与状态文字各自保留空间。[界面截图](docs/DESKTOP-STATUS-UI.md)。

修正 Windows 从小屋返回桌面后，随走动逐步变大的窗口边界，并更新常规版透明窗口重绘修复。修复初级、中级、高级与经典三叶超拉的原版玩耍入口被自主动作误挡，状态不足时显示具体原因。[窗口与玩耍验证](docs/WINDOWS-SURFACE-PLAY.md)。

原有全部 SWF 动作、换色游戏、商店与物品、课程、小屋、成长、装扮和存档继续保留。当前更新源继续使用 GitHub Releases；本轮不接入国内镜像。[本次更新说明](RELEASE_NOTES.md)。

## v0.31.3 · 原版动作与拉姆换色游戏

新增“小屋游戏 → 拉姆换色游戏”：用原版红绿蓝色瓶和调色锅实时试色，装成独特药水，再从背包单击使用。自调颜色随成长、阶段切换和重启保留；首次领养仍只有原著四种基础色。

上传的 **247 个 SWF／238 个不同原件／47,204 个时间帧**已全部分类接入：用品单击播放对应原片，足球、逗逗、弹簧、乐刷刷和涂鸦在桌面与小屋“一起玩耍”。完成一次原版玩耍心情最多 +6、精力 -3；取消不发完成奖励，不靠点击加成长。

删除顶书练习。摸摸、看书、睡眠、追蝴蝶、张望、醒来和眩晕新增九形态 **63 组完整帧序列**。上传原片完整保留身体、眼睛、叶片和道具；日常帧为现有原角色及位图道具的离线合成，来源分别记录。高级八叶冠使用原图层预合成旋转帧。

原片覆盖初级、中级、高级、经典三叶超级拉姆。种子和另外四种神力形态保留既有用品适配；整段原片播放期间暂收装扮，结束自动恢复。[使用说明](docs/UPLOADED_ACTIONS.md) · [来源、适配范围及转换方法](research/v31-original-actions-and-colour-mixing.md)。

![原版 RGB 调色锅与拉姆实时试色](artifacts/v31/browser-colour-mixer.png)

## v0.31 完整帧序列预览

以下 GIF 从应用实际播放的帧表重建，按 24fps 时间表编码（GIF 延时量化到 10ms）。上传原片按同一段动作展示四组原形态，各格完整显示整段活动范围，不代表桌面实际尺寸。相同源帧不冒称新增手绘。下列日常为九形态离线合成，穿装扮时仍保留衣服接点同步的分层方案。

### 乖巧摸摸

![九形态 · 乖巧摸摸](docs/previews/v31/daily-pet.gif)

### 翻书学习

![九形态 · 翻书学习](docs/previews/v31/daily-focus.gif)

### 闭眼安睡

![九形态 · 闭眼安睡](docs/previews/v31/daily-sleep.gif)

### 追逗蝴蝶

![九形态 · 追逗蝴蝶](docs/previews/v31/daily-watch-butterfly.gif)

### 好奇张望

![九形态 · 好奇张望](docs/previews/v31/daily-look-around.gif)

### 醒来

![九形态 · 醒来](docs/previews/v31/daily-wake.gif)

### 眩晕

![九形态 · 眩晕](docs/previews/v31/daily-dizzy.gif)

### 全部上传动作

每个编号都能从用品或一起玩耍触发；原包缺少的阶段不伪造。原编号、中文归档路径、散列和重复文件共用关系见[源件清单](research/references/uploaded-lamu-actions/sources.json)。

<details>
<summary>展开全部 64 种动作（覆盖上传的 247 个文件）</summary>

#### 巧克力豆 · 180001

![巧克力豆 · 原片四形态](docs/previews/v31/original-180001.gif)

#### 麦香牛奶 · 180002

![麦香牛奶 · 原片四形态](docs/previews/v31/original-180002.gif)

#### 泡泡浴 · 180003

![泡泡浴 · 原片四形态](docs/previews/v31/original-180003.gif)

#### 原版踢足球 · 180004

![原版踢足球 · 原片四形态](docs/previews/v31/original-180004.gif)

#### 万能药水 · 180005

![万能药水 · 原片四形态](docs/previews/v31/original-180005.gif)

#### 复活十字架 · 180006

![复活十字架 · 原片四形态](docs/previews/v31/original-180006.gif)

#### 青叶粽子 · 180007

![青叶粽子 · 原片四形态](docs/previews/v31/original-180007.gif)

#### 浆果果汁 · 180008

![浆果果汁 · 原片四形态](docs/previews/v31/original-180008.gif)

#### 青苹果洗面奶 · 180009

![青苹果洗面奶 · 原片四形态](docs/previews/v31/original-180009.gif)

#### 冰镇西瓜 · 180010

![冰镇西瓜 · 原片四形态](docs/previews/v31/original-180010.gif)

#### 逗逗拉姆 · 一 · 180011

![逗逗拉姆 · 一 · 原片四形态](docs/previews/v31/original-180011.gif)

#### 逗逗拉姆 · 二 · 180012

![逗逗拉姆 · 二 · 原片四形态](docs/previews/v31/original-180012.gif)

#### 逗逗拉姆 · 三 · 180013

![逗逗拉姆 · 三 · 原片四形态](docs/previews/v31/original-180013.gif)

#### 运动可乐 · 180014

![运动可乐 · 原片四形态](docs/previews/v31/original-180014.gif)

#### 蔬菜浓汤 · 180015

![蔬菜浓汤 · 原片四形态](docs/previews/v31/original-180015.gif)

#### 中秋月饼 · 180016

![中秋月饼 · 原片四形态](docs/previews/v31/original-180016.gif)

#### 熊熊饼干 · 180017

![熊熊饼干 · 原片四形态](docs/previews/v31/original-180017.gif)

#### 摩香汉堡 · 180018

![摩香汉堡 · 原片四形态](docs/previews/v31/original-180018.gif)

#### 水晶蛋糕 · 180019

![水晶蛋糕 · 原片四形态](docs/previews/v31/original-180019.gif)

#### 火腿三明治 · 180020

![火腿三明治 · 原片四形态](docs/previews/v31/original-180020.gif)

#### 兔兔胡萝卜汁 · 180021

![兔兔胡萝卜汁 · 原片四形态](docs/previews/v31/original-180021.gif)

#### 清爽沐浴露 · 180022

![清爽沐浴露 · 原片四形态](docs/previews/v31/original-180022.gif)

#### 魔法弹簧 · 180023

![魔法弹簧 · 原片四形态](docs/previews/v31/original-180023.gif)

#### 喜刷刷牙膏 · 180024

![喜刷刷牙膏 · 原片四形态](docs/previews/v31/original-180024.gif)

#### 跳跳布丁 · 180025

![跳跳布丁 · 原片四形态](docs/previews/v31/original-180025.gif)

#### 乐刷刷 · 180026

![乐刷刷 · 原片四形态](docs/previews/v31/original-180026.gif)

#### 可可果 · 180027

![可可果 · 原片四形态](docs/previews/v31/original-180027.gif)

#### 咕咕果 · 180028

![咕咕果 · 原片四形态](docs/previews/v31/original-180028.gif)

#### 爽爽果 · 180029

![爽爽果 · 原片四形态](docs/previews/v31/original-180029.gif)

#### 开心果 · 180030

![开心果 · 原片四形态](docs/previews/v31/original-180030.gif)

#### 珍味八宝饭 · 180041

![珍味八宝饭 · 原片四形态](docs/previews/v31/original-180041.gif)

#### 饺子 · 180042

![饺子 · 原片四形态](docs/previews/v31/original-180042.gif)

#### 苹果派 · 180043

![苹果派 · 原片四形态](docs/previews/v31/original-180043.gif)

#### 草莓派 · 180044

![草莓派 · 原片四形态](docs/previews/v31/original-180044.gif)

#### 拉姆小馒头 · 180045

![拉姆小馒头 · 原片四形态](docs/previews/v31/original-180045.gif)

#### 黑森林怪味圈 · 180046

![黑森林怪味圈 · 原片四形态](docs/previews/v31/original-180046.gif)

#### 热狗 · 180047

![热狗 · 原片四形态](docs/previews/v31/original-180047.gif)

#### 西瓜解暑冲饮 · 180048

![西瓜解暑冲饮 · 原片四形态](docs/previews/v31/original-180048.gif)

#### 清凉草莓浴液 · 180049

![清凉草莓浴液 · 原片四形态](docs/previews/v31/original-180049.gif)

#### 水萤救治药水 · 180050

![水萤救治药水 · 原片四形态](docs/previews/v31/original-180050.gif)

#### 炎火救治药水 · 180051

![炎火救治药水 · 原片四形态](docs/previews/v31/original-180051.gif)

#### 金沙救治药水 · 180052

![金沙救治药水 · 原片四形态](docs/previews/v31/original-180052.gif)

#### 酸甜苹果汁 · 180053

![酸甜苹果汁 · 原片四形态](docs/previews/v31/original-180053.gif)

#### 美味花香豆 · 180054

![美味花香豆 · 原片四形态](docs/previews/v31/original-180054.gif)

#### 牵牛花洗面啫喱 · 180055

![牵牛花洗面啫喱 · 原片四形态](docs/previews/v31/original-180055.gif)

#### 冰酷可乐 · 180056

![冰酷可乐 · 原片四形态](docs/previews/v31/original-180056.gif)

#### 雪顶椰汁 · 180057

![雪顶椰汁 · 原片四形态](docs/previews/v31/original-180057.gif)

#### 爱心魔魔球 · 180058

![爱心魔魔球 · 原片四形态](docs/previews/v31/original-180058.gif)

#### 椰香烤饼 · 180059

![椰香烤饼 · 原片四形态](docs/previews/v31/original-180059.gif)

#### 拉姆魔法洗面奶 · 180060

![拉姆魔法洗面奶 · 原片四形态](docs/previews/v31/original-180060.gif)

#### 石榴多多 · 180061

![石榴多多 · 原片四形态](docs/previews/v31/original-180061.gif)

#### 仙桃玉米酥 · 180062

![仙桃玉米酥 · 原片四形态](docs/previews/v31/original-180062.gif)

#### 石榴甜旋风 · 180063

![石榴甜旋风 · 原片四形态](docs/previews/v31/original-180063.gif)

#### 泡泡桃汁浴 · 180064

![泡泡桃汁浴 · 原片四形态](docs/previews/v31/original-180064.gif)

#### 杰克南瓜酥 · 180065

![杰克南瓜酥 · 原片四形态](docs/previews/v31/original-180065.gif)

#### 南瓜巫浴液 · 180066

![南瓜巫浴液 · 原片四形态](docs/previews/v31/original-180066.gif)

#### 奶油鬼脸匹萨 · 180067

![奶油鬼脸匹萨 · 原片四形态](docs/previews/v31/original-180067.gif)

#### 怪味南瓜汁 · 180068

![怪味南瓜汁 · 原片四形态](docs/previews/v31/original-180068.gif)

#### 百合花浴液 · 180069

![百合花浴液 · 原片四形态](docs/previews/v31/original-180069.gif)

#### 云朵面包 · 180070

![云朵面包 · 原片四形态](docs/previews/v31/original-180070.gif)

#### 彩色涂鸦 · 1 · tuya1

![彩色涂鸦 · 1 · 原片四形态](docs/previews/v31/original-tuya1.gif)

#### 彩色涂鸦 · 2 · tuya2

![彩色涂鸦 · 2 · 原片四形态](docs/previews/v31/original-tuya2.gif)

#### 彩色涂鸦 · 3 · tuya3

![彩色涂鸦 · 3 · 原片四形态](docs/previews/v31/original-tuya3.gif)

#### 彩色涂鸦 · 4 · tuya4

![彩色涂鸦 · 4 · 原片四形态](docs/previews/v31/original-tuya4.gif)

</details>

## 上一版 · v0.30.10

背包仅显示食物、饮品、清洁和药水，状态及规则使用独立入口。小屋增加全屏查看，支持Esc退出，返回桌面自动恢复原窗口。

设置支持“自动成长／固定形态”，修改后点击应用并确认。同阶段保留已有进度，选择其他阶段从该阶段起点重新成长；进度自动保存，显示百分比及距下一阶段所需的健康清醒时间。修复旧存档重开后自动成长被重新锁定的问题。

设置按拉姆信息、成长、陪伴与桌面、声音与音乐、计时、存档、软件帮助分组。水火木魔法固定比例、快速睡眠、随机奖励和托盘状态继续保留。[本轮验收](research/release-0.30.10-validation.md) · [完整更新说明](RELEASE_NOTES.md)。

![火系最高技能 · 固定比例，大特效超出原区域](artifacts/v307/fire-6-browser.png)

![小屋点击地面移动 · 实际运行录制](docs/previews/room-walk.gif)

### 两片叶子的安静待机

中级拉姆去掉无人互动时持续游移的瞳孔，平时保持平视；短眨眼之间留出长短不同的停顿，叶片摆动也减小。鼠标靠近时轻轻看过来，离开后缓缓回正。保留当前原素材身体、眼睛、叶片与四种颜色；本次调整的是播放节奏和视线规则，不是重新绘制角色。

以下是100×109像素实际组件、四种配色的12秒录制：前8秒安静陪伴，随后模拟鼠标靠近2秒、离开2秒。288张浏览器截图用于GIF编码，不代表新增288张手绘姿态。此待机效果经用户确认后纳入本轮。

![中级拉姆新版待机 · 四种颜色](artifacts/middle-calm-idle/after.gif)

<details>
<summary>展开修改前对照</summary>

![修改前同场景待机](artifacts/middle-calm-idle/before.gif)

</details>

[参考、改动与验证记录](research/middle-calm-idle.md)

## 本轮修复 · v0.30.2

桌面提示结束后移除节点及阴影，避免透明窗口上残留横条；学院显示上课条件，并允许结束自主小动作后直接上课。设置手动选择阶段后固定等级和形态，未选择的拉姆继续正常成长；历史回忆中可识别的手动选择在读档时迁移。神力形态增加原版三片金叶的经典超级拉姆，共五种。

设置中的「允许后台播放」默认关闭，开启后回桌面或收进托盘可继续播放；托盘可直接开关音乐。Mac 更新增加 HEAD 失败后的 GET 回退，网络失败时提供下载页入口；当前本地签名 Mac 仍需确认下载并打开 DMG 替换应用。

## 此前新增 · v0.30.1

魔法入门课一节后学会变魔术：原形冒烟遮住，变成蓝紫色纹样魔术盒，再冒烟恢复。4张盒子表情、16张烟复用于所有形态，颜色与装扮独立保留。盒子和烟为自制素材，原拉姆继续使用原图。

![共用魔术盒：拉姆变盒子，再变回拉姆](artifacts/v30-workflow/magic-box.gif)

第五阶段开放火、水、木三系，每系有六个变身（v0.30.4起每系只需学一节）。18个官网原版文件已取得，保留1,711个原始时间帧，逐段播放完整动作；自制烟雾负责前后衔接。[原文件、逆向公式与导出记录](research/original-element-skills.md)。

历史镜头预览（v0.30.6；当前固定比例效果见上方）：

![18段原版三系动作：火、水、木各六段](artifacts/v30-workflow/original-elements.gif)

桌面玩耍为3×3九格，睡觉、打工和变魔术有独立按钮。状态小窗可切换用品分类，问号显示真实状态规则。计时可选正向或倒数，完成及手动结束记录在回忆。

布置小屋直接在实际背景拖放，新增19件原版家具及5间原版房型；布置入口移出选项栏。语言、英文课和餐厅打工继续保留，工资与课程进度只结算一次。

[课程与玩法说明](docs/COURSES.md) · [素材与美术复用skill](skills/mole-classic-art/SKILL.md) · [本次更新](RELEASE_NOTES.md)。此前v0.29.6的比例、种子短哈欠、Windows白条与更新确认修复继续保留；[老系统安装选择](docs/WINDOWS.md)。

### 修正叶片接点

上一版把外侧叶片的重叠处误作叶柄，本轮改为双叶中央接点，并通过眼部位置跟随头部。身体仍沿用初级原帧；独立叶片转动幅度收小。以下是实际应用录制，左初级、右中级。

![修正后的初级和中级同步拖拽](artifacts/animation-gallery/drag-young.gif)

![中级单独拖拽与松手衔接](artifacts/animation-gallery/middle-bound.gif)

![修正接点后的合成序列：相同身体加中级叶片](artifacts/v38-school/crown/bound-sequence.gif)

[下载75张透明PNG逐帧序列](artifacts/v38-school/crown/frames-red.zip) · [接点与轮廓抽帧图](artifacts/v38-school/crown/frames.png)

![五阶段实际拖拽与松手衔接](artifacts/animation-gallery/drag.gif)

睡眠、摸摸、足球等既有动作仍全部展示在下面。

## 此前动画对照（保留历史录制）

以下为此前版本的基础动作、32种用品、9件装扮及18段原版三系变身录制；小日常中的顶书练习已删除，本轮最新日常与全部上传原片以上方 v0.31 预览为准。每一组都直接显示 GIF；相同动作的兼容名称也有对应预览。九件装扮分别展示全部八种形态的摸摸回应。原帧方案与应用内录制分开标注，来源与自制适配分别标注。

### 日常移动与张望

![日常移动与张望](artifacts/animation-gallery/movement.gif)

### 开心、接到物品、奖励与失落

![开心、接到物品、奖励与失落](artifacts/animation-gallery/reactions.gif)

### 安静睡觉 · 原型眼睑和小小的呼吸

![安静睡觉 · 原型眼睑和小小的呼吸](artifacts/animation-gallery/sleep.gif)

### 摸摸、翻书与逗蝴蝶 · 应用内动作

![摸摸、翻书与逗蝴蝶 · 应用内动作](artifacts/animation-gallery/interaction.gif)

### 不同心情的回应

![不同心情的回应](artifacts/animation-gallery/moods.gif)

### 需要照料时的小状态

![需要照料时的小状态](artifacts/animation-gallery/conditions.gif)

### 自己的小日子

![自己的小日子](artifacts/animation-gallery/pastimes.gif)

### 四边走入 / 藏好 / 探头 · 动作层预览

![四边走入 / 藏好 / 探头 · 动作层预览](artifacts/animation-gallery/edges.gif)

### 全部消耗用品 · 第一页

![全部消耗用品 · 第一页](artifacts/animation-gallery/items1.gif)

### 全部消耗用品 · 第二页

![全部消耗用品 · 第二页](artifacts/animation-gallery/items2.gif)

### 九件装扮 · 摸摸 / 睡觉 / 看书 / 玩球

![九件装扮 · 摸摸 / 睡觉 / 看书 / 玩球](artifacts/animation-gallery/wardrobe.gif)

### 四种最高形态 · 轻轻摸摸 / 闭眼安睡 / 左右飞行

![四种最高形态 · 轻轻摸摸 / 闭眼安睡 / 左右飞行](artifacts/animation-gallery/evolutions.gif)

### 四种颜色 · 安静睡眠

![四种颜色 · 安静睡眠](artifacts/animation-gallery/colours.gif)

### 完整玩球 · 全部八种形态

![完整玩球 · 全部八种形态](artifacts/animation-gallery/football.gif)

### 语言、英文和魔术课 · 结业前的学习动作

![语言、英文和魔术课 · 结业前的学习动作](artifacts/animation-gallery/school.gif)

### 原版三系变身与魔术盒

见本页顶部的完整原版动作和可复用魔术盒序列。旧版自绘四系方案已从学院替换，旧存档课时和证书仍保留。

### 餐厅服务员 · 端盘、送餐、收拾

![餐厅服务员 · 端盘、送餐、收拾](artifacts/animation-gallery/restaurant.gif)


### 其余现有动作 · 1

![其余现有动作 · 1](artifacts/animation-gallery/remaining-1.gif)

### 其余现有动作 · 2

![其余现有动作 · 2](artifacts/animation-gallery/remaining-2.gif)

### 其余现有动作 · 3

![其余现有动作 · 3](artifacts/animation-gallery/remaining-3.gif)

### 其余现有动作 · 4

![其余现有动作 · 4](artifacts/animation-gallery/remaining-4.gif)

### 庆生小帽 · 全部形态的摸摸回应

![庆生小帽 · 全部形态的摸摸回应](artifacts/animation-gallery/outfit-party-cap.gif)

### 金色羽毛 · 全部形态的摸摸回应

![金色羽毛 · 全部形态的摸摸回应](artifacts/animation-gallery/outfit-gold-feather.gif)

### 紫色魔法帽 · 全部形态的摸摸回应

![紫色魔法帽 · 全部形态的摸摸回应](artifacts/animation-gallery/outfit-wizard-cap.gif)

### 星星魔杖 · 全部形态的摸摸回应

![星星魔杖 · 全部形态的摸摸回应](artifacts/animation-gallery/outfit-star-wand.gif)

### 魔法书 · 全部形态的摸摸回应

![魔法书 · 全部形态的摸摸回应](artifacts/animation-gallery/outfit-magic-book.gif)

### 粉兔帽 · 全部形态的摸摸回应

![粉兔帽 · 全部形态的摸摸回应](artifacts/animation-gallery/outfit-rabbit-hood.gif)

### 火焰羽翼 · 全部形态的摸摸回应

![火焰羽翼 · 全部形态的摸摸回应](artifacts/animation-gallery/outfit-leaf-hood.gif)

### 彩虹眼罩 · 全部形态的摸摸回应

![彩虹眼罩 · 全部形态的摸摸回应](artifacts/animation-gallery/outfit-sport-goggles.gif)

### 皇冠猫耳 · 全部形态的摸摸回应

![皇冠猫耳 · 全部形态的摸摸回应](artifacts/animation-gallery/outfit-warm-scarf.gif)

### 原帧交互方案与来源对照（历史研究）

下面两组拖拽是上一轮的固定姿态研究，已由本页开头的多朝向、多帧方案替换。保留用于对照。追蝶保留原217帧追虫的身体与叶片；道具和交互编排属于桌宠适配。

![初中级拿起前与水平拖动](artifacts/v30-preview/move.gif)

![五阶段原帧拖动](artifacts/v30-preview/drag.gif)

![原版追虫与追蝴蝶适配](artifacts/v30-preview/butterfly.gif)

### 动作名与预览对应

| 动作名 | GIF 分类 |
| --- | --- |
| `eat` | [remaining-1](artifacts/animation-gallery/remaining-1.gif) |
| `feed` | [remaining-1](artifacts/animation-gallery/remaining-1.gif) |
| `drink` | [remaining-1](artifacts/animation-gallery/remaining-1.gif) |
| `wash` | [remaining-1](artifacts/animation-gallery/remaining-1.gif) |
| `use` | [remaining-2](artifacts/animation-gallery/remaining-2.gif) |
| `medical` | [remaining-2](artifacts/animation-gallery/remaining-2.gif) |
| `thirsty` | [conditions](artifacts/animation-gallery/conditions.gif) |
| `hungry` | [conditions](artifacts/animation-gallery/conditions.gif) |
| `sick` | [conditions](artifacts/animation-gallery/conditions.gif) |
| `tired` | [conditions](artifacts/animation-gallery/conditions.gif) |
| `dirty` | [conditions](artifacts/animation-gallery/conditions.gif) |
| `pet` | [interaction](artifacts/animation-gallery/interaction.gif) |
| `waving` | [movement](artifacts/animation-gallery/movement.gif) |
| `catch` | [reactions](artifacts/animation-gallery/reactions.gif) |
| `failed` | [reactions](artifacts/animation-gallery/reactions.gif) |
| `play` | [wardrobe](artifacts/animation-gallery/wardrobe.gif) |
| `reward` | [reactions](artifacts/animation-gallery/reactions.gif) |
| `happy` | [reactions](artifacts/animation-gallery/reactions.gif) |
| `wake` | [sleep](artifacts/animation-gallery/sleep.gif) |
| `idle` | [movement](artifacts/animation-gallery/movement.gif) |
| `waiting` | [edges](artifacts/animation-gallery/edges.gif) |
| `still` | [remaining-2](artifacts/animation-gallery/remaining-2.gif) |
| `drag` | [drag](artifacts/animation-gallery/drag.gif) |
| `walk-left` | [movement](artifacts/animation-gallery/movement.gif) |
| `walk-right` | [movement](artifacts/animation-gallery/movement.gif) |
| `running-left` | [remaining-2](artifacts/animation-gallery/remaining-2.gif) |
| `running-right` | [remaining-3](artifacts/animation-gallery/remaining-3.gif) |
| `running` | [remaining-3](artifacts/animation-gallery/remaining-3.gif) |
| `focus` | [interaction](artifacts/animation-gallery/interaction.gif) |
| `dizzy` | [moods](artifacts/animation-gallery/moods.gif) |
| `watch-butterfly` | [interaction](artifacts/animation-gallery/interaction.gif) |
| `look-around` | [movement](artifacts/animation-gallery/movement.gif) |
| `sleep` | [sleep](artifacts/animation-gallery/sleep.gif) |
| `peek` | [remaining-3](artifacts/animation-gallery/remaining-3.gif) |
| `hide` | [remaining-3](artifacts/animation-gallery/remaining-3.gif) |
| `review` | [remaining-4](artifacts/animation-gallery/remaining-4.gif) |
| `mood-joy` | [moods](artifacts/animation-gallery/moods.gif) |
| `mood-grumpy` | [moods](artifacts/animation-gallery/moods.gif) |
| `mood-content` | [moods](artifacts/animation-gallery/moods.gif) |
| `mood-dozy` | [sleep](artifacts/animation-gallery/sleep.gif) |
| `read-alone` | [pastimes](artifacts/animation-gallery/pastimes.gif) |
| `play-alone` | [pastimes](artifacts/animation-gallery/pastimes.gif) |
| `spell` | [pastimes](artifacts/animation-gallery/pastimes.gif) |
| `balance` | [pastimes](artifacts/animation-gallery/pastimes.gif) |
| `school-language` | [school](artifacts/animation-gallery/school.gif) |
| `school-english` | [school](artifacts/animation-gallery/school.gif) |
| `school-magic` | [school](artifacts/animation-gallery/school.gif) |
| `restaurant` | [restaurant](artifacts/animation-gallery/restaurant.gif) |
| `skill-language` | [school-skills](artifacts/animation-gallery/school-skills.gif) |
| `skill-english` | [school-skills](artifacts/animation-gallery/school-skills.gif) |
| `skill-magic` | [school-skills](artifacts/animation-gallery/school-skills.gif) |
| `skill-wind` | [elemental-skills](artifacts/animation-gallery/elemental-skills.gif) |
| `skill-fire` | [elemental-skills](artifacts/animation-gallery/elemental-skills.gif) |
| `skill-ice` | [elemental-skills](artifacts/animation-gallery/elemental-skills.gif) |
| `skill-meteor` | [elemental-skills](artifacts/animation-gallery/elemental-skills.gif) |

### 其余已有动图（历史方案 / 原素材参考）

以下保留在仓库中的动图全部列出，用于对照；它们不是本轮已认可的效果。

![历史 / 原素材：drag-shared-body.gif](artifacts/animation-gallery/drag-shared-body.gif)

![历史 / 原素材：middle-elastic.gif](artifacts/animation-gallery/middle-elastic.gif)

![历史 / 原素材：middle-nojump.gif](artifacts/animation-gallery/middle-nojump.gif)

![历史 / 原素材：v21-original-actions.gif](artifacts/v21-original-actions.gif)

![历史 / 原素材：v22-moods-wardrobe.gif](artifacts/v22-moods-wardrobe.gif)

![历史 / 原素材：v29-bouncy-pull.gif](artifacts/v29-bouncy-pull.gif)

![历史 / 原素材：pet.gif](artifacts/v30-preview/pet.gif)

![历史 / 原素材：original-vs-grounded.gif](artifacts/v36-nojump/original-vs-grounded.gif)

![历史 / 原素材：bound-sequence.gif](artifacts/v37-bound/bound-sequence.gif)

![历史 / 原素材：source-motion.gif](public/assets/original/seed/source-motion.gif)

[本轮课程与接点修订记录](research/v38-school-room.md) · [此前绑定研究（已替换）](research/v37-bound-crown-drag.md) · [原素材来源](research/v30-motion-previews.md)

## 体积精简（本地预览构建）

738张图片 90.38 MB → 55.30 MB，逐张核对透明度和可见像素一致。Java、Python、OpenCV只用于离线生成图片，不随客户端安装。预览GIF、PNG序列ZIP和原始录屏帧均不进入安装目录。此前同版本Electron的Linux目录实测约409 MB → 304 MB；该旧测量未包含后续动画素材，Windows/macOS最终安装包大小待各自构建验证。

[此前测量明细与验证范围](research/v32-animation-and-size.md)


---

一只住在 Windows 或 macOS 桌面的拉姆。可以拖动、摸摸、玩球、喂养，看着它从种子慢慢长大。

[下载正式版 v0.29.6](https://github.com/Vinci-217/mole-baby/releases/tag/v0.29.6) · [构建记录](https://github.com/Vinci-217/mole-baby/actions/workflows/windows-build.yml)

## 直接下载与安装

| 你的电脑 | 推荐安装包 |
| --- | --- |
| Windows 10 / 11（64 位） | [下载 Windows 安装版](https://github.com/Vinci-217/mole-baby/releases/download/v0.29.6/mole-baby-0.29.6-Setup.exe) |
| Windows 7 SP1 / 8 / 8.1（64 位） | [下载64位兼容版](https://github.com/Vinci-217/mole-baby/releases/download/v0.29.6/mole-baby-0.29.6-legacy-x64-Setup.exe) |
| Windows 7 SP1 / 8 / 8.1（32 位） | [下载32位兼容版](https://github.com/Vinci-217/mole-baby/releases/download/v0.29.6/mole-baby-0.29.6-legacy-ia32-Setup.exe) |
| Mac · Apple 芯片（M 系列） | [下载 Apple 芯片 Mac 版](https://github.com/Vinci-217/mole-baby/releases/download/v0.29.6/mole-baby-0.29.6-mac-arm64.dmg) |
| Mac · Intel 芯片 | [下载 Intel Mac 版](https://github.com/Vinci-217/mole-baby/releases/download/v0.29.6/mole-baby-0.29.6-mac-x64.dmg) |

无需登录 GitHub。Mac 在苹果菜单 →「关于本机」查看芯片，需要 macOS 12 或更新版本。Windows 下载后双击安装；Mac 打开 DMG 后拖入「应用程序」。[详细安装、更新与 Mac 首次打开指引](https://github.com/Vinci-217/mole-baby/releases/tag/v0.29.6)放在发布页最上方。

## 小小的桌面陪伴

桌面画布保持100×108px，种子、初级和中级分别以90%、82%、94%统一缩放身体与道具，鼠标移上来显示 **用品、玩耍、计时、小屋**。背包是 **212×216px** 的小侧窗，4×4正方形格，选择食物、饮品、清洁或药水后，**单击物品即刻使用**，库存和实际数值立即更新；食物落盘后逐口吃完，饮品换成小奶瓶吸饮后丢开，清洁统一为泡泡、冲洗、闪亮。动作结束后，实际增益提示缓缓淡出；快速连用会合并尚未展示的增益。没有二次确认或等待领取。

![小背包](artifacts/v25-compact-pocket.png)

桌面玩耍只有玩球、摸摸、挥网逗蝴蝶和回应心情。状态、成长、装扮、回忆、商店、小游戏、背景与设置都在小屋里。房间和侧窗采用同一套奶油色界面，原角色和物品图形继续保留。

![小屋状态](artifacts/v25-room-profile.png)

## 拖动、四边躲藏与托盘

种子可以手动拖动，不会自行散步；其他清醒形态每12–18秒在最后放置点附近随机移动，活动范围约左右150px、上下100px，每步约28–64px，避免跑遍屏幕。用户拖动会重设活动中心。

当前修订方案使用原版方向帧展示左右拖动：初级、中级保持水平路径，神力超拉摸摸保持小幅悬浮。四个交互方案在本页顶部；[上轮整体拉伸方案](artifacts/v29-bouncy-pull.gif)仅保留历史对照，未被认可、未发布。
Windows已关闭托盘和桌宠按钮的系统悬浮提示，避免鼠标停留时出现横条。窗口切换保持同一无边框样式。

拖到工作区任一边缘，松手后立即开始收进去：种子小跳、初中级迈步、高级与神力飞入。收进去后按各形态的真实身体宽度/高度保留约30%在外面，鼠标移上会多探出一些，拖出来才完整出来。随机探头仍为2–5分钟一次。拖动使用系统光标坐标；原生窗口被Windows限制位置时，用内部偏移保持宠物贴边，避免上下拖动累计漂移。小窗开关不改变宠物的屏幕位置。

右下角托盘（Mac菜单栏）可开关 **拉姆置顶**、**鼠标穿透**、散步和躲藏。开启穿透后，连宠物本体也不拦截点击；从托盘取消即可继续互动。透明空白区域仍自动穿透。关闭窗口默认收进托盘，托盘「退出拉姆」才退出。

## 音效与本地回忆

吃东西的吧唧、喝水的咕嘟、洗净提示、灵光和玩球蹦跳为本机合成短音效，不是背景音乐或官方录音。小屋设置有独立的「互动音效」开关、音量和五种试听；BGM仍单独控制。参见 [音效试听](artifacts/v25-interaction-sounds.wav)。

**已移除自由对话、语音输入、朗读及API配置和对话联网服务。** 升级会删除旧API凭据和聊天记录；保留宠物成长、用品、装扮及真实照料回忆。拉姆仍会偶尔出现简短的生活提示和状态气泡，可以关闭主动陪伴，不会打开麦克风或调用对话API。

四种颜色、五个成长阶段和四种最高形态保留；9件装扮使用原服饰素材并按阶段适配。小屋里的商店用摩尔豆购买用品，小游戏奖励和慢成长规则继续保留。角色与服饰来源见 [ASSETS.md](ASSETS.md) 和 [装扮说明](docs/WARDROBE.md)。

## 拉姆自己的小日子

小屋每日签到可领取1000摩尔豆。拉姆会自己翻书、玩球、顶书练平衡，学会魔法入门后还会练习魔术盒变身；出游有归期，可以随时叫回来，经历会进入回忆。自然活动与出游均可在设置关闭，专注计时和安静偏好优先。

[本版画面、实际录屏与实现范围](research/v27-elastic-care.md) · [上版日常活动](research/v26-lively-pet.md)

## 自动更新

默认开启「启动时检查更新」：Windows和Mac每次完全启动约8秒后检查GitHub的最新公开正式版。发现新版先询问是否下载；下载校验完成后，再确认是否安装或重启。选择「稍后」、关闭提示或退出拉姆都不会自动安装。小屋设置和托盘可查看进度、关闭启动检查或再次打开确认提示。无需GitHub Token。

首次需要手动安装v0.29.6或更新版本一次。Mac当前本地签名版和Windows便携版在用户确认下载、校验完成后提供安装入口，**安装仍需用户确认并手动完成**；Windows安装版和标准签名Mac版则在确认后保存宠物并更新重启。关闭窗口只是收进托盘，恢复时的检查有5分钟间隔；启动检查偏好会保存。兼容版按32/64位使用独立更新渠道。尚未升级的旧版本仍使用原有更新逻辑，首次可手动安装本版。详见[逐步更新流程与平台区别](docs/UPDATES.md)。

## 安装

Windows按上表选择常规版或兼容版；ZIP完整解压后打开「拉姆.exe」或「拉姆兼容版.exe」。跨版切换先导出、导入宠物JSON存档。[兼容范围及测试说明](docs/WINDOWS.md)。Mac选择M系列的arm64或Intel的x64版本，将应用拖入Applications；最低macOS12。Apple签名与公证状态见发布页顶部，首次打开说明见 [Mac使用指引](docs/MACOS.md)，安装盘及发布附件也提供独立HTML说明。无需关闭系统安全保护。

## 开发与检查

```sh
npm ci
npm run dev
npm test
npm run test:browser
npm run test:desktop:cloud
```

Windows安装器点击「完成」先立即收起安装向导，再启动程序；首次领养不加载完整装扮动作表。

桌面回归覆盖五阶段弹性拖动、四类照料、延后增益提示、小窗尺寸、单击照料、真实系统鼠标拖动、四边吸附、置顶/穿透、小屋功能和对话服务清理。GitHub Actions分别构建Windows常规x64、兼容x64、兼容ia32、Apple芯片Mac与Intel Mac并启动成品，全部通过后才发布十个下载包及校验文件。Windows7/8实机验证范围见兼容说明。Windows构建还实际安装到临时目录，点击「完成」并检查向导关闭和新安装程序启动。
