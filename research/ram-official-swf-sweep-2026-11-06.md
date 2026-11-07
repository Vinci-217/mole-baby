# 官方拉姆 SWF 扫描

本轮目标是把当前还能从页游官方地址获取的拉姆相关 SWF 找出来，保存在 `local-assets/ram-official-sweep/2026-11-06/`。这是素材调查和本地归档，不改固定 `local-assets/raw/`，不进入安装包，不连接玩家账号，不改存档。

## 来源与方法

- 官方基址：`https://mole.61.com/`。
- 读取本地固定客户端存档中的 `ClientConfigDLL.swf` 物品配置、`ClientAppDLL.swf`／模块中的 AS 字面量资源路径，以及 `ClientConfigDLL.swf` 的 ABC 字符串池。
- 对资源族使用客户端代码中明确的有限参数：`petcloth/swf2` 装扮编号、`pet5`／`pet101` 技能、课堂 `pet*Movie` 的成长等级、`pet/swf/pet{level}/tuya1..4.swf` 涂鸦动作、课堂 class/happy/honer 动作、`1208000..1208017` 神力技能。
- 从官方 `version/zzz_config.txt` 读取索引版本，取得 `version/version1452075536.swf`。这是版本数据包，不是视觉动画：8 字节头后 zlib 解压，包含 57,833 对路径哈希和修改时间。按原客户端 `TaomeeVersionManager.hashFileName` 的 SDBM／31 位规则核对 28 个已知拉姆资源族，共有 828 条匹配，其中 7 条是上述配置／旧库发现方式未列出的候选。哈希可能碰撞，全部仍通过官方 HTTP 和 SWF 解析验证。
- 对临时超时做有限重试；最后一次对索引中已知路径使用原客户端的正常版本查询参数：`base36(modifiedUnix * 1000)`。最终所有路径都有成功或 HTTP 404 回执，没有待定超时；不把索引有记录当成文件仍然存在。
- 每个官方地址只允许重定向回 `mole.61.com`，单文件下载上限 24 MiB。读取后验证 SWF 头和时间轴；记录 HTTP 状态、Content-Type、Last-Modified、ETag、字节数、SHA-256、帧率、根帧数、带动作的时间轴数量、标签和符号名。
- 404、超时和格式错误保留在 `receipts.jsonl`，不从“未取得”清单删除。这样不会把历史资源误报为当前仍在线。

## 文件

| 文件 | 作用 |
| --- | --- |
| `candidates.json` | 扫描发现的候选路径、分类、名字和发现依据 |
| `receipts.jsonl` | 每个路径的逐项官方请求回执 |
| `catalog.json` | 可直接供本地浏览页使用的汇总清单 |
| `catalog.csv` | 便于筛选和二次分析的表格 |
| `index.html` | 本地可搜索素材库 |
| `files/` | 已确认官方可访问的 SWF 原件，按官方相对路径保存 |
| `timelines/` | 与原件对应的本地时间轴元数据 |
| `bootstrap/` | 本轮请求到的官方客户端入口和 DLL，仅供版本／路径调查 |
| `client-refs.txt` | 已导出客户端源码中的拉姆资源引用 |
| `items.json` | 当前和固定配置中拉姆装扮／宠物物品记录 |
| `version-index-audit.json` | 28 个资源族的枚举范围、版本索引匹配与补发现路径 |
| `SHA256SUMS` | 每个已取得原件的 SHA-256，解压后可直接复核 |
| `verification.json` | 对全部原件重新读取、哈希、解析和时间轴匹配的复核结果 |
| `ram-official-swfs.zip` | 已取得 SWF、时间轴、浏览页和清单的压缩包，保留目录结构 |

## 分类边界

`装扮／变身动作` 是可作为拉姆形态或服装动作研究的资源；`课堂／学习动作`、`神力／魔法`、`道具互动动作` 是原客户端调用的拉姆相关片段；`旧版装扮图层` 和 `图标` 不能直接当成完整角色动画；`场景／剧情` 可能含拉姆，但需按场景脚本继续定位。一个 SWF 可能是分层片段，不能仅凭帧数称作完整官方动作。

`1200026.swf` Ebook 已在上一轮单独逐帧录制。本轮清单会再次记录它的官方来源，但不重复把之前的导出称为新动画。

