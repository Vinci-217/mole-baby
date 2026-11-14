# 本地构建与仓库整理

## Windows 测试包

在 Windows 或本地 Linux 云电脑上运行：

```sh
node scripts/build-windows-preview.cjs
```

用户只需要安装版时，可运行 `node scripts/build-windows-preview.cjs --installer-only`。它仍核验全部本地素材、PE 和安装器启动/容器 CRC，省去便携 ZIP 的再次压缩与磁盘副本；默认流程仍构建安装包和 ZIP。

Linux 本地预览使用 electron-builder 自带的 NSIS 卸载器解析器，处理明确的临时生成器，不执行 Wine。构建期间只拦截这一条已知调用，结束或失败后恢复；最终安装脚本与安装器仍由原 NSIS 编译器产生。解析器也被构建工具用于无法执行 Wine 的 macOS 环境。

输出位于 `release/windows-preview/`：Windows 10/11 x64 安装包、完整便携 ZIP、SHA256、测试说明和逐项核验报告。整个流程在当前云电脑完成，不触发 GitHub Actions，不发布 Release，不改 latest 更新渠道。

测试包沿用 `com.molebaby.ramuhouse`、`mole-baby` 和“拉姆”，保持现有存档位置。`animationPreview` 标记关闭测试包的自动更新。网页 `dist/` 仍用于现有预览；桌面构建使用独立 renderer，打入应用并逐一核对哈希后删除这份中间副本。安装包完成后再把同一目录封装为 ZIP，避免两个包包含不同的 exe 或缺少文件。

所有核验完成后，脚本清理 `win-unpacked/` 中间目录，仅保留可交付的安装包和 ZIP。需要检查构建目录时加 `--keep-unpacked`；此选项不影响存档或任何已安装客户端。

已经完整构建 renderer、只需修正封装配置且源码未变化时，可加 `--package-only` 复用它；仍逐项校验资源索引与安装后字节。源码变化后必须执行默认的完整构建。

若在资源验收完成后、生成安装器时因空间等环境原因中断，可用 `--resume-package` 继续；它先重新核对已封装资源哈希与验收回执，才复用 `win-unpacked/`。Linux 有足够 `/dev/shm` 空间时，脚本为遵循 `TMPDIR` 的构建工具分配独立内存临时目录。当前 Linux makensis 仍会使用硬编码 `/tmp/mak…`；不能因此假定其临时占用已迁移，磁盘需同时容纳压缩输入、NSIS 临时副本与最终 EXE。空间紧张时可在验证完整输入哈希后暂存压缩输入到内存盘，再续建；不得靠删素材或跳过最终 CRC 来缩小占用。

Linux 交叉构建可验证 PE 架构、ZIP CRC、每个资源哈希和完整动画覆盖，不能替代 Windows 实机安装、快捷方式、拖动与更新测试。正式发版仍执行原有 Windows Runner 的验收流程。

### 测试包下载与 NSIS 完整性错误

打包脚本除了用 7-Zip 检查内部容器，还独立复核 NSIS 启动时使用的 CRC、数据边界和完整文件长度。不能因为 `7za t` 通过，就认为一个用户收到的 EXE 也已完整。

Room 网页交付大文件时，不应只提供一个长时间传输的 EXE 直链。安装包构建后运行：

```sh
node scripts/prepare-windows-download.cjs
node scripts/windows-download-regression.cjs
```

第一条命令校验原安装包的 NSIS CRC，生成 8 MiB 分段、SHA-256 清单和独立下载页，复用现有 `dist/downloads/windows/` 入口。第二条在真实浏览器中模拟断网、重开页面、短响应、同长度内容损坏和缓存损坏，完整保存 EXE 后重新计算 SHA-256 与 NSIS CRC。测试使用新建的独立临时下载缓存，结束后仅清理这一测试临时目录，不触碰游戏存档或已有 QA profile。

下载页逐段持久化缓存，错误只重试当前段；保存前重新核对每一段与总长度。使用仅限下载目录的 Service Worker 流式保存，不组装巨大内存 Blob；推荐 Windows Edge/Chrome。下载缓存数据库 `mole-windows-test-download-v1` 与游戏存档分开，Worker 不拦截小屋和游戏素材。

`release/windows-preview/download/` 是测试交付所需的下载副本，不进入安装包或源码提交。更新网页 `dist/` 后可重新执行准备命令恢复入口。正式 Release 仍使用经过本轮授权的既有发布渠道；不能为修复下载私自公开预览源码、创建 Release 或跳过安装包 CRC。

## 目录用途

| 目录 | 用途与清理规则 |
| --- | --- |
| `src/`、`electron/`、`android/` | 应用源码；按引用关系和平台入口核对，不能按文件年龄删除 |
| `public/` | 运行时原素材与完整动画，随安装包构建；不通过清理删帧或降低质量 |
| `scripts/` | 构建、回归、素材导出和维护工具；旧版本测试仍可能被当前回归调用 |
| `local-assets/` | 不入包的原客户端研究库；保留原始 SWF、导出媒体、索引与恢复信息 |
| `research/`、`docs/` | 素材来源、修复与审计记录；保留可复核证据和用户预览 |
| `artifacts/` | 检查报告、录制临时文件及独立 QA 档案；QA profile、存档和备份不自动清理 |
| `dist/` | 当前网页预览的完整静态构建；运行中的预览要继续保留 |
| `release/` | 已验证的测试部署包与安装包；不混入源码提交 |

源码引用图已从 `src/main.tsx` 核对：所有非测试 TypeScript/TSX 模块均可达。没有按“看起来旧”批量删除有效源码、官方素材或回归测试。

## 可重复执行的清理

```sh
# 只显示计划：
node scripts/clean-workspace.cjs
# 质量检查和构建完成后执行：
node scripts/clean-workspace.cjs --apply
```

只清理未跟踪的纯数字录制 PNG 帧、TypeScript/Vite/Python 可再生成缓存，以及空的旧 artifact 目录。Git 跟踪文件、混有其他内容的帧目录、符号链接指向、所有 QA profile 与用户记录均受保护。清理回执写入 `artifacts/workspace-cleanup.json`。不要在其他构建、测试或素材导出仍运行时执行清理。

## 反编译文本的无损归档

```sh
python3 scripts/client-library/compact_pcode.py
python3 scripts/client-library/compact_pcode.py --apply --minimum-bytes 8192
```

仅处理 `local-assets/extracted/` 内的派生 `.pcode`。逐文件压缩、解压核对 SHA256、持久化恢复索引后，才删除冗余的未压缩副本。冲突、写入失败或校验失败会保留原文件；不处理 raw、图片、音频和宠物记录。

索引保存在 `local-assets/pcode-archives.jsonl`，旧批次索引继续保留。素材库网页沿用原 `.pcode` 地址，读取时透明解压。直接查看或恢复：

```sh
gzip -dc 文件.pcode.gz
gzip -dk 文件.pcode.gz
```

2026-11-13 本次归档 31,091 份文本，逐份还原校验，释放 2,607,464,448 字节的实际磁盘占用。原始库全部 21,523 个文件重新核对长度与固定 Git blob，无缺失或修改。
