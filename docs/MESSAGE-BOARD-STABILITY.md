# 留言板抖动修复验证

## 问题与修复

用户提供的 4 秒录屏显示：Windows 上独立留言板的木框和留言卡片持续一起跳动。

留言板根据滚动容器的内容宽度等比例缩放。在使用占据布局宽度的传统滚动条时，980 × 711 的内容窗口会触发循环：

1. 留言板放大到 940px，内容高度超过容器，出现纵向滚动条。
2. 可用宽度减为 925px，`ResizeObserver` 缩小留言板，内容高度随之下降。
3. 纵向滚动条消失，可用宽度恢复为 940px，重复以上过程。

修复在滚动容器上使用 `scrollbar-gutter: stable` 预留空间。尚不支持该属性的旧 WebView 使用 `overflow-y: scroll` 保留相同空间，支持时使用 `overflow-y: auto`。不修改官方素材、留言数据或存档位置。

## 已执行的检查

- 修复前：980 × 711、传统滚动条环境下连续采样 60 帧，发生 59 次尺寸/位置变化，宽度在 940px 和 925px 之间切换。
- 修复后：19 组窗口尺寸与 1 / 1.25 / 1.5 / 2 倍像素密度模拟，每组连续采样 60 帧，均为 0 次变化。
- 覆盖反复跨越滚动条临界高度、1 / 6 条留言页面、翻页，以及旧 WebView 的滚动条回退路径。
- 手机 360px 窗口仍可左右滚动，顶部关闭按钮可见。
- Electron 原生窗口在 711 / 710 / 720 / 740px 内容高度下均保持稳定；留言编辑、换色后同步保存、完整退出重启保留颜色/身份/留言/物品通过。
- 桌面浏览器和小屋回归通过：留言增删改、回复、完成标记、翻页和重新载入。
- `npm run build`、`git diff --check` 与改动脚本语法检查通过。

测试在 Linux 云电脑上执行，使用有界面 Chromium 的传统滚动条以及真实 Electron 窗口；像素密度模拟和旧 API 回退检查不代表 Windows 或华为手机真机验收。无界面 Chromium 默认的浮动滚动条不会占用宽度，单独使用它无法复现此问题。

```sh
npm run build
xvfb-run -a node scripts/review-message-board-stability.cjs
node scripts/review-desktop-board.cjs
node scripts/review-room-ui.cjs
xvfb-run -a node scripts/review-desktop-native.cjs
```

浏览器回归默认使用已经运行的 `http://127.0.0.1:5173`，可通过 `MOLE_REVIEW_URL` 指定其他预览地址。Windows/macOS 有桌面的环境运行稳定性脚本时不需要 `xvfb-run`；可以通过 `CHROMIUM_PATH` 指定 Chromium 可执行文件。

本地复现数据、截图和对比录像位于忽略提交的 `artifacts/board-jitter-review/`。本轮仅提供预览，未推送、发版或更新自动更新渠道。
