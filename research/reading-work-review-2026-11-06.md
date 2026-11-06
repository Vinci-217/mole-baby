# 读书位置与桌面打工预览 · 2026-11-06

本轮按用户要求先交付 GIF 和网页预览，使用 `preview/reading-and-desktop-work` 分支。

## 修改

- 书本在 0.32.2 的位置基础上再次下移：100px 拉姆普通形态下移 8px，种子下移 6px；小屋和缩放模式按比例显示。保留原身体与书本比例和翻页节奏。
- 专注计时和「自己看书」期间暂停桌面与小屋随机走动，禁止桌面拖动和调整大小。读书结束或计时取消／完成后释放暂停，不修改原有走动开关；翻页动画继续播放。
- 穿着「魔法书」装扮读书时，临时收起侧边装扮书，只显示当前的翻页书；结束读书后恢复。没有修改衣橱、穿戴存档或购买状态。
- 0.32.2 的桌面入口实际使用 `DesktopRestaurantStatus` 静态工作卡，原 `DesktopRestaurantWork` 动画组件仍在但未挂载。本轮接回真实工作状态，显示左灶台、右餐桌、取餐、端盘、放盘和空手返回循环。
- 点击桌面动画进入同一次工作对应的餐厅；停止或结束后恢复拉姆。原生窗口通过现有 effect bounds 接口扩展到动画所需范围，结束后释放；网页窄屏按比例适配。

人物、服装、灶台、餐桌和餐盘沿用已核对的原版素材；桌面路线和循环时间为本地编排。读书的翻页画面是本地适配，不冒称原客户端完整动作。

## 检查与复现

生产构建通过，1277 张图片无损压缩与可见像素校验通过。7 项读书、餐厅时间轴测试和 51 项桌面窗口几何／生命周期测试通过。

`scripts/restaurant/work-showcase-check.cjs` 验证完整餐厅流程、15 种背景、手机横竖屏与 320px、真实足球菜单开始工作、桌面画布实际变化、进入餐厅、停止／完成、工资只结算一次、离线／隐藏／重载取消，以及身份、颜色和存档保留。

`scripts/record-reading-work-review.cjs` 从生产预览录制 GIF：读书 9 种形态、16fps／8秒；真实桌面工作 16fps／9秒。另检查魔法书装扮在阅读时收起并在结束后恢复、320／393／1000px 宽度、进入餐厅沿用同一次工作，以及原生桥接请求扩展窗口并在停止时恢复。桥接为浏览器模拟，不能替代新安装包的原生实机验收。

补充的移动检查验证真实页面在读书时拒绝拖动，原生桥接收到暂停移动并在取消计时后恢复。`scripts/reading-stationary-room-check.cjs` 开启随机走动，推进16秒检查小屋阅读位置保持不变，阅读结束后确认移动恢复；还验证计时完成后恢复以及原本关闭的随机走动设置保持关闭。

```sh
npm run build
node scripts/record-reading-work-review.cjs
node scripts/reading-stationary-room-check.cjs
node scripts/restaurant/work-showcase-check.cjs
```

脚本使用已运行的 `http://localhost:5173` 生产预览，可通过 `MOLE_REVIEW_URL` 指向其他已验证的预览地址。GIF 与检查回执在本地 `artifacts/reading-work-review/`，不放入安装包。独立读书预览 `?preview=reading` 不读写玩家存档；桌面独立演示为 `?preview=desktop-work`。
