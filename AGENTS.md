# Review before release

用户要求：每次修改先展示效果，得到用户对本轮修改的明确确认后，才部署或发版。

- 未确认的实现和动图放到 `preview/` 分支供审阅；不要把它们当成已认可的正式效果。
- 未获得本轮确认前，不创建或推送版本标签，不创建、公开或更新 GitHub Release，也不推进自动更新的 latest 渠道。
- 发布新 Release 会被已安装的客户端自动发现，因此同样属于需要用户确认的发版行为。
- 日常检查、测试、参考素材调查和预览分支提交可以继续；先完成具体、可查看的预览，再请用户确认。
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

项目提供 `npm run release` 作为统一发版入口。它只负责本地质量门禁和把当前提交推到发布分支；GitHub Actions 负责各平台打包、签名校验、上传附件和创建 Release。

1. 用户明确确认发版后，先提交本轮改动，再运行 `npm run release -- --check`。
2. 检查包括稳定三段式版本号、工作树状态、`git diff --check`、TypeScript、完整测试、生产构建和 Android XAPK 契约测试。
3. 检查通过且得到本轮发布授权后运行 `npm run release -- --push`；脚本会推送到 `release/v<package.version>`，不会直接创建 Tag 或 GitHub Release。
4. 推送后使用 `gh run list --repo Vinci-217/mole-baby` 和 `gh run watch <run-id> --repo Vinci-217/mole-baby --exit-status` 等待全部平台完成。任何平台失败都必须读取对应 Job 日志并修复后重跑，不能跳过失败发布。
5. 成功后核对 GitHub Release、Windows 安装包和 ZIP、macOS DMG 和 ZIP、Android APK 和 XAPK、SHA256、更新清单与覆盖升级存档兼容性。

构建时，Vite 的 `✓ built` 提示早于 `closeBundle` 中的无损素材处理结束；必须等 `Lossless assets` 汇总打印且整个进程以 0 退出，再启动依赖 `dist/` 的录制或界面检查。不要在构建仍写入素材时判定动画加载失败，也不要为缩短等待而删帧或降低素材质量。

保留现有用户数据目录、固定签名、包名和更新渠道；不要通过升级脚本清理存档。`--allow-dirty` 仅用于本地演练，不能和 `--push` 一起使用。
