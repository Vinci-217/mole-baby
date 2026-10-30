# v0.31.10 验证记录

用户要求修复桌面涂鸦大小异常，自测后重新发布并附带固定签名安卓预览版。v0.31.8 在正式验收发现 Android 长按误开背包，未发布；v0.31.9 修复后安卓正式验收成功，但兼容 Windows 32 位的安装器自动测试因导航竞态被阻止。保留两个候选标签，以 v0.31.10 完成同一轮交付。

## 改动与验证

沿用已验证的涂鸦第一帧身体比例校准、背包分类同步、Android 旋转／悬浮恢复及长按菜单修复。[涂鸦原始问题与 64 组 DPR 验证](release-0.31.8-validation.md)、[Android 长按复现／修复及固定签名覆盖升级](release-0.31.9-validation.md)。所有原始帧与图集保留。

v0.31.10 的应用代码和素材与 v0.31.9 相同，新增改动仅为版本／文档，以及安装器自动化脚本：Install 只发送一次，之后等待 Finish，避免误点转换中仍显示 Next 的共享按钮。四分钟等待上限、真实 Finish、目录、完整素材哈希、隐藏向导和实际启动断言全部保留，失败时增加进程／文件／按钮状态诊断。完整六平台验收仍为发布必要条件。

本地应用验证沿用 v0.31.9 的 540 项检查、生产构建、无损像素校验、四种移动布局及真实 Electron 右键检查；发布流程会按 v0.31.10 重新构建和验收所有平台。[本地记录](release-0.31.9-local-checks.json)。

正式发布结果、公开附件校验和固定签名指纹在成功后追加。安卓最低 Android 8、WebView 108；模拟器验收不代表所有品牌的后台、来电和锁屏行为均已实测。Mac 为本地签名，未 Apple 公证；旧系统兼容检查不冒称已覆盖实体 Windows 7。

## 正式六平台验收

不可变源提交为 `d84ea32f61b00372426b805e7f4722f977d07903`。[正式流程](https://github.com/Vinci-217/mole-baby/actions/runs/41038156962)的 Windows 常规版、兼容 x64／ia32、Mac ARM／Intel、Android 均已通过。[原生结果摘要](release-0.31.10-native-checks.json)与[本地源一致性记录](release-0.31.10-local-checks.json)保留具体检查范围。

三个 Windows 包均观察到真实 Finish 页面，点击后向导隐藏且安装目录中的应用可见启动，完整原版素材校验通过；32 位安装器导航竞态修复得到实际验收。Windows 常规版另行通过真实 NSIS 差量下载、校验、分别确认下载／安装和存档保留检查。

Mac 首次 Intel 打包因 `hdiutil` 无法卸载临时磁盘（resource busy）失败。其他五个平台通过，单独的[受限维护作业](https://github.com/Vinci-217/mole-baby/actions/runs/41039773039)只重试失败的 Mac 作业及其依赖，保留成功产物、相同标签和源提交。第二次 Intel Mac 打包、签名／镜像检查、完整原生交互及真实公开 DMG 下载／校验／挂载均通过。[首次错误与一次性重试记录](release-0.31.10-mac-retry.json)。没有改写标签或减少验证。

Android 再次通过真实手指长按、旋转收纳、通知恢复、小屋往返与实际 APK 差量重建。固定签名 release APK 实际领养后覆盖安装更高 versionCode，名字与小屋控件保留。测试夹具不对外发布。

## 正式发布与公开下载

[v0.31.10 已公开发布](https://github.com/Vinci-217/mole-baby/releases/tag/v0.31.10)，桌面 latest 清单实际 GET 返回 `0.31.10`。独立的 [android-preview](https://github.com/Vinci-217/mole-baby/releases/tag/android-preview) 保持 Pre-release，没有抢占桌面 latest。[正式回执](release-0.31.10-receipt.json)的版本、源提交、六个平台组和发布结果均核对成功。

[公开附件校验](release-0.31.10-public-checks.json)核对 29 个上传文件的公开 SHA256 信息，十个桌面大包的上传哈希与正式构建回执一致；实际下载四份更新清单及 blockmap／帮助／信任元数据并核对校验值。大包使用 HEAD 长度和 GitHub 已上传文件的 SHA256 交叉核对，没有把这些步骤说成重新下载所有大包；完整文件字节已在 CI 校验。

公开安卓 APK 为 `mole-baby-android-1311000.apk`，版本 `0.31.10`，固定包名 `com.molebaby.ramu.preview`。版本页和独立渠道的 APK 长度一致，公开文件上传摘要、清单、资源描述与 sidecar 哈希一致。签名证书 SHA256 与本轮保留的私钥备份所对应的公开证书匹配；私钥和密码没有进入仓库。固定签名覆盖升级结果见原生记录。资源清单先校验、最后发布，系统安装仍需用户确认。

同步 main 时仅追加文档与验证记录，应用代码、版本、素材和构建／测试脚本与已通过的 v0.31.10 标签保持一致。
