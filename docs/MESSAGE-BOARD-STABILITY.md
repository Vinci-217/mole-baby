# 留言板抖动修复验证

## 问题与修复

用户提供的 4 秒录屏显示：Windows 上独立留言板的木框和留言卡片持续一起跳动。

留言板根据滚动容器的内容宽度等比例缩放。在使用占据布局宽度的传统滚动条时，980 × 711 的内容窗口会触发循环：

1. 留言板放大到 940px，内容高度超过容器，出现纵向滚动条。
2. 可用宽度减为 925px，`ResizeObserver` 缩小留言板，内容高度随之下降。
3. 纵向滚动条消失，可用宽度恢复为 940px，重复以上过程。

修复在滚动容器上使用 `scrollbar-gutter: stable` 预留空间。尚不支持该属性的旧 WebView 使用 `overflow-y: scroll` 保留相同空间，支持时使用 `overflow-y: auto`。不修改官方素材、留言数据或存档位置。

### 首次显示跳变的补充修复

上一轮只检查等待 150ms 后的稳定画面，遗漏了首次显示。用户指出后，检查旧录像的原始帧发现第一张确实仍为默认 770px，下一张才变为 925px；连续 6 次重新打开均可复现。此前约 1.2 秒的短片还被循环拼成 4 秒的对比视频，因而重复展示了首次跳变，旧视频不能作为首次显示已修复的证据。

尺寸计算与焦点设置现改为在 `useLayoutEffect` 中执行，使首次绘制就使用实际容器宽度；初始计算和 `ResizeObserver` 回调均读取 `clientWidth`，避免不同测量方式带来的小数宽度修正。焦点设置使用 `preventScroll`，避免焦点转移额外滚动页面。

回归脚本在 React 挂载前注册采样，从留言板第一次出现开始记录 60 帧，不再跳过首次显示。新录像从导航前开始，保留静止帧的真实停留时间，连续录制 6 秒，不循环或剪接短片。

## 已执行的检查

- 修复前：980 × 711、传统滚动条环境下连续采样 60 帧，发生 59 次尺寸/位置变化，宽度在 940px 和 925px 之间切换。
- 修复后：19 组窗口尺寸与 1 / 1.25 / 1.5 / 2 倍像素密度模拟，首次显示的 60 帧与稳定后的 60 帧均无尺寸/位置变化；另检查 5 次重复打开。
- 覆盖反复跨越滚动条临界高度、1 / 6 条留言页面、翻页，以及旧 WebView 的滚动条回退路径。
- 手机 360px 窗口仍可左右滚动，顶部关闭按钮可见。
- Electron 原生窗口从首次显示开始保持稳定，在 711 / 710 / 720 / 740px 内容高度下也保持稳定；留言编辑、换色后同步保存、完整退出重启保留颜色/身份/留言/物品通过。
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

本地复现数据和录像位于忽略提交的 `artifacts/board-jitter-review/`。首次显示的修复前证据在 `before-initial-sizing/`，当前检查结果与连续录像在 `after-initial-sizing/`。本轮仅提供预览，未推送、发版或更新自动更新渠道。
