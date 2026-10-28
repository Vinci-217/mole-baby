# v0.30.1 发布验收

应用源代码为 `e5ea6dee8a18ea363c171900297fcc5748715993`，版本标签 `v0.30.1`。后续验收文档不改变标签的应用代码。

[正式构建及发布](https://github.com/Vinci-217/mole-baby/actions/runs/40629997837) · [下载与版本说明](https://github.com/Vinci-217/mole-baby/releases/tag/v0.30.1) · [五种预发布成品检查](https://github.com/Vinci-217/mole-baby/actions/runs/40627123199)

## 已完成的本地检查

- 285项Vitest与96项Node测试通过，共381项。新增课程逐节解锁、旧存档继承、第五阶段门槛、原文件及图集完整性、共用烟雾切换、家具来源校验及嵌套课程图标压缩路径检查。
- 完整生产构建与兼容构建通过。805张图片的透明度和可见像素无损校验通过，98.61MB压缩为60.62MB。
- 实际生产浏览器逐段播放18个原版变身，记录首帧与末帧，保留1,711个原始时间帧。课程结束只解锁一次，重新打开不重复结算；计时完成和手动取消在回忆中保存；家具购买、实际背景拖动、背景切换、两个布置结束入口及Escape关闭通过。
- 八种形态带魔法帽实际往返检查，切换帧原形未覆盖像素均为0；盒子期间原装扮完全隐藏，恢复后重新出现。见[实际截图](../artifacts/v30-workflow/magic-forms.png)与[覆盖回执](../artifacts/v30-workflow/magic-coverage.json)。
- Linux现代Electron桌面窗口通过真实光标拖动、四边吸附、透明区域、照料、装扮、小屋、更新确认，以及新增工作流检查。
- 另以Electron22.3.27／Node16.17.1／Chromium108运行兼容生产界面，通过领养、照料提示、透明窗口、小屋、三系变身、家具及计时记录；没有渲染器异常。

## 平台成品检查

Windows常规x64、兼容x64、兼容ia32、Mac arm64及Mac x64均在对应构建环境打包并实际启动检查。Windows检查PE架构与ZIP完整内容，并实际完成安装向导、启动安装后的应用；常规版另运行真实NSIS升级夹具，验证下载与安装分别确认，以及安装前存档和数据保留。更新元数据及各架构下载包在发布前再次核验。

计时用例在开始前冻结虚拟时钟，确保原生窗口操作耗时不影响预期的3秒会话；计时记录仍验证实际用时。正式构建 `e5ea6dee8a18ea363c171900297fcc5748715993` 的五种成品全部通过，发布前核对十个下载包的SHA256及各更新渠道的元数据后公开发布。[正式发布回执与下载校验值](release-0.30.1-receipt.json)。

## 测试边界

当前云环境没有Windows7／8／8.1实机或虚拟机。兼容目标依据Electron22支持范围，Windows Server2022上的兼容成品与Linux上的Chromium108检查不能代替旧系统具体显卡、DWM、DPI及补丁组合验收。[老系统安装选择](../docs/WINDOWS.md)。Mac成品为本地签名，未经过Apple公证；首次打开说明包含在发布页和安装盘中。

## 复现

`npm test`；`npm run build`后运行`node scripts/workflow-regression.cjs`检查全部18段原版技能；`node scripts/compact-care-regression.cjs`复核完整浏览器照料与桌面流程。Linux云桌面检查使用`node scripts/desktop-smoke.cjs`；兼容渲染器使用`npm run build:legacy`和配置好的Electron22环境运行`node scripts/legacy-runtime-smoke.cjs`。云端需要隔离显示服务，内存共享受限时为测试进程加`--disable-dev-shm-usage`。
