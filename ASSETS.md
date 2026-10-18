# 拉姆陪伴 v0.3 素材记录

角色、小屋、照料道具和界面图片采用《摩尔庄园》原页游客户端的素材导出。本轮背景、按钮、图标和状态条没有使用图片模型重绘。项目是个人学习用途的非官方桌面改编；桌面陪伴、专注提醒、成长数值、离线变化、小游戏和奖励规则由本项目实现，不等同于原页游的全部功能或数值。

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

色板值对应白色身体基底经过变换后的颜色，阴影按各自灰阶计算。初级为无叶幼体，中级为两叶，高级为扇叶。桌宠的种子期复用初级原帧；目前没有单独提取的官方种子期图集，也不把自制花盆当作官方形态。

待机、走动、互动和清洁等状态映射到已有的原图动作行，播放节奏由本应用控制。休息采用对应形态的等待姿势并显示 `z` 标记；中级图集没有独立闭眼睡眠帧。这些适配保留原图形象，同时服务于桌面操作，没有恢复完整 Flash 嵌套时间轴。

静态回退文件位于 `public/assets/original/pets/{junior,middle,senior}-{pink,yellow,blue,red}-idle.png`，共 12 张，每张 192 × 208。它们从同源 `neutral` 图集第 0 行、第 0 列提取，用同一套三层颜色变换得到四种原配色，不缩放、不重画。逐文件来源与处理记录见 [pets/source-record.json](public/assets/original/pets/source-record.json)。窗口图标 `public/favicon.png` 来自 `middle-red-idle.png`，裁出非透明像素边界后加入透明留白，尺寸为 183 × 183；没有使用同人高清重绘。

## 原版房间

[scenes/sources.json](public/assets/original/scenes/sources.json) 按文件记录固定提交的原始 SWF URL、道具编号、Sprite ID、导出倍率、PNG 尺寸和 SHA-256。

| 本地文件 | 原客户端房型 | 原 SWF | Sprite ID | 导出尺寸 |
| --- | --- | --- | ---: | --- |
| `ramu-home.png` | 拉姆小屋，ID `160081` | [160081.swf](https://raw.githubusercontent.com/Miigon/RecMoleRes/7a6d6b3c7037a85afb28ad6abd4d7f4adfddb5ff/root/resource/goods/swf/160081.swf) | 16 | 1981 × 1167 |
| `lake-cabin.png` | 神秘湖木屋，ID `160038` | [160038.swf](https://raw.githubusercontent.com/Miigon/RecMoleRes/7a6d6b3c7037a85afb28ad6abd4d7f4adfddb5ff/root/resource/goods/swf/160038.swf) | 47 | 2698 × 1506 |
| `original-earthen-home.png` | 树洞房，ID `160030`；原房型名称尚未确认 | [160030.swf](https://raw.githubusercontent.com/Miigon/RecMoleRes/7a6d6b3c7037a85afb28ad6abd4d7f4adfddb5ff/root/resource/goods/swf/160030.swf) | 35 | 2278 × 1297 |

“拉姆小屋”和“神秘湖木屋”的名称对照同提交 [JDGoodsXmlData.xml](https://raw.githubusercontent.com/Miigon/RecMoleRes/7a6d6b3c7037a85afb28ad6abd4d7f4adfddb5ff/root/resource/xml/JDGoodsXmlData.xml)，没有根据外观自行改名。默认房间使用拉姆小屋的树洞、圆窗、拉姆脸围栏与平台原画。

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

JPEXS 将原始 `DefineShape`、`DefineSprite` 或 `DefineButton` 静态渲染为透明 PNG：通常使用 2 倍比例，工具栏按钮使用 3 倍比例，并保留普通、悬停、按下状态。应用以 HTML/CSS 重排这些原控件，布局与新增标签服务于桌面使用，不声称逐像素恢复原 Flash 页面的全部交互。UI 图像没有改成生成木纹、欧美绘本纹理或另一套角色画风。

## 权益说明

本项目为个人学习用途的非官方同人桌宠。拉姆角色、名称及原客户端美术权益归《摩尔庄园》原权利方所有；社区存档和本项目的导出、适配不改变这些权益归属，也不表示获得官方授权或由官方维护。本项目不恢复官方账号、服务器、交易或联网社交功能。

小游戏另使用原拉姆学院地图背景：`public/assets/original/scenes/ramu-school.png`（2033×1245），来自同一固定提交的 `root/resource/map/28.swf`，sprite 64，2 倍导出；详见同目录 [ramu-school-source.json](public/assets/original/scenes/ramu-school-source.json)。
