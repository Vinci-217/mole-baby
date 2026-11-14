# 用户换衣日志复查与 Mac 测试包

用户提供的日志是 `version: 1`，导出时间为 2026-11-12 05:04:17 UTC。末尾明确出现换成魔法帽后转入 `sick`，并选择“暂用原形播放完整动作”。这不是成长数据丢失，而是持续状态错误地走进了完整动作的临时脱衣分支。

## 复现与修复

独立实际游戏档案：经典超级拉姆、健康 20、已拥有并穿着魔法帽。旧构建中 `data-action=sick`，存档 `wearing=wizard-cap`，但服装层不可见、播放器数量为 0。记录保留在 `artifacts/wardrobe-condition/before.json` 和 `before.png`。

将生病、饥饿、口渴、脏、难过、疲倦六类持续状态加入服装静止外观的支持范围。状态和真实数值照常显示，不修改健康、成长或服装所有权。摸头和拖动结束后回到穿衣的持续状态；足球、阅读等完整动作仍按既定规则暂用真实形态，结束恢复服装。

旧日志只有加载开始，没有 `ready` 或 `error`，不足以断定其他尝试是网络问题、仍在加载还是被切换取消。本轮日志格式升级为 2，增加会话启动、加载阶段、未完成切换取消和导出时的实际播放器状态。`appearance` 事件明确表示所选分支，不能当作已经成功显示的证据。装扮尚未加载完成时，角色旁会显示“装扮载入中”。

## 回归检查

```sh
npm test
npm run build
node scripts/verify-offline-assets.cjs
node scripts/wardrobe-condition-regression.cjs
xvfb-run -a -s '-screen 0 1280x900x24' env MOLE_QA_LOCAL=1 node scripts/wardrobe-condition-regression.cjs
```

实际操作覆盖：生病状态换衣、返回桌面、穿衣摸头、摸头结束、重开保留身份与成长，以及导出包含成功加载和当前播放器快照的日志。复查不会把测试拉姆的健康补满来规避问题。专用桌面测试档案存在时继续复用。

本地结果：507 项 Vitest、170 项 Node 测试通过；实际浏览器与 Linux Electron 的上述回归均通过，页面错误为 0。Electron 的文件导出通过原生下载回调保存验证，与浏览器的下载事件分别检查。最终安装资源清单包含 4316 个文件和 567 个原始 SWF，完整性校验通过。

## Apple 芯片测试 DMG

`.github/workflows/wardrobe-mac-preview.yml` 仅监听私有仓库的 `preview/v0333-wardrobe-audit` 分支，在 `macos-15` 构建 arm64 测试包。它不包含发布 Release、创建 Tag 或更新 latest 渠道的步骤，公开仓库保持原样。

测试构建带 `animationPreview=true`，主进程据此禁用自动更新。应用标识、产品名称和原有存档路径保持一致。构建要求完成 DMG 挂载、签名、安装资源校验、实际 Mac 应用检查和打包后生病换衣回归，再提供测试附件。Mac 测试采用本地签名，不冒称已通过 Apple 公证。

测试安装前先从托盘完全退出旧版，再将 DMG 中的“拉姆.app”拖入“应用程序”覆盖。旧存档继续从原目录读取。