## 复现

```sh
python3 scripts/client-library/collect_ram_official.py discover
python3 scripts/client-library/collect_ram_official.py download --workers 4
python3 scripts/client-library/collect_ram_official.py retry --versioned --workers 4
python3 scripts/client-library/build_ram_catalog.py
python3 -m http.server 5187 --bind 0.0.0.0 --directory local-assets/ram-official-sweep/2026-11-06
```

官方 SWF 和配置属于淘米等原权利方；公开可访问不等同于获得任意再分发许可。清单只用于素材研究、保真核对和后续本地复用。

## 本轮结果

本轮共检查 **1873 个候选路径**，其中 **1290 个从官方取得并验证保存**，共 **84,904,178 字节（84.9 MB）**，包含 **1252 种不同字节内容**；**649 个文件**包含多帧时间轴。其余 **583 条路径最终均为 HTTP 404**，全部保留回执；没有未检查或仍超时的条目。候选来自配置展开和客户端引用，不表示每个路径都曾有可用文件。

按用途分类的已保存文件：

- 装扮／变身动作：145
- 旧版装扮图层：120
- 技能身体／变身：27
- 课堂／学习动作：109
- 道具互动动作：251
- 拉姆世界变身：30
- 拉姆战斗／技能素材：7
- 角色骨骼／基础动作：1
- 图标：487（单独标明，不能直接当完整角色动作）
- 界面／小游戏模块：43
- 场景／剧情：13
- 其他拉姆相关资源：57

相对固定本地存档，**828 个是新路径**，另有 **2 个已有路径的官方字节不同**（`resource/map/304.swf` 和 `resource/map/308.swf`）。新文件保存在独立目录，没有覆盖固定库原件。官方地址仍可能随运营变更；清单是本轮扫描时点的可复核结果。

魔法书：`resource/petcloth/swf2/1200026.swf`；端盘／空手服务员：`1200042.swf`／`1200043.swf`；基本形态与方向骨骼：`resource/NPC/lamubone.swf`。这些原件可以按编号、物品名称或动作标签在浏览页搜索。服装需要结合身体、配色和原客户端事件组合，尚未把本轮全部 SWF 渲染成 GIF，也不宣称所有片段都能独立播放为完整动作。

文件包校验：1290 个原件的长度和 SHA-256 全部匹配，全部可再次解析，缓存时间轴与重新解析结果逐项一致；ZIP CRC 检查通过。新清单与原库关联方式见 `docs/LOCAL-ASSET-LIBRARY.md`。

浏览页检查：名称搜索“魔法书”有4条结果，编号1200026有3条；课堂分类109条、未取得分类583条，翻页和详情可用，原件／时间轴／CSV请求成功，ZIP返回200且长度匹配。393px和320px视口没有整页横向溢出，分类栏可横向滑动，页面JavaScript错误为0。回执见补录目录的 `browser-verification.json`。

## 2026-11-07：网页内动画播放

增加逐项“预览”入口，使用本地固定的 Ruffle 0.7.1 播放器和单独编译的 `preview-harness.swf`。可选原始画面或导出节点，切换原件支持的成长形态、方向和站立／走动状态，暂停、继续、重新播放及等比例缩放。魔法书和服务员按原 `LamuUIManage` 的 `getLamuMC`、`petBone0/1/2` 事件同步；黄色采用原客户端的加法颜色偏移 `(0, -21, -255)`。没有绘制替代动画或插帧，也不覆盖原件。

适配器复用原魔法书的编译容器，但使用独立的同长命名空间 `preview_fla`，避免与实际加载的魔法书类名冲突。各原 SWF 从 `files/` 原路径加载；预览页限制到本地资源，不登录账号。模块依赖缺失、分层片段和不受播放器支持的内容不冒称能完整还原游戏。

检查了魔法书、端盘服务员、道具互动、课堂素材和图标五个来源；两套装扮的8种形态均可显示，检查3个附加方向，截图像素持续变化，暂停后截图像素保持一致。目录内弹窗可打开，关闭即移除播放器；393px／320px手机视口无溢出，页面JavaScript错误为0。回执：`animation-preview-verification.json`。工具：`prepare_ram_preview.py`、`RamPreviewHarness.as`、`ram-preview.html`、`review_ram_preview.cjs`。
