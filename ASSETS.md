# 拉姆陪伴素材记录

已发布的 [v0.3.0](https://github.com/Vinci-217/mole-baby/releases/tag/v0.3.0) 中，角色、小屋、照料道具和界面图片采用《摩尔庄园》原页游客户端的素材导出，该版本的背景、按钮、图标和状态条没有使用图片模型重绘。v0.3.0 已在 GitHub Actions Windows 运行器完成构建、产物校验和应用启动检查，可先下载试用。

v0.4.0 重构小尺寸桌面交互，并从原 SWF 补齐真正种子盆栽与嵌套身体动画。房间为参考原画风生成的晨光背景，由独立“进入小屋”按钮打开。新增图片、原客户端导出与合成音频分别记录。

项目是个人学习用途的非官方桌面改编；桌面陪伴、专注提醒、成长数值、离线变化、小游戏和奖励规则由本项目实现，不等同于原页游的全部功能或数值。

## 下一版生成背景

| 本地文件 | 用途 | 来源 |
| --- | --- | --- |
| `public/assets/generated/morning-study.png` | 晨光树洞书桌，新版房间背景 | 通过 `image_gen` 图片工具参考原页游画法生成并修订的新图，非原客户端导出 |
| `public/assets/generated/generation-record.json` | 本次生成与参考记录 | 记录实际参考、提示词、生成及修订过程 |

生成流程见 [mole-classic-art skill](skills/mole-classic-art/SKILL.md)，画法分析见 [style-guide.md](skills/mole-classic-art/references/style-guide.md)，可复用模板见 [prompt-templates.md](skills/mole-classic-art/references/prompt-templates.md)。它从原图提炼轮廓、色面、勾线、透视和场景留白，通过图片参考引导生成，不涉及专用模型训练，也不表示获得官方授权。

本次背景采用新的树洞书桌构图，背景不预画拉姆、按钮或文字；原拉姆动画由应用独立叠加。最终图、参考路径与生成过程以 [generation-record.json](public/assets/generated/generation-record.json) 为准。下一版实际界面预览见 [v4-home.png](artifacts/v4-home.png)。

## 原客户端素材总览

原客户端背景、道具和 UI 来自社区存档 [Miigon/RecMoleRes](https://github.com/Miigon/RecMoleRes)，固定提交为 `7a6d6b3c7037a85afb28ad6abd4d7f4adfddb5ff`。该仓库的 README 说明“本仓库存储了 RecMole 所用到的官方资源文件”；这是官方客户端美术的社区存档，不表示该 GitHub 仓库由游戏发行方运营。原拉姆动作图集来自下文列出的另一份公开导出记录。

| 本地文件 | 用途 | 来源 |
| --- | --- | --- |
| `public/assets/classic/junior-neutral.png`、`junior-mask.png` | 初级拉姆原帧与身体配色遮罩 | `mli55/taomi-codex-pets` 的原 SWF 导出 |
| `public/assets/classic/middle-neutral.png`、`middle-mask.png` | 中级拉姆原帧与身体配色遮罩 | 同上 |
| `public/assets/classic/senior-neutral.png`、`senior-mask.png` | 高级拉姆原帧与身体配色遮罩 | 同上 |
| `public/assets/original/pets/` | 原版角色静态回退 | 从同源拉姆动作图集中选取帧，未重画角色 |
| `public/favicon.png` | 网页与窗口图标 | 从同源中级红色拉姆图集选取的原帧 |
| `public/assets/original/scenes/` | 拉姆小屋与另外两间原版房型 | `root/resource/goods/swf/{ID}.swf` 的原始 Sprite |
| `public/assets/original/items/` | 食物、饮品、清洁用品和玩具 | `root/resource/pet/icon/{ID}.swf`；名称对照同提交的 `petfood.xml` |
| `public/assets/original/ui/` | 金橙色面板、按钮、状态条、工具栏与图标 | `root/module/petUI/petUI.swf`、`root/resource/ui/ui.swf` 等原始控件 |

## 原页游角色

上游项目：[mli55/taomi-codex-pets](https://github.com/mli55/taomi-codex-pets)。原资源、导出方式与处理说明见其 [SOURCES.md](https://github.com/mli55/taomi-codex-pets/blob/main/SOURCES.md)。本地保留了对应的 [SOURCE-RECORD.md](public/assets/classic/SOURCE-RECORD.md)，其中也包含上游其他形态和赛尔号角色的记录；本项目实际采用的是上述三种普通拉姆图集。

按上游记录，基础成长形态来自原页游资源：

- 文件：`lamubone.swf`
- 原资源 URL：`http://mole.61.com/resource/NPC/lamubone.swf`
- 原文件 SHA-256：`01abf65f3e8db098068a830268bd7a7cefefc1edc93a44565788783d23f8a0cf`
- 原标签：`level2` → 初级，`level3` → 中级，`level4` → 高级。

上面的 SWF 校验值来自上游来源记录；本项目读取导出的 PNG，不运行 Flash 客户端。每张图集为 1536 × 1872 像素，以 192 × 208 像素单元格排列成 8 列、9 行，包含选取后的动作帧。

本地资料：

- [ram-level-source-files.json](public/assets/classic/ram-level-source-files.json)：源 SWF、校验值、原始标签与 sprite ID。
- [ram-level-animation-sources.json](public/assets/classic/ram-level-animation-sources.json)：动作与导出帧来源。
- [palette.json](public/assets/classic/palette.json)：原客户端配色表。
- [checksums.json](public/assets/classic/checksums.json)：本地保留的原版素材和来源文件 SHA-256。

`Ram.tsx` 使用 Canvas 读取 neutral 图集与三通道遮罩，按原 Flash 的加法颜色变换给身体配色，保留叶片与眼睛。界面开放以下四种颜色：

| 颜色 | 原游戏颜色 ID | 色板值 | RGB 加数 |
| --- | ---: | --- | --- |
| 粉红色 | 4 | `#ff6bff` | `51, -148, 0` |
| 黄色 | 2 | `#ffea00` | `0, -21, -255` |
| 天蓝色 | 3 | `#28c6ff` | `-215, -57, 31` |
| 红色 | 1 | `#ff3805` | `255, -199, -250` |

色板值对应白色身体基底经过变换后的颜色，阴影按各自灰阶计算。初级为无叶幼体，中级为两叶，高级为扇叶。v0.4.0 种子期使用真正 `level1`：固定草盆 sprite 4 与身体 39→38→37 的 61 帧原动画分层显示，详见下节。种子保留原白色胚胎；所选身体颜色在初级起显示。

待机、走动、互动和清洁等状态映射到已有的原图动作行，播放节奏由本应用控制。休息采用对应形态的等待姿势并显示 `z` 标记；中级图集没有独立闭眼睡眠帧。这些适配保留原图形象，同时服务于桌面操作，没有恢复完整 Flash 嵌套时间轴。

静态回退文件位于 `public/assets/original/pets/{junior,middle,senior}-{pink,yellow,blue,red}-idle.png`，共 12 张，每张 192 × 208。它们从同源 `neutral` 图集第 0 行、第 0 列提取，用同一套三层颜色变换得到四种原配色，不缩放、不重画。逐文件来源与处理记录见 [pets/source-record.json](public/assets/original/pets/source-record.json)。窗口图标 `public/favicon.png` 来自 `middle-red-idle.png`，裁出非透明像素边界后加入透明留白，尺寸为 183 × 183；没有使用同人高清重绘。

## 原版种子期与动作适配

[seed/source.json](public/assets/original/seed/source.json) 记录同一 `lamubone.swf` 原始哈希、根 sprite 2526 的 `level1`/第 2 帧、分层 sprite ID、24 fps 嵌套时间轴及导出参数。

- `seed/pot.png`：原 sprite 4，固定花盆和草丛，动画和拖拽都不改变其位置。
- `seed/body.png`：原 sprite 37 全部 61 帧，96×99 单元格，8 列打包。身体与盆分层，指针轻摇只给身体小角度倾斜。
- `seed/source-motion.gif`：由上述原始层和原帧组装的研究动图，可核对身体原动作。

桌面角色约 100×108 CSS px；动作时钟按 rAF elapsed 采样，不随 React 重渲染重新起播。待机大部分时间固定，间歇眨眼；喂食、清洁、互动一次播完。接果子使用固定正面姿态和 249ms 的原地确认，不循环开心跳跃。完整原动作仍限于已有导出帧，不声称恢复整个 Flash 客户端。

拖拽、轻摇和放手的短叫声由 `src/pet-audio.ts` 通过系统中文语音或本地声道共振合成提供，带节流和音量限制，可在设置关闭；它们不是官方音频。未冒用来源不明的声音文件。

交互参考与实际查看过的资料见 [companion-references.md](research/companion-references.md)。

## 原版房间

[scenes/sources.json](public/assets/original/scenes/sources.json) 按文件记录固定提交的原始 SWF URL、道具编号、Sprite ID、导出倍率、PNG 尺寸和 SHA-256。

| 本地文件 | 原客户端房型 | 原 SWF | Sprite ID | 导出尺寸 |
| --- | --- | --- | ---: | --- |
| `ramu-home.png` | 拉姆小屋，ID `160081` | [160081.swf](https://raw.githubusercontent.com/Miigon/RecMoleRes/7a6d6b3c7037a85afb28ad6abd4d7f4adfddb5ff/root/resource/goods/swf/160081.swf) | 16 | 1981 × 1167 |
| `lake-cabin.png` | 神秘湖木屋，ID `160038` | [160038.swf](https://raw.githubusercontent.com/Miigon/RecMoleRes/7a6d6b3c7037a85afb28ad6abd4d7f4adfddb5ff/root/resource/goods/swf/160038.swf) | 47 | 2698 × 1506 |
| `original-earthen-home.png` | 树洞房，ID `160030`；原房型名称尚未确认 | [160030.swf](https://raw.githubusercontent.com/Miigon/RecMoleRes/7a6d6b3c7037a85afb28ad6abd4d7f4adfddb5ff/root/resource/goods/swf/160030.swf) | 35 | 2278 × 1297 |

“拉姆小屋”和“神秘湖木屋”的名称对照同提交 [JDGoodsXmlData.xml](https://raw.githubusercontent.com/Miigon/RecMoleRes/7a6d6b3c7037a85afb28ad6abd4d7f4adfddb5ff/root/resource/xml/JDGoodsXmlData.xml)，没有根据外观自行改名。v0.3.0 的默认房间使用拉姆小屋的树洞、圆窗、拉姆脸围栏与平台原画；下一版新增背景另见上方生成记录，这些原场景仍保留为素材与画风参考。

房间由 JPEXS Free Flash Decompiler `26.3.0` 以 `-zoom 2 -export sprite` 静态栅格化。导出指定原始 Sprite，不执行 ActionScript，不添加生成纹理或重绘细节。例如：

```sh
java -Djava.awt.headless=true -Duser.home=/tmp/ramu-ffdec -Xmx512m \
  -jar /path/to/ffdec.jar -select 1 -selectid 16 -zoom 2 \
  -export sprite /tmp/ramu-room-export 160081.swf
```

## 原版照料道具

30 张道具 PNG 均来自 `root/resource/pet/icon/{ID}.swf`，固定提交和完整 URL 记录在 [items/sources.json](public/assets/original/items/sources.json)。清单同时记录原 SWF 的 SHA-256、PNG 的 SHA-256 与尺寸。原名称和原数值取自 [petfood.xml](public/assets/original/items/petfood.xml)，其远端来源为 [同提交原 XML](https://raw.githubusercontent.com/Miigon/RecMoleRes/7a6d6b3c7037a85afb28ad6abd4d7f4adfddb5ff/root/resource/xml/petfood.xml)。清单保存原数值用于考据，本应用的实际消耗、奖励、使用条件和成长由应用代码决定。

| 原道具 ID | 原名称 | PNG |
| --- | --- | --- |
| 180001 | 巧克力豆 | `180001.png` |
| 180002 | 麦香牛奶 | `180002.png` |
| 180003 | 泡泡浴 | `180003.png` |
| 180004 | 运动足球 | `180004.png` |
| 180005 | 万能药水 | `180005.png` |
| 180007 | 青叶粽子 | `180007.png` |
| 180008 | 浆果果汁 | `180008.png` |
| 180009 | 青苹果洗面奶 | `180009.png` |
| 180010 | 冰镇西瓜 | `180010.png` |
| 180014 | 运动可乐 | `180014.png` |
| 180017 | 熊熊饼干 | `180017.png` |
| 180018 | 摩香汉堡 | `180018.png` |
| 180019 | 水晶蛋糕 | `180019.png` |
| 180020 | 火腿三明治 | `180020.png` |
| 180021 | 兔兔胡萝卜汁 | `180021.png` |
| 180022 | 清爽沐浴露 | `180022.png` |
| 180023 | 魔法弹簧 | `180023.png` |
| 180024 | 喜刷刷牙膏 | `180024.png` |
| 180025 | 跳跳布丁 | `180025.png` |
| 180027 | 可可果 | `180027.png` |
| 180028 | 咕咕果 | `180028.png` |
| 180029 | 爽爽果 | `180029.png` |
| 180030 | 开心果 | `180030.png` |
| 180043 | 苹果派 | `180043.png` |
| 180044 | 草莓派 | `180044.png` |
| 180045 | 拉姆小馒头 | `180045.png` |
| 180047 | 热狗 | `180047.png` |
| 180070 | 云朵面包 | `180070.png` |
| 180071 | 拉姆能量星 | `180071.png` |
| 180073 | 优质牛奶 | `180073.png` |

导出工具同为 JPEXS `26.3.0`：按原 SWF 首帧以 3 倍比例输出透明 PNG，仅裁去外部透明边距。`180004` 运动足球的原舞台会截掉右边缘，因此直接导出原 `DefineShape` 的 character ID `1`，保留完整原图；该例外在清单的 `export_override` 中记录。道具没有经过模型生成或外观重画。

## 原版 UI 与按钮

[ui/manifest.json](public/assets/original/ui/manifest.json) 记录各 PNG 对应的原 SWF、character ID、控件状态、导出比例、尺寸和校验值；[ui/SOURCES.md](public/assets/original/ui/SOURCES.md) 记录固定提交的完整源 URL、原面板对照与导出说明。

主要使用以下两份原客户端资源：

- [petUI.swf](https://raw.githubusercontent.com/Miigon/RecMoleRes/7a6d6b3c7037a85afb28ad6abd4d7f4adfddb5ff/root/module/petUI/petUI.swf)：拉姆照料面板、道具格、金橙色边框、按钮、关闭控件、状态条和照料图标。
- [ui.swf](https://raw.githubusercontent.com/Miigon/RecMoleRes/7a6d6b3c7037a85afb28ad6abd4d7f4adfddb5ff/root/resource/ui/ui.swf)：原工具栏、原拉姆资料面板与公共 UI 元件。

另有通用对话框、气泡等取自 [index.swf](https://raw.githubusercontent.com/Miigon/RecMoleRes/7a6d6b3c7037a85afb28ad6abd4d7f4adfddb5ff/root/resource/ui/index.swf)；每个实际文件的来源以清单为准。完整原界面参考图 `reference-pet-panel.png` 与 `reference-classic-pet-panel.png` 一并保留，用于比对原版配色、轮廓和控件比例。

JPEXS 将原始 `DefineShape`、`DefineSprite` 或 `DefineButton` 静态渲染为透明 PNG：通常使用 2 倍比例，工具栏按钮使用 3 倍比例，并保留普通、悬停、按下状态。应用以 HTML/CSS 重排这些原控件，布局与新增标签服务于桌面使用，不声称逐像素恢复原 Flash 页面的全部交互。本节所列 PNG 为原素材导出，不是生成图；后续原创控件如接入，会另记生成来源。

## 权益说明

本项目为个人学习用途的非官方同人桌宠。拉姆角色、名称及原客户端美术权益归《摩尔庄园》原权利方所有；社区存档和本项目的导出、适配不改变这些权益归属，也不表示获得官方授权或由官方维护。本项目不恢复官方账号、服务器、交易或联网社交功能。

小游戏另使用原拉姆学院地图背景：`public/assets/original/scenes/ramu-school.png`（2033×1245），来自同一固定提交的 `root/resource/map/28.swf`，sprite 64，2 倍导出；详见同目录 [ramu-school-source.json](public/assets/original/scenes/ramu-school-source.json)。

## v0.5 小屋音乐、背景选择与合成音效

小屋新增四种可持久化选择的背景：已有生成图 `generated/morning-study.png`，以及原客户端导出 `original/scenes/ramu-home.png`、`lake-cabin.png`、`original-earthen-home.png`。生成图与原图的来源分类沿用上文。

新增三首直接保存原字节的原页游配乐，固定取自同一 RecMoleRes 提交 `7a6d6b3c7037a85afb28ad6abd4d7f4adfddb5ff`：`audio/castle.mp3` ← `BGM_001g.mp3`（摩尔城堡）、`audio/pet-shop.mp3` ← `BGM_002.mp3`（宠物店等室内场景）、`audio/mystery-lake.mp3` ← `BGM_017b.mp3`（神秘湖）。名称对照随包保存的原 `audio/map-sounds.xml`，完整 URL、尺寸、哈希见 [audio/sources.json](public/assets/original/audio/sources.json)。文件随安装包保存，可离线播放；没有声称这三首原本属于本项目房间。

本次未找到能确认身份的原版拉姆说话、吃饭录音。`src/pet-audio.ts` 的叫声、咀嚼、喝水、泡泡、呼吸、唤醒等声效为本地程序合成，不标记为原版录音。查找过程、实际证据及声音设计见 [audio-sources.md](research/audio-sources.md)。用户还可自行选择并在本机保存一份音乐文件，支持重启恢复与删除；该用户文件不属于仓库素材。

## v0.5 四色种子与原照料动作

种子继续使用原 `lamubone.swf` 的独立身体和花盆；新增 `seed/body-mask.png` 只标记原身体灰阶覆盖率，运行时应用已有四种颜色偏移，眼白、瞳孔、叶片和花盆保持原色。种子延续领养配色是用户要求的桌宠适配，不声称原版白色胚胎本来就有四色。闭眼采用原 sprite 37 第 5 帧。探针方法、原文件哈希和新增遮罩哈希见 [seed/source.json](public/assets/original/seed/source.json)。

新增 [care](public/assets/original/care/README.md) 六张原素材图集（三级各一张 neutral 与 mask）：16 列 × 7 行、单格 192×208。使用原标签 `food`、`drenk`、`wash`、`medical`、`thirst`、`hungry`、`boring` 的短连续片段，没有重绘角色。原源帧、固定配准、裁切与每张 PNG 的 SHA-256 见 [care/source.json](public/assets/original/care/source.json)。显示速度和状态映射为桌宠适配；`boring` 未冒称为原版疾病或睡眠动作。成长形态睡眠另选已有原 `happy` 闭眼帧，叠加轻呼吸。

用品种类、名字、原属性、原非零售价与本地活动品定价区分见 [items-states.md](research/items-states.md)。商店只展示已经有对应原 PNG 的 28 种用品；没有以可可果图案代替饮品、清洁用品。
