# 拉姆 · mole-baby

> **动画研究预览，尚未发布。** 本分支效果等待用户审阅；当前正式版为 [v0.29.1](https://github.com/Vinci-217/mole-baby/releases/tag/v0.29.1)。未经用户明确确认，不推送新版本到自动更新渠道。

## 本轮动作预览（待确认）

角色采用原版完整动作帧；手动拖拽、手掌、网与蝴蝶的编排是桌宠适配。修订只保存在预览分支，尚未发布。原帧交互方案仍单独审阅；睡眠与界面修复已写入预览源码；你认可的足球素材与播放代码未修改。

**初级 / 中级：原版左右移动与手动拖拽对照**

左边是原版侧向移动，右边是拖起来、换方向、松手归位。保留原来的侧脸、身体和叶片变化，初级、中级只沿水平方向拖动和换向，没有额外上下抬升、松手弹跳。鼠标抓取点约束身体位置。

![初级中级移动与手动拖拽对照](artifacts/v30-preview/move.gif)

**五阶段手动拖拽**

![五阶段原帧拖拽预览](artifacts/v30-preview/drag.gif)

**追蝴蝶：原著追虫动作与桌宠适配对照**

中级原版217帧追虫动作作为身体参考；蝴蝶绕网、躲开，拉姆回头继续追看。没有新增捕捉奖励或游戏数值。

![原著追虫与追蝴蝶适配对照](artifacts/v30-preview/butterfly.gif)

**摸摸：五阶段回应**

手掌接近、轻抚、离开。种子花盆保持端正；神力超拉改用正常小脸的悬浮帧，收小幅度，不再使用大嘴大笑和大幅翻转。

![五阶段摸摸原帧预览](artifacts/v30-preview/pet.gif)

[本轮修复与验证](research/v31-animation-review.md) · [参考来源、适配范围和验证](research/v30-motion-previews.md) · [清晰移动视频](artifacts/v30-preview/move.webm) · [追蝶视频](artifacts/v30-preview/butterfly.webm) · [摸摸视频](artifacts/v30-preview/pet.webm)

## 全部动作 GIF 目录（预览源码，未发布）

下面使用实际应用的角色组件、道具、服饰和动作时钟录制，均为24fps。点击分类展开；这里展示现有动作，也方便继续指出需要重做的地方。上面的原帧拖拽、追蝶与摸摸是另行审阅的交互方案，不能当作已发版效果。

<details open>
<summary>睡前哈欠 → 安睡 → ZZZ，及醒来、困倦</summary>

![睡前哈欠 → 安睡 → ZZZ，及醒来、困倦](artifacts/animation-gallery/sleep.gif)

</details>

<details>
<summary>摸摸、专注翻书、挥网逗蝴蝶</summary>

![摸摸、专注翻书、挥网逗蝴蝶](artifacts/animation-gallery/interaction.gif)

</details>

<details>
<summary>陪伴、左右移动、张望与招呼</summary>

![陪伴、左右移动、张望与招呼](artifacts/animation-gallery/movement.gif)

</details>

<details>
<summary>开心、接到物品、奖励与失落</summary>

![开心、接到物品、奖励与失落](artifacts/animation-gallery/reactions.gif)

</details>

<details>
<summary>开心、闷闷不乐、安心、眩晕</summary>

![开心、闷闷不乐、安心、眩晕](artifacts/animation-gallery/moods.gif)

</details>

<details>
<summary>饥饿、口渴、清洁、病态、疲倦与难过</summary>

![饥饿、口渴、清洁、病态、疲倦与难过](artifacts/animation-gallery/conditions.gif)

</details>

<details>
<summary>自己看书、完整足球、顶书练习与魔法变装</summary>

![自己看书、完整足球、顶书练习与魔法变装](artifacts/animation-gallery/pastimes.gif)

</details>

<details>
<summary>左、右、上、下：走入、藏好与探头</summary>

![左、右、上、下：走入、藏好与探头](artifacts/animation-gallery/edges.gif)

</details>

<details>
<summary>全部消耗用品（1/2）</summary>

![全部消耗用品（1/2）](artifacts/animation-gallery/items1.gif)

</details>

<details>
<summary>全部消耗用品（2/2）</summary>

![全部消耗用品（2/2）](artifacts/animation-gallery/items2.gif)

</details>

<details>
<summary>九件装扮在不同动作中的表现</summary>

![九件装扮在不同动作中的表现](artifacts/animation-gallery/wardrobe.gif)

</details>

<details>
<summary>四种最高形态：摸摸、睡眠与左右飞行</summary>

![四种最高形态：摸摸、睡眠与左右飞行](artifacts/animation-gallery/evolutions.gif)

</details>

<details>
<summary>四种颜色、五个阶段的哈欠与安睡</summary>

![四种颜色、五个阶段的哈欠与安睡](artifacts/animation-gallery/colours.gif)

</details>

走入/探头GIF展示动作层；实际屏幕边缘还由原生窗口控制。相同类别用品共用一套动作，图案与换色效果分别展示。没有独立动作的别名、出游机制及录制方法见[动作说明](research/v31-animation-review.md)。

**气泡修复：** 上移避免挡脸，到时彻底移除；小屋底部重复提示框已删除。

![气泡与角色留出空间](artifacts/animation-gallery/speech-fixed.png)

---

一只住在 Windows 或 macOS 桌面的拉姆。可以拖动、摸摸、玩球、喂养，看着它从种子慢慢长大。

[下载正式版 v0.29.1](https://github.com/Vinci-217/mole-baby/releases/tag/v0.29.1) · [构建记录](https://github.com/Vinci-217/mole-baby/actions/workflows/windows-build.yml)

## 直接下载与安装

| 你的电脑 | 推荐安装包 |
| --- | --- |
| Windows 10 / 11（64 位） | [下载 Windows 安装版](https://github.com/Vinci-217/mole-baby/releases/download/v0.29.1/mole-baby-0.29.1-Setup.exe) |
| Mac · Apple 芯片（M 系列） | [下载 Apple 芯片 Mac 版](https://github.com/Vinci-217/mole-baby/releases/download/v0.29.1/mole-baby-0.29.1-mac-arm64.dmg) |
| Mac · Intel 芯片 | [下载 Intel Mac 版](https://github.com/Vinci-217/mole-baby/releases/download/v0.29.1/mole-baby-0.29.1-mac-x64.dmg) |

无需登录 GitHub。Mac 在苹果菜单 →「关于本机」查看芯片，需要 macOS 12 或更新版本。Windows 下载后双击安装；Mac 打开 DMG 后拖入「应用程序」。[详细安装、更新与 Mac 首次打开指引](https://github.com/Vinci-217/mole-baby/releases/tag/v0.29.1)放在发布页最上方。

## 小小的桌面陪伴

角色保持约100×108px，鼠标移上来显示 **用品、玩耍、计时、小屋**。背包是 **212×216px** 的小侧窗，4×4正方形格，选择食物、饮品、清洁或药水后，**单击物品即刻使用**，库存和实际数值立即更新；食物落盘后逐口吃完，饮品换成小奶瓶吸饮后丢开，清洁统一为泡泡、冲洗、闪亮。动作结束后，实际增益提示缓缓淡出；快速连用会合并尚未展示的增益。没有二次确认或等待领取。

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

小屋每日签到可领取1000摩尔豆。拉姆会自己翻书、玩球、顶书练平衡，中级以后还会练习魔法变装；出游有归期，可以随时叫回来，经历会进入回忆。自然活动与出游均可在设置关闭，专注计时和安静偏好优先。

[本版画面、实际录屏与实现范围](research/v27-elastic-care.md) · [上版日常活动](research/v26-lively-pet.md)

## 自动更新

默认开启「启动时自动更新」：Windows和Mac每次完全启动约8秒后检查GitHub的最新公开正式版，有新版才后台下载和校验。Windows安装版在桌宠空闲、存档成功后静默安装并重启，正在游戏、专注、拖动、照料或操作小屋时先等待。小屋设置可查看版本和进度、关闭自动更新或手动重试，托盘也能检查/立即更新。无需GitHub Token。

首次需要手动安装v0.29.1或更新版本一次。Mac当前本地签名版自动检查、校验和下载安装包，随后提供安装入口，**安装仍需手动完成**；已配置Apple签名公证的构建支持标准自动安装。Windows便携版也会提供安装入口，安装后支持后续自动更新。关闭窗口只是收进托盘，恢复时的自动检查有5分钟间隔；在设置关闭自动更新会保存偏好。**预览分支和README提交不会触发客户端更新，本轮没有发版。**详见[逐步更新流程与平台区别](docs/UPDATES.md)。

## 安装

Windows运行 `mole-baby-0.29.1-Setup.exe`，或完整解压ZIP后打开「拉姆.exe」。Mac选择M系列的arm64或Intel的x64版本，将应用拖入Applications；最低macOS12。Apple签名与公证状态见发布页顶部，首次打开说明见 [Mac使用指引](docs/MACOS.md)，安装盘及发布附件也提供独立HTML说明。无需关闭系统安全保护。

## 开发与检查

```sh
npm ci
npm run dev
npm test
npm run test:browser
npm run test:desktop:cloud
```

Windows安装器点击「完成」先立即收起安装向导，再启动程序；首次领养不加载完整装扮动作表。

桌面回归覆盖五阶段弹性拖动、四类照料、延后增益提示、小窗尺寸、单击照料、真实系统鼠标拖动、四边吸附、置顶/穿透、小屋功能和对话服务清理。GitHub Actions在Windows、Apple芯片Mac与Intel Mac打包并启动成品，全部通过后才发布安装包与校验文件。Windows构建还实际安装到临时目录，点击「完成」并检查向导关闭和新安装程序启动。
