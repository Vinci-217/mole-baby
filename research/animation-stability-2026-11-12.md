# v0.33.3 动画连续性与本地素材复查

本轮在 `preview/v0333-wardrobe-audit` 本地预览分支修复，不推送、不发布安装包，不更新 client/server。没有改动玩家存档位置、键名或格式。

## 复现及修复

1. **完整动作结束后重新初始化服装引擎。** 旧版玩球期间服装 iframe 数量降为 0，结束后 token 改变，同一流程出现 2 次 WASM 请求。现保留并暂停服装会话，完整动作仍使用真实成长形态，结束后恢复同一服装；实测玩球、进食、表情三种动作仅发生最初的 1 次引擎请求。这一计数不等同于网络实际传输量，旧请求也可能命中 HTTP 缓存。
2. **连续换衣访问已销毁的音频上下文。** 实际 8 形态测试捕获 `Cannot resume a context that has been closed`；追踪到旧原片移除后触发 Ruffle 的音频恢复。换服装、换源形态或失败重试时改为新的隔离会话；会话退出后拒绝迟到消息。普通姿势和临时完整动作继续复用当前服装会话。没有通过忽略全部播放器错误来使测试通过。
3. **实际穿戴后短暂不显示衣服。** 原成功穿衣逻辑立即播放没有穿衣原片的表情，暂时盖住衣服。改为完成穿戴后显示所选服装，清除已结束的临时动作，不改变课程、工作或专注计时规则。
4. **慢加载消耗阅读时长。** 图集加载和播放原用同一个计时起点。现有独立加载预算，解码完成后才开始播放计时。将神力形态看书图集人为延迟 3500ms，首次显示起播放 18389ms 后结束，保留完整约 18 秒动作。
5. **诊断入口难找。** 试衣间及“设置 → 动画与素材”始终提供“导出动画日志”；文件名和 JSON 都包含日期。Android 使用原有系统文件保存桥接，不依赖 WebView 下载 Blob。

## 本地素材

最终构建校验 **4316 个文件，627,474,935 字节**，包含全部游戏使用的图片、音频、适配器、原 SWF 与引擎。567 个原始 SWF 与原清单 SHA256 一致。918 张构建时无损编码的图片逐张验证可见 RGBA 和所有透明度，未减少原动作帧、缩小原件或改写原 SWF。

桌面包包含整个 `dist/**/*`；Android 原本就在 APK 内携带本地资源包，本轮增加打包前校验。资料库 `local-assets/` 和归档继续保留。网页预览首次从网页加载资源，不能据此承诺网页首次断网可用。

资源说明及复查命令见 [LOCAL-ANIMATION-ASSETS.md](../docs/LOCAL-ANIMATION-ASSETS.md)。

## 本轮验证

- TypeScript、完整生产构建通过；64 个测试文件、499 项 Vitest、169 项 Node 测试通过。
- 实际浏览器中 8 种成年形态代表服装：左右拖动、穿衣摸头、原版足球、动作中换衣、快速选择及失败恢复通过，未出现页面异常或缺失请求。
- 原始服装资料与前轮 122 件服装、406 个声明形态的像素审计仍保留；本轮没有声称人工逐帧查看全部 406 种组合。
- 1100、393、320 像素宽度下，衣橱 14 页每页 9 格，页脚位置固定；种子不能试穿或穿戴。
- 首次清单失败、引擎迟到、入口脚本失败后三种故障注入恢复通过，导出的诊断包含错误事件。
- 实际游戏中从小屋换衣，返回桌面摸头、玩球、恢复衣服、重开保留身份、颜色、成长、物品和衣橱通过，复用已有 QA 档案。
- **实际 Linux Electron 禁止所有 HTTP(S) 请求**：本地原片加载、真实 X11 鼠标左右拖动、足球、恢复服装和重开记录通过，远程请求为 0。
- 实录 GIF 直接来自生产渲染器的浏览器截图，以实际时间记录，不重新绘制角色或假造动作帧。

Windows、macOS、Android 本轮未重新打包或真机运行。上述测试不能保证所有设备绝无问题；本轮交付是可审阅的本地修复预览。

## 可追溯结果

- `artifacts/animation-stability/before.json`
- `artifacts/animation-stability/continuity-checks.json`
- `artifacts/animation-stability/offline-assets.json`
- `artifacts/wardrobe-quality/after-interactions.json`
- `artifacts/wardrobe-quality/gameplay-checks.json`
- `artifacts/wardrobe-quality/native-checks.json`
- `artifacts/wardrobe-load/recovery-checks.json`
- `artifacts/wardrobe-interactions/interaction-checks.json`
- `artifacts/wardrobe-quality/换衣动作连续性实录.gif`

QA 档案、旧诊断和原件归档均在本机；没有清理玩家存档。
