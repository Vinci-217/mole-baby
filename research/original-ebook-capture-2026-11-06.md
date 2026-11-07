# 原版 Ebook 时间轴录制

本轮用户要求获取页游紫色魔法书装扮的真实动画，否定上一版自行编排的开合和翻页。当前修改仅供预览，不修改版本、Release、latest 或玩家存档。

## 来源和公开资料

- 官方 SWF：https://mole.61.com/resource/petcloth/swf2/1200026.swf
- SHA256：`c30d025ffe0bf1c284e360343e660e1a43df79ec5324527eb5b7de0ebf9f145f`，与本地固定社区存档相同。
- 原配置为 Ebook，Layer 75；支持成长等级2、3、4、101及相应神力分支。
- 搜索到的公开资料大多为获取方式，未确认到可直接使用的完整透明 PNG 序列。MoleRuffle 公开项目证明了 Ruffle 播放此页游的可行方向；本轮仅离线播放装扮，不登录或连接游戏服务器：https://github.com/moleworld-dev/MoleRuffle
- Ruffle 配置/API：https://ruffle.rs/js-docs/master/interfaces/Player.PlayerV1.html

## 原播放与录制

`ClientAppDLL.swf` 的 `com/module/npc/uiManage/LamuUIManage.as` 按 getLamuMC、petBone0/1/2 事件选择方向及同步。MC1 的第3帧负责同步、末尾倒数3帧回到第2帧；低级站立固定第2帧，高级/超级继续播放。GF.setPetColor 使用 GV 中的加法颜色变换。Layer75自身替换整套角色，不能只抽书页再拼接另一套身体。

`OriginalEbookHarness.as` 替换的是派生 SWF 的 level 选择/事件适配器；图形与嵌套时间轴来自未改写的源 SWF。使用 JPEXS 26.4.0 编译后，Ruffle 0.7.1 播放。手动推进原帧时钟，每帧用 Playwright 浏览器截图，保留最终滤镜/透明度；直接 canvas.toDataURL 会漏掉部分滤镜，不能用于产品素材。

每种形态先检测整个方向树及骨骼的重复状态，再核对连续13帧图像相同才接受循环。额外录出黄、蓝、红、粉和独立紫色。运行时底图与覆盖掩码由前四种实际染色截图求解，独立紫色用于验证；比较时按 alpha 加权，避免透明边缘8位反预乘误差夸大显示差别。数据在 `artifacts/original-reading-runtime/colour-checks.json`。正常色模式保留源黑色半透明阴影，未沿用上一版“灰色占位层”删除方式。

## 复现

项目已有 Java/JPEXS、Playwright、Chromium、Sharp、FFmpeg。研究依赖 Ruffle 固定为 npm 包 @ruffle-rs/ruffle@0.7.1，30 MB，存在本地 artifacts 下，不进入安装包。

1. 从官方 npm 包解压 Ruffle 到 `artifacts/original-reading-runtime/ruffle/`。
2. 使用 JPEXS `-replace` 把 `scripts/art/OriginalEbookHarness.as` 编译进原 SWF 的派生副本 `ebook-harness.swf`，script 名为 `§1200026_fla§.lamu_mc_1`；固定库原件不变。
3. 从 `artifacts/original-reading-runtime/` 运行 HTTP 服务器，端口5186；`capture.html` 固定960×560用于录制，`index.html`为交互核对页面。
4. `node scripts/art/capture-original-ebook.cjs`。
5. `node scripts/art/pack-original-ebook.cjs`。
6. `VITE_LOCAL_DEBUG=1 npm run build` 后，运行 `node scripts/review-original-reading-debug.cjs` 和阅读静止回归。

## 边界

当前恢复的是正面 Ebook 装扮循环。没有找到需要另加的官方翻页、合书动作，故不编造。截图所在游戏场景及账号状态未知，离线模拟器播放不等于完整客户端实录。种子没有此原装扮，不伪造种子穿戴；本地形态调试开关继续隔离正式存档。

## 本轮验证结果

- 八种形态共178帧，每个循环均检查整个方向树、骨骼状态及连续13帧图像重复。
- 五种原文件颜色对照，源尺寸下 alpha 加权 RGB 均方根误差最多0.171/255；图集等比例缩放后，178帧独立紫色对照最多0.584/255（允许2/255）。
- 全量601项测试通过（440 Vitest + 161 Node）。
- 原文件播放页：八形态切换、颜色切换、暂停恢复、393px 手机宽度，页面错误0。
- 构建、应用阅读预览与静止回归的结果另存于本轮 artifacts。未制作或发布新原生安装包。

- 最终预览构建通过，1293张图片的无损 WebP 转换逐像素校验通过。
- 应用预览：八种原装扮和种子、帧推进、18秒结束、减少动态效果、手机布局与正式存档不变，均通过。
- 阅读/计时静止、结束后恢复走动；原生桥接禁止阅读拖动并恢复；餐厅进入/停止和320px布局回归通过。
- 本地调试：全部成长和神力形态切换、刷新、关闭后恢复原存档及原解锁限制，正式 localStorage 逐字节不变。
