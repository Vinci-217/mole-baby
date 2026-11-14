# 本地原客户端素材库

本库用于复用原客户端的图片、音乐、音效、矢量动画和模块调用记录。素材保存在项目的 `local-assets/`，不进入安装包、Git 提交或用户存档。

## 来源与覆盖范围

- 社区存档：[Miigon/RecMoleRes](https://github.com/Miigon/RecMoleRes/tree/7a6d6b3c7037a85afb28ad6abd4d7f4adfddb5ff)。固定提交 `7a6d6b3c7037a85afb28ad6abd4d7f4adfddb5ff`。
- 完整保存该提交的 21,523 个文件，原件共 1,701,100,697 字节。包括 20,997 个 SWF、159 个独立 MP3、365 个 XML 和两个说明文件。
- 每个原件的长度和 Git blob SHA-1 均与固定提交的完整文件树一致；可再次独立复核。
- 已索引 37,942 条多帧时间轴、1,967 条带动作标签的时间轴；12,673 个源文件包含可导出的脚本或内嵌媒体。
- 这是上述固定存档的全量保存，不代表官方历次版本和所有线上活动的完整集合。缺少的后续资源仍需单独补录来源。

2026-11-05 验收：12,673 个来源全部完成导出，缺失来源、媒体缺项和导出错误均为 0。421,790 张内嵌位图按每个原文件的标签数量核对一致；839 个内嵌二进制逐项匹配原始字节，另保留 15 个已核实相同内容的旧命名副本。导出 607 个有效内嵌音频文件，独立 MP3 原件另有 159 个。文件统计未按内容去重。

238 个来源使用 P-code 回退；已导出高级反编译文本中的 23 处警告分属 3 个模块，均有 P-code 缓存。132 个空音频头单列，不作为可用声音。详细回执见 [client-library-verification.json](../research/client-library-verification.json)。

原素材权利归淘米等原权利方；社区存档和本地提取不改变其权属。不要把公开可访问等同于获得任意再分发许可。

## 查找与复用

运行本地素材库：

```sh
python3 local-assets/server.py --port 5181
```

网页支持按路径、编号、符号名和动作标签检索。例如 `1200042` 是端盘服务员，`1200043` 是空手服务员，`GuestBook` 可查留言板相关资源。点击素材查看原件、时间轴、图片、音频、脚本；点击动作生成 GIF 并缓存。

| 目录或文件 | 内容 |
| --- | --- |
| `raw/` | 固定存档的完整原件，只读使用 |
| `source-tree.json` | 固定 GitHub 树，包含原件长度和 Git blob SHA-1 |
| `source-status.json`、`verification.json` | 导入校验和再次复核结果 |
| `catalog.sqlite` | 文件、符号、标签和格式的搜索索引 |
| `timelines/<源路径>.json` | 帧率、时间轴、标签、符号和放置记录 |
| `extracted/<源路径>/images/` | 内嵌位图及位图动画帧 |
| `extracted/<源路径>/sounds/` | 内嵌 MP3/WAV |
| `extracted/<源路径>/scripts/` | JPEXS 高级 ActionScript 反编译结果 |
| `extracted/<源路径>/pcode/` | 原始 ActionScript 指令，供源码失败时继续分析 |
| `extracted/<源路径>/binaryData/` | 内嵌二进制，以 character ID 命名；完整链接名见索引 |
| `previews/` | 按源文件哈希、sprite 和动作帧区分的 GIF 缓存 |
| `normalized/`、`decoded/` | 特殊封装的派生解析件，不覆盖原件 |
| `demo/` | 餐厅送餐流程的近景和完整场景预览 |
| `export-status.json`、`export-audit.json` | 实际导出进度、文件统计和质量限制 |
| `jobs/`、`retries/` | 可恢复任务、日志和逐文件检查点 |

原动画完整保存在 SWF 矢量时间轴中。不是预先把每个分层片段转换成 GIF：网页最多渲染所选片段的 120 帧，完整动画仍可从原件导出。动作、方向、服装、身体染色和交互必须结合原脚本使用；独立片段可能是灰色、静止或缺少其他实例，这不表示原件丢帧。

应用需要使用素材时，先查本库，找到实际调用和配色规则，再把所需导出放进应用素材目录。裁切、染色和适配另存，注明原路径、sprite、动作标签和适配内容。不要改写 `raw/`。

## 官方拉姆 SWF 补录（2026-11-06）

补录目录：`local-assets/ram-official-sweep/2026-11-06/`。检查官方候选路径 1873 条，保存可验证 SWF 1290 个，共 84.9 MB；其中 828 条路径未在固定库收录，另有两个场景的官方现版字节不同。所有文件独立保存，固定 `raw/` 和 `assets` 索引表保持原样。

后续找拉姆动画时，先同时查这份 `catalog.json`／`catalog.csv`。其中包含魔法书、服务员、其他装扮、课堂、道具互动、魔法／变身、骨骼与相关场景；图标和旧服装图层单列。649 个文件含多帧时间轴，不等于649个完整角色动作。其余583条候选返回404，保留核对记录。

```sh
python3 -m http.server 5187 --bind 0.0.0.0 --directory local-assets/ram-official-sweep/2026-11-06
```

`files/<官方路径>` 是原件，`timelines/<官方路径>.json` 是解析元数据；`catalog.json` 保留官方来源、发现依据、动作标签、物品名和 SHA-256。`SHA256SUMS` 与 `verification.json` 可复核；`ram-official-swfs.zip` 已含原件、时间轴和可搜索网页。无需再次请求官方地址即可研究已保存内容。

2026-11-07 增加网页播放：点击列表“预览”，可以直接查看原 SWF 画面，选择导出角色节点，以及原件实际支持的形态和方向；提供走动／站立、暂停、重新播放和缩放。使用缓存的 Ruffle 0.7.1 和单独的 `preview-harness.swf` 适配原客户端方向／骨骼事件，不改 `files/` 原件。魔法书和端盘服务员已经验证；图层可能只显示局部，依赖完整游戏环境的模块不保证能独立播放。

复现播放环境：先运行 `python3 scripts/client-library/prepare_ram_preview.py`，再运行 `build_ram_catalog.py` 更新包含播放器的 ZIP。准备工具复用 `artifacts/original-reading-runtime/ruffle/` 中固定版本的播放器，JPEXS 编译的只是派生适配器。`preview-source.json` 记录版本、来源哈希和适配内容；Ruffle 许可证随播放器保留。

扫描依据包括官方现版 DLL 配置、旧客户端调用和57,833条路径哈希的官方版本索引；索引匹配后仍需验证实际文件。详细范围、统计与工具命令见 [官方拉姆 SWF 调查](../research/ram-official-swf-sweep-2026-11-06.md)。

## 重建工具与恢复导出

工具源码在 `scripts/client-library/`。环境使用 Python 3 标准库、Java 21、JPEXS 26.4.0、FFmpeg；餐厅渲染还使用项目已有的 Node/sharp。JPEXS 位于 `/opt/jpexs/26.4.0/`。其他环境可调整脚本中的工具路径。

编译本地 Java 工具：

```sh
mkdir -p local-assets/tools
java -m jdk.compiler/com.sun.tools.javac.Main \
  -cp /opt/jpexs/26.4.0/lib/ffdec_lib.jar \
  -d local-assets/tools \
  scripts/client-library/SourceBatch.java \
  scripts/client-library/SpriteProbe.java \
  scripts/art/SourceExporter.java
```

重新验证所有原件、重建索引、分批导出：

```sh
python3 scripts/client-library/library.py verify
python3 scripts/client-library/library.py index
python3 scripts/client-library/export_sources.py --limit 512
python3 scripts/client-library/audit.py
python3 scripts/client-library/inventory_media.py
# 服务启动后验证搜索、缓存、视频与手机布局：
node scripts/client-library/review.cjs
```

`complete.txt` 是逐来源检查点；已完成的来源自动跳过。`--limit 0` 表示处理全部剩余来源。每批最多 32 个来源，默认两个 worker，每批限时 120 秒，避免一个大型模块卡住整个素材库。

已停止的超时批次可单独恢复：

```sh
python3 scripts/client-library/retry_sources.py --finished-batches-only
# 已确认高级源码反编译困难时，直接保留原指令：
python3 scripts/client-library/retry_sources.py --finished-batches-only --pcode-only
# 给已导出的特定来源补存 P-code：
python3 scripts/client-library/retry_sources.py --pcode-only \
  --path root/module/external/MagicalPassPanel.swf
```

不要让两个任务同时写同一个来源。恢复前确认旧任务已退出；并行处理不同集合时，给批量任务传 `--exclude-list <JSON路径列表>`。日志位于独立任务目录。不要仅根据退出码宣称全部源码成功：`audit.py` 会检查缺失来源、反编译错误注释、P-code 回退及空音频头。

`inventory_media.py` 将每个来源的图片数量与原 SWF 位图标签逐项核对，并直接比较所有内嵌二进制的原始字节。早期二进制缓存使用 `characterID_链接名.bin`，当前导出使用 `characterID.bin`；核对时同时识别两者，同内容的旧命名副本单独记录。

`local-assets/index.html` 与 `server.py` 是自包含运行副本；修改网页或服务后从 `scripts/client-library/` 同步对应文件，再重启自己启动的服务。

## 特殊封装与保真限制

- `NewAngelFightModule.swf` 的原文件不是标准 SWF 头；在偏移 29 找到完整 zlib body，派生件使用构造的 FWS v9 头解析出 345 条时间轴。该头是恢复适配，原件未改。
- `root/version/version1452075536.swf` 实际是压缩版本数据包，偏移 8 解压到 `decoded/`，不冒充可视动画。
- 大型混淆模块可能无法还原完整高级源码。保留 SWF 原件和 P-code，并在审计中列出警告；P-code 不等同于原作者源码。
- 个别原声音流导出后只有空 WAV 头，审计单列，不计作可用声音。

## 餐厅闭环预览

```sh
python3 scripts/art/prepare-restaurant-loop.py
node scripts/art/render-restaurant-loop.cjs
```

输出在 `artifacts/restaurant-loop/`。使用原版服务员空手和端盘动作、原客户端 `GV.petColor_3` 身体染色、原餐厅场景和原餐盘。11 秒、24 fps、264 帧，包含等待、去取餐、取餐、送餐、放盘、返回，首尾画面哈希一致。

角色动作与道具来自原件；路线、阶段时长和循环前清台为本地演示编排，不是官方完整游戏录像。详细证据见 [餐厅素材调查](../research/restaurant-original-assets.md) 和 [校验记录](../research/client-library-verification.json)。

### 装扮与互动的运行方式（2026-11-07）

122 件装扮统一运行原版 SWF，含旧衣橱的 12 件。原件不修改；独立控制器只选择成长阶段、朝向、原骨骼事件和原版配色。无对应阶段的衣服使用自身初级原片，种子不穿衣服。11 种玩耍道具免费直接使用，21 种课堂角色动作接入自然动作；魔法保留原片并合并重复阶段版本。

构建只省略已被原 SWF 替代的重复图集，本地研究素材库完整保留。具体行为、存档回归与验证入口见 [本轮记录](../research/free-original-play-and-native-outfits-2026-11-07.md)。
## 大型反编译文本归档（2026-11-12）

为给本地测试安装包腾出空间，1189 份较大的 `.pcode` 导出文本已无损压缩为同目录的 `.pcode.gz`；每份都在删除未压缩副本前解压并校验了 SHA256。原始 SWF、图片、音频、`.as` 源码与玩家数据保留。

索引是 `local-assets/compressed-pcode-20261112.json`，记录原路径、压缩路径、原字节数与摘要。查找时若 `.pcode` 路径不存在，继续检查同名 `.pcode.gz`，用 `gzip -dc <文件.pcode.gz>` 直接读取，或 `gzip -dk <文件.pcode.gz>` 还原。无需重新反编译或下载。

2026-11-13 再归档 31,091 份派生文本，逐份解压核对 SHA256 后释放约 2.6 GB，追加索引在 `local-assets/pcode-archives.jsonl`。素材库网页已支持原 `.pcode` 地址透明解压，审计同时检查压缩与未压缩文本。维护命令与保护范围见 [本地构建与仓库整理](WORKSPACE-MAINTENANCE.md)。
