# 小屋交互与手机打工修复预览 · 2026-11-06

本轮继续使用 `preview/reading-and-desktop-work`，供用户查看修复效果。没有改变存档目录、读取键、用户身份或已有家具摆放数据。

## 小屋

旧版桌面与手机竖屏中，放在可走动区域的留言板会被透明地面按钮覆盖：真实点击命中 `room-walk-surface`，留言板没有打开。现在地面点击层位于家具下方，拉姆保持在家具上方；拉姆透明边缘收到点击时，还会先寻找该点下方的交互家具，再决定是否走动。

种子阶段禁止小屋的随机走动、点击目的地和方向键行走；桌面／手机悬浮模式继续向原生桥接发送不可行走状态。种子的原版待机动画保留。

成长后的活动范围统一限制在中下部地面，普通窗口从地图高度约55%处开始，底部避开功能栏。短横屏保留可用地面，点击、随机目标与方向键使用同一范围，墙面点击不会让拉姆走上去。

## 打工

Android 桥接按原生客户端顺序模拟「移除悬浮 WebView → 窗口短暂不可见 → Activity 接回同一 WebView」。旧版进入餐厅后活动 ID 消失、餐厅变为 `closed`，开始扣除约10点精力（包含同时发生的少量自然消耗）。

现在只对用户主动发起的手机视图切换提供最多4秒的过渡时间。目标窗口与网页重新可见后立即结束过渡；切换失败或超时不持续保护。断网、真正进入后台、关闭或重载仍取消未完成工作，不补发工资。

复测同一流程后，进入餐厅保留原活动 ID，开始成本为2点精力；进入餐厅本身不重新收费。最低精力从31调整到23，覆盖2点开始成本和两分钟自然消耗，避免刚开始就触发自动睡觉。工作仍为2分钟、完成奖励180摩尔豆，只结算一次；上课和自然数值消耗规则保持独立。

## 验证

- 439 项 Vitest 与161项 Node测试通过，合计600项；生产构建和1277张图片无损像素校验通过。
- `scripts/room-interaction-check.cjs`：1180×820、393×852、852×393，真实留言板点击、与拉姆透明边缘重叠点击、空地行走、墙面排除、中下部随机目标、种子静止。
- `scripts/android/restaurant-transition-check.cjs`：同一手机视图切换复现前后对比、活动ID保留、2点成本、真正进入后台不结算，以及种子悬浮模式的行走禁用请求。
- `scripts/android/browser-smoke.cjs`：393×852、360×640、852×393、1280×800；领养、布局、购物使用、原生存储回滚、课程、返回、计时恢复与悬浮桥接。
- 餐厅完整流程和读书暂停走动的回归脚本继续保留，验证工资只结算一次、离线／隐藏／重载取消，以及阅读结束后恢复原有走动设置。

```sh
npm test
npm run build
node scripts/room-interaction-check.cjs
node scripts/android/restaurant-transition-check.cjs
MOLE_REVIEW_URL=http://localhost:5173 CHROMIUM_PATH=/usr/local/bin/chromium node scripts/android/browser-smoke.cjs
node scripts/restaurant/work-showcase-check.cjs
node scripts/reading-stationary-room-check.cjs
```

脚本使用已运行的生产预览。Android 本轮是浏览器桥接复现与测试，未在华为真机或新APK上验收，不将此结果称作实机通过。
