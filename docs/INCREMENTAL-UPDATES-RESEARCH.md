# 增量更新调研

调研日期：2026-10-29。核对正式版 v0.31.3、当前预览代码、锁定依赖及真实 GitHub 下载地址。本轮只有调研，没有修改更新行为或发布版本。

## 结论

可以实现。Windows 安装版可以接入已有的分块下载能力；当前 Mac 本地签名版需要适配现有 DMG 下载器。不能仅把一个开关打开，就认为 Windows 和 Mac 都已实现增量更新。

建议先验证 Windows 安装包增量和 Mac DMG 增量，再把长期不变的大素材拆成按内容缓存的资源包。这样可以逐步减少重复下载，不必先重写整套更新系统。

## 当前为什么每次下载完整包

1. [更新器](../electron/updates.cjs)把 `disableDifferentialDownload` 明确设为 `true`。正式版 v0.31.3 和当前预览均如此。
2. [发布工作流](../.github/workflows/windows-build.yml)没有收集和上传 `.blockmap`。实际查看 v0.31.3 Release 附件，也没有这些文件。
3. [主进程](../electron/main.cjs)使用 GenericProvider 和 `releases/latest/download/`。当前库在没有缓存旧索引时，会到这个最新版本目录寻找旧版本的索引；即使以后只上传新索引，仍会失败并回退全量。
4. 当前 Mac 成品的公开信任回执为 `mode: local`、`developerIdSigned: false`；走项目自己的完整 DMG 下载器，不走 MacUpdater 的 ZIP 分块下载流程。调整 Windows 的开关不会改变这条路径。

最新正式版元数据的真实文件大小，使用十进制 MB：

| 成品 | 字节数 | 约 MB |
| --- | ---: | ---: |
| Windows 常规安装包 | 627,862,939 | 628 |
| Mac Apple 芯片 DMG | 653,678,562 | 654 |
| Mac Intel DMG | 659,630,150 | 660 |

核对 v0.31.2 与 v0.31.3 的 Git 对象：`public/assets` 下 2,646 个素材文件、608,772,220 字节，新增或内容变化均为 0。这是源素材比较，不能直接当成安装包的实测增量比例；打包、压缩、代码和签名还会改变成品字节。

当前本地生产构建中，素材共约 567 MB。其中上传 SWF 转换后的动作约 357 MB，“小日常”帧序列约 107 MB。资源复用有明显价值。

## Windows：使用现有库的分块下载

项目锁定 `electron-updater 6.8.11`、`electron-builder 26.15.3`。该版本的 NsisUpdater 已有以下能力：读取新旧 blockmap，从缓存的旧安装包复制相同块，只请求变化的字节区间，重组成完整安装包并核对 SHA512，再执行既有安装流程；失败会回退完整下载。

实施需要同时处理：

- 启用差分下载；保留下载前确认、安装前确认和存档回执。
- 发布常规 x64、兼容 x64、兼容 ia32 各自安装包的 `.blockmap`，校验并保留历史附件。
- 把下载文件固定到对应的 `releases/download/v版本号/`，正确解析新旧索引；不要只依赖 `latest` 目录。可选 GitHubProvider，或适配现有 GenericProvider，并继续隔离兼容版频道。
- 优先测试单区间 Range 请求。真实 GitHub Windows 安装包返回 `206`、`Content-Range: bytes 0-1023/627862939`。本云环境请求多区间得到 `501`，不能假定 CDN、代理和用户网络都支持多区间。
- 检查旧安装包缓存。NSIS 默认会把安装器复制到 updater 缓存；用户清理缓存、使用便携版或跨架构切换时，可能无法复用。不能把便携 ZIP 当成 NSIS 的旧包基准。
- 显示实际下载字节和全量回退状态，避免只显示一个百分比让用户无法判断流量。

这减少的是下载量。最终仍安装完整成品，存档流程不变；本地还需要旧包和新包的暂存空间。

## Mac：当前 DMG 与标准签名 ZIP 分开处理

### 当前本地签名 DMG：可做，但需适配和实测

可为原始 DMG 生成 blockmap，保留与版本匹配、已校验的旧 DMG；从旧包复制相同块，通过 Range 下载变化块，还原出新 DMG。完整 SHA256/SHA512 校验通过后，仍由用户打开 DMG、替换应用。

