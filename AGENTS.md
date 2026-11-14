# Review before release

用户要求：每次修改先展示效果，得到用户对本轮修改的明确确认后，才部署或发版。

- 未确认的实现和动图放到 `preview/` 分支供审阅；不要把它们当成已认可的正式效果。
- 未获得本轮确认前，不创建或推送版本标签，不创建、公开或更新 GitHub Release，也不推进自动更新的 latest 渠道。
- 发布新 Release 会被已安装的客户端自动发现，因此同样属于需要用户确认的发版行为。
- 日常检查、测试、参考素材调查和预览分支提交可以继续；先完成具体、可查看的预览，再请用户确认。
- 当前主要客户端仓库为 `Vinci-217/mole-baby`；不要把本项目改动推送到已停用的 `mole-baby-client` 或 `mole-baby-server`。发版前核对 Git remote 的实际地址。
- 拉姆动画以可核对的原页游素材、完整动作帧为参考，明确说明参考来源与自行适配部分；不能把一套整体缩放或旋转称作还原原著动作。

以上是用户明确要求的发布流程；用户后续明确指令优先。

# 本地原客户端素材库

用户要求把可取得的客户端原素材、动作与模块分析留在本地，后续直接复用。

- 新素材需求先查 `local-assets/catalog.sqlite`、`local-assets/timelines/`、`local-assets/extracted/` 和 `research/` 中已有调用记录，再决定是否需要联网获取缺失版本。
- `local-assets/raw/` 保存固定 GitHub 存档的全部原文件，逐个核对了 Git blob；不得为染色、裁切或动作适配而改写原件。导出和适配另存并标注来源。
- `local-assets/index.html` / `server.py` 是可搜索的本地素材库；缓存中的 PNG、音频、脚本及动作预览可以直接复用。操作和恢复方式见 `docs/LOCAL-ASSET-LIBRARY.md`。
- 保留原始 SWF 矢量时间轴，不把每个分层片段、灰色未染色导出或自行编排的整段流程冒称官方完整游戏动画。角色、服装、配色和交互分开核对来源。
- 素材库不进入安装包，不提交或推送大体积缓存；用户的存档目录和存档内容不属于此库。

## 通用发版流程

### 构建位置与预览费用

用户希望优先使用本地云电脑构建，减少 GitHub Actions 费用。

- 日常测试和网页生产构建在 Room 的项目目录执行。当前云电脑是 Linux x86_64；Windows 可在补齐 Wine 等交叉构建依赖后打包，Android 需要 Android SDK 和原有签名。保留目标平台的实际验收要求。
- 网页/PWA 测试包运行 `node scripts/package-web.cjs`，它在子进程中单独设置网页标志，输出完整 `dist/`、网页 ZIP、SHA256 和资源核验报告。网页直接进入小屋，沿用原有存档键；正式部署仍须本轮审核。细节见 `docs/WEB-EXPERIENCE.md`。
- 网页离线回归运行 `node scripts/web-app-regression.cjs` 和 `node scripts/web-app-regression.cjs --webkit`。保留同一组独立 QA 档案，检查导入导出、关闭旧窗口后的自然更新，以及原片实际像素；Chrome 同时禁用普通 HTTP 缓存，防止把网络缓存误当作 PWA 离线缓存。
- Windows 本地测试包运行 `node scripts/build-windows-preview.cjs`；Linux 预览通过构建工具自带的 NSIS 卸载器解析器完成，见 `docs/WORKSPACE-MAINTENANCE.md`。输出独立安装包与 ZIP，关闭测试包自动更新，保留应用标识、存档位置和运行中的网页 `dist/`。交叉构建校验不等于 Windows 原生验收。
- Room 网页交付大体积 Windows 测试包时，运行 `node scripts/prepare-windows-download.cjs` 和 `node scripts/windows-download-regression.cjs`，提供 `downloads/windows/` 的分段校验与续传页面。核验原包 NSIS 启动 CRC、实际浏览器完整保存后的 SHA-256；不能仅凭直链 HEAD、短 Range 请求或 7-Zip 容器测试宣称下载完整。下载 Worker 与缓存仅限下载目录，不动游戏存档。
- 质量检查结束后可运行 `node scripts/clean-workspace.cjs` 查看计划，`--apply` 清理明确的未跟踪构建缓存。不能清理 QA profile、用户记录、原始素材或运行中的产物。大体积派生 P-code 用 `compact_pcode.py` 无损归档，保留逐文件 SHA256 恢复索引。
- 修改外观缓存或播放器生命周期后，运行 `node scripts/appearance-cache-regression.cjs`，并通过 `scripts/care-outfit-native.cjs` 检查实际桌面/小屋切换。不要把普通 iframe DOM 移动当作引擎复用；旧运行时必须保留正常加载与缓存图片回退。机制见 `docs/APPEARANCE-CACHE.md`。
- 当前 Mac 流程需要 macOS 的签名、DMG 挂载和实际应用启动验证。Linux 可准备代码与完整素材，不能把未完成 Mac 签名和验证的文件标为可交付 DMG。Mac 收尾使用可访问的 Mac，或明确需要时才使用云端 Mac Runner。
- `.github/workflows/wardrobe-mac-preview.yml` 改为按需构建，普通 `preview/v0333-wardrobe-audit` 推送不再启动 Mac/Windows。手动触发时可选择 `mac`、`windows` 或 `both`，只构建需要的平台。
- 该工作流若尚未出现在私有仓库默认分支，可在确实需要云构建时，显式推送当前审核提交到 `preview/build-mac-test` 或 `preview/build-windows-test`，分别只触发对应平台。不要为了注册手动工作流而合并尚未审核的源码或改仓库默认分支。
- 不自动处理付费设置或为了免费额度公开私有源码。不为普通预览推送附带云构建；保留原有正式发版的审核要求。

项目提供 `npm run release` 作为统一发版入口。它只负责本地质量门禁和把当前提交推到发布分支；GitHub Actions 负责各平台打包、签名校验、上传附件和创建 Release。

1. 用户明确确认发版后，先提交本轮改动，再运行 `npm run release -- --check`。
2. 检查包括稳定三段式版本号、工作树状态、`git diff --check`、TypeScript、完整测试、生产构建和 Android XAPK 契约测试。
3. 检查通过且得到本轮发布授权后运行 `npm run release -- --push`；脚本会推送到 `release/v<package.version>`，不会直接创建 Tag 或 GitHub Release。
4. 推送后使用 `gh run list --repo Vinci-217/mole-baby` 和 `gh run watch <run-id> --repo Vinci-217/mole-baby --exit-status` 等待全部平台完成。任何平台失败都必须读取对应 Job 日志并修复后重跑，不能跳过失败发布。
5. 成功后核对 GitHub Release、Windows 安装包和 ZIP、macOS DMG 和 ZIP、Android APK 和 XAPK、SHA256、更新清单与覆盖升级存档兼容性。

构建时，Vite 的 `✓ built` 提示早于 `closeBundle` 中的无损素材处理结束；必须等 `Lossless assets` 汇总打印且整个进程以 0 退出，再启动依赖 `dist/` 的录制或界面检查。不要在构建仍写入素材时判定动画加载失败，也不要为缩短等待而删帧或降低素材质量。

保留现有用户数据目录、固定签名、包名和更新渠道；不要通过升级脚本清理存档。`--allow-dirty` 仅用于本地演练，不能和 `--push` 一起使用。
