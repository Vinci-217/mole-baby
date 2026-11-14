# v0.33.3 服装修复与检查

本轮基线为 `82bbc1221d97e690b151d0735ba83070d12f85f3`，预览分支为 `preview/v0333-wardrobe-audit`。本轮不更新 client/server，不推送，不发版。

2026-11-12 的连续动作、慢加载、本地素材和会话隔离复查见 [动画稳定性报告](../research/animation-stability-2026-11-12.md)，资源安装与导出日志说明见 [LOCAL-ANIMATION-ASSETS.md](LOCAL-ANIMATION-ASSETS.md)。

## 外观规则

- 只有初级原片的衣服：显示原片的完整初级穿衣外观和走法，不把配饰叠在中级、高级或神力身体上。真实成长、进化、颜色不变，脱衣恢复真实形态。
- 有对应形态的衣服：使用对应的原版时间轴。
- 种子：不能试穿或穿戴，衣橱所有权保留。
- 摸头：保留完整穿衣原片；手部、爱心、轻微身体响应是项目适配，不能称为官方摸头原片。
- 拖动：保留完整穿衣原片，左右朝向和走动使用原片时间轴；鼠标拉拽弹性是项目适配。
- 足球、进食等没有穿衣原片的完整动作：暂用真实形态的原版动作，结束后恢复保存的衣服。不会修改成长或保存的服装选择。

## 发现与修复

1. 旧版穿衣拖动总传 `idle`，8个成年形态的代表件都无法转向。现在读取共用拖动层的方向与速度，保持已加载播放器，向左/向右拖动使用相应原版走动。
2. 衣橱中玩球时选新衣，旧玩球动作继续挡住新衣。现在选衣、原样、收衣统一结束旧试衣动作和拖动，再显示新选择。
3. 原片请求失败后重新点同一衣服无法恢复。现在常驻原片失败后自动重试一次；再次选择同一衣服也可以重试。旧请求不得覆盖新选择。
4. 首次点选遮罩可能在素材 ready 后才挂载，漏掉首次消息。现在预先挂载，加载时清空，收到有效遮罩再参与像素点选。
5. 使用同一 `costumePlayback` 入口解析真实形态、服装原片和临时外观，供角色、衣橱、桌面与移动预览共用；原有物品 ID 和存档格式保留。

## 清理范围

沿 `src/main.tsx` 的导入关系确认后，移除不再使用的贴衣模块、旧餐厅界面及对应测试/工具，共19个代码、测试和工具文件。另将505个文件、54,301,094字节的旧合成衣服图集移出 `public/`，避免继续装入安装包。

完整归档留在 `local-assets/retired/v0333-wardrobe/`，清单为 `retired-files.json`。原始素材库、SWF原件、仍在使用的衣服图标、餐厅存档兼容数据都保留。没有降低原片质量或减少原片动作帧。

## 复查方式

先完成 `npm run build`，必须等待 `Lossless assets` 汇总和退出码0，再运行界面审计或录制。不要一边重建 `dist/` 一边进行素材加载测试。

```sh
npm test
node scripts/audit-runtime-imports.cjs
node scripts/wardrobe-quality.cjs
node scripts/wardrobe-interaction-regression.cjs
node scripts/wardrobe-gameplay-quality.cjs
AUDIT_LABEL=v0333-after ALL_FORMS=1 node scripts/audit-outfit-pixels.cjs
xvfb-run -a -s '-screen 0 1280x900x24' node scripts/wardrobe-native-quality.cjs
node scripts/record-wardrobe-quality.cjs
```

`PREVIEW_URL` 可指定已启动的预览地址；`CHROMIUM_PATH` 可指定本机浏览器。像素审计可用 `AUDIT_START` 和 `AUDIT_RESUME=1` 从已完整检查的服装之后接续，保存每项实际像素结果。

- `artifacts/wardrobe-quality/before-interactions.json`：旧版复现记录。
- `after-interactions.json`：8形态、方向、摸头、足球、换装及故障注入结果。
- `native-checks.json`：实际 Linux Electron、自定义素材协议、X11 鼠标拖动及重启存档检查。
- `gameplay-checks.json`：实际小屋换衣、桌面摸头、原版足球、恢复服装与重开保留检查。
- `artifacts/wardrobe-interactions/v0333-after-pixels.json`：全部衣服声明形态的实际像素、边缘检查。
- `artifacts/wardrobe-interactions/interaction-checks.json`：小屏、固定9格分页、种子限制。
- 本轮GIF由真实浏览器界面按实际时间录制，不重绘动作。

桌面测试使用专用 `artifacts/wardrobe-quality/electron-qa-profile`，存在时复用，不清理或覆盖；其测试拉姆只在空档案首次创建。独立试衣预览不写玩家存档。Linux Electron 和浏览器验证不能代替 Windows、macOS、Android 真机验证，本轮没有重新打包这些平台。

## 本轮已完成的结果（2026-11-11）

- TypeScript、生产构建通过；62个测试文件中的495项 Vitest、169项 Node 测试通过。
- 8种成年形态各选代表服装，实际左右拖动、穿衣摸头、原版足球、动作中换衣和尺寸注册检查通过。
- 122件服装、406个声明形态组合都绘制出有效像素，画布边缘裁切为0；这不等于逐帧人工审阅所有动作。人工查看了全部静止缩略图及8件代表的交互画面，另查看了6件分类移动和2件摸头拖动的实录。
- 567个原始 SWF 与构建产物 SWF 均按清单校验，18,843,929字节，SHA256全部一致。
- 延迟旧服装请求后快速换衣，最后一次选择保留；断开原片请求，自动重试和再次选择恢复通过。
- 正常游戏内的小屋换衣、桌面摸头、玩球后恢复服装、重开保留数据通过。专项 Electron 检查也通过真实 X11 鼠标左右拖动和重开保留数据。
- 1100、393、320像素宽度下，衣橱14页每页9格，最后一页留空，翻页位置固定；种子禁穿通过。分类移动预览的4类共122件，窄屏和分类切换/刷新检查通过。
- 已保留专用 QA 档案，检查过程不清除玩家数据；没有本轮发布、推送或 Windows/macOS/Android 新安装包。