实测 GitHub Apple 芯片 DMG 也支持单区间请求，返回 `206`、`Content-Range: bytes 0-1023/653678562`。分块重组还原的是发布的完整 DMG，不改动其内部应用和签名字节；因此“节省下载量”本身不要求先获得 Developer ID，也不会因此自动获得无交互替换应用的能力。

需要适配缓存、版本索引、取消、失败清理及完整下载回退。可以参考现有库的 GenericDifferentialDownloader，但它属于内部接口，若复用，应锁定版本并覆盖回归测试。DMG 压缩和布局变化可能使差异较大，必须用两个真实连续版本测量，不能预先承诺只下载几 MB。

### 以后使用标准 Developer ID 签名版

锁定版本的 MacUpdater 已支持 ZIP 差分下载，需要新旧 ZIP 的 blockmap 和缓存的 `update.zip`。首次安装或没有旧 ZIP 缓存时仍会完整下载。发布时同时提供 ZIP、索引和对应架构元数据，不能只提供 DMG。应用替换还需正常签名和原生 Mac 更新流程。

当前 Mac 版不能直接切到这条路径并声称支持静默更新。新版官网文档已有 v27 内容，不能将其中的新配置直接套到本项目 v26/更新库 v6。

## 长期方案：把大素材拆成可复用资源

Windows 和 Mac 都保留小程序包，帧序列、音频、背景等作为按内容哈希命名的本地资源。更新先读取清单，只补缺失或变化的资源；已经下载的素材可离线使用。不能把全部素材压成一个每次都变化的大资源 ZIP，否则仍会重复下载。

这需要修改当前资源地址解析和打包规则，属于独立改造。Mac 缓存应放在应用外的用户数据目录，保留已签名应用包完整。清单应绑定程序版本、经过可信校验，全部必需资源就绪后再原子切换，失败时保留旧版；资源包不承载可执行代码。

国内下载速度是另一个问题：增量能减少流量，但不会让 GitHub 在国内变得可达。后续可增加受控的对象存储/CDN，保持同一份版本清单和文件校验，避免依赖不稳定的公共代理。

## 迁移及验收

旧客户端的下载逻辑已经写在本地，不能仅靠服务器发布一个文件就远程打开增量。升级到支持增量的过渡版，仍可能需要一次完整下载；缺少正确基准包时也必须允许完整下载。首次安装和手动下载 Release 的完整安装包，大小不会因此自动缩小。

实现后的验收至少包括：

1. Windows 常规版、兼容版两架构、Mac 两架构分别测试连续升级和跨多个版本升级。
2. 用真实成品记录完整大小、复用字节、网络实际传输字节、索引开销、耗时及磁盘峰值；提供可核对的比例。
3. 测试缺缓存、旧包或索引损坏、文件校验失败、Range 不支持、网络中断及取消后重试。
4. 确认重组包与原发布包哈希完全一致；安装后宠物和物品存档保留，取消确认不下载、不安装。
5. 素材或 Electron 大量变化时，允许增量接近全量；不能用人工构造的小补丁替代真实产品成品的节省比例。

本轮已验证：正式版附件和元数据、Mac 信任回执、单区间下载、多区间失败表现、当前库的新旧索引 URL 生成、连续版本源素材是否变化。尚未生成或执行产品增量包，也未测试增量安装，不能称为已实现。

## 可核对来源

- [v0.31.3 Release 附件](https://github.com/Vinci-217/mole-baby/releases/tag/v0.31.3)
- [electron-builder 自动更新文档](https://www.electron.build/docs/features/auto-update)
- [electron-builder NSIS 文档](https://www.electron.build/docs/nsis/)
- [锁定版本 AppUpdater 源码](https://github.com/electron-userland/electron-builder/blob/electron-updater%406.8.11/packages/electron-updater/src/AppUpdater.ts)
- [锁定版本 MacUpdater 源码](https://github.com/electron-userland/electron-builder/blob/electron-updater%406.8.11/packages/electron-updater/src/MacUpdater.ts)
- [Electron autoUpdater 与 Mac 签名要求](https://www.electronjs.org/docs/latest/api/auto-updater)
- [本次测量数据](../research/incremental-update-2026-10-29.json)
