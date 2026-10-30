# 安卓手机与平板预览

安卓实现已随 v0.31.9 合入主线，沿用现有 React 游戏与原版动作帧，原生宿主使用 Java / Android WebView。安卓使用独立的预览更新渠道，桌面版更新清单保持隔离；普通分支构建只生成测试产物，正式标签在六平台验收通过后发布。

## 下载与使用

直接[下载 v0.31.9 固定签名 APK](https://github.com/Vinci-217/mole-baby/releases/download/v0.31.9/mole-baby-android-1310900.apk)，传到手机后按系统提示允许此来源并安装。包名 `com.molebaby.ramu.preview`，固定签名支持后续覆盖升级并保留存档。

此前 Actions 中的 `mole-baby-android-preview-dev.apk` 是开发包，包名带 `.dev`，与固定签名版独立。请先在旧包导出存档，再到预览版导入；不同 CI 构建的开发签名可能不同，开发包不作为公开更新渠道。

- Android 8.0 及以上；手机、安卓平板均可。Android System WebView / Chrome 需要 108 或更新版本（布局使用动态视口尺寸）；版本过旧时会提示升级。
- 第一次打开先解压原版素材，有进度提示。首次 APK 约 531 MiB，解压素材约 534 MiB，建议至少预留 2 GiB 可用空间，供安装和解压临时文件使用；差量更新减少后续下载，不会减少首次安装的素材总量。
- 默认进入小屋。点击“悬浮陪伴”，按引导允许“显示在其他应用上层”，再点击一次即可进入悬浮模式。
- 通知栏可回小屋、恢复触摸、开关音乐、结束陪伴。触摸穿透后请从通知栏恢复。
- 课程、打工和专注提醒需要通知权限。允许精确闹钟后更准时；未允许时使用系统可用的普通闹钟。系统省电、强制停止及厂商后台管理仍可能延迟提醒。
- 小屋设置支持导入、导出桌面版 JSON 存档。自定义音乐使用系统文件选择器，存放在本机。

## 已接入的功能

| 功能 | 安卓实现 |
| --- | --- |
| 四色领养、起名、五阶段和神力形态 | 共用现有游戏逻辑和存档格式 |
| 状态、喂养、喝水、清洁、药水、商店和背包 | 共用道具、数值、即时使用和逐帧动作 |
| 衣橱、装扮、小屋布置、场景和时间变化 | 共用现有素材与场景逻辑，适配触摸布局 |
| 学院、三分钟课程、证书、魔法、餐厅打工 | 共用开始 / 截止时间和一次性结算逻辑；系统通知只提醒，不另发奖励 |
| 小屋小游戏、调色药水、签到与回忆 | 保留现有玩法；界面按手机、平板调整 |
| 悬浮陪伴 | 系统悬浮窗，复用同一个 WebView，不重复启动一只宠物 |
| 拖动、惯性、小幅散步、四边收纳和探头 | 原生窗口移动 + 原有动作帧与拖动反馈；种子允许手动拖动 |
| 触摸穿透 | 默认关闭，Android 12+ 使用低于系统遮挡阈值的透明度，并提供通知恢复入口 |
| 音效、配乐和可选后台播放 | 共用本机音频；后台音乐使用前台服务和音频焦点 |
| 专注计时 | 手动开始，持久化截止时间，支持恢复及通知去重 |
| 桌面小组件 | 名字、状态、回小屋和打开背包；不在小组件中另跑养成或发奖励 |
| 更新 | 独立安卓清单、APK / 素材差量、完整下载回退、取消、校验、缓存恢复及系统安装确认 |

这张表表示代码接入范围。构建、单元测试、浏览器测试和设备测试的结果应分别核对，不能据此推断所有品牌手机均已实测。

## 更新策略

安卓渠道为 [`android-preview`](https://github.com/Vinci-217/mole-baby/releases/tag/android-preview)，入口是该 Release 下的 `latest-android.json`。v0.31.9 首次公开固定签名渠道，没有更早的公开安卓基线；受控安装／差量测试不等于已验证任意未来公开版本之间的升级。

1. 启动约 8 秒后检查，可在设置中关闭。Wi-Fi 自动下载默认关闭；开启后仅在非计费 Wi-Fi 下载。
2. APK 升级比较新旧 blockmap v2，复用已安装 APK 的相同块。新清单包含最多 12 个历史基线，因此允许跨版本升级。缺少基线、变化过大或不支持 Range 时完整下载。
3. 素材包也有 blockmap。首次差量可直接读取 APK 内 ZIP 对应的字节区间，不额外复制旧 ZIP。素材只允许图片、音频、字体和数据，不允许下载替换 JS、HTML、DEX 或本机代码。
4. 每个下载包均核对长度和 SHA-256；APK 还核对包名、更高的 versionCode 和当前安装签名。素材逐文件校验，并核对原生版本范围及 rendererHash；不匹配时要求更新 APK。
5. 下载可取消；失败不替换正在使用的文件。确认更新后先保存存档，素材使用临时目录及原子切换，APK 交给 Android 系统安装器。
6. APK 安装必须由用户确认“允许此来源”及系统安装提示。普通安卓应用不能静默覆盖安装自己。
7. 下载中的前台通知显示进度，并可取消。系统终止应用后，已校验完整包可以恢复使用；未完成下载会重新开始选择差量或完整下载。

公开更新还需要固定签名。`android/app/build.gradle` 已接入 `MOLE_ANDROID_KEYSTORE`、`MOLE_ANDROID_STORE_PASSWORD`、`MOLE_ANDROID_KEY_ALIAS`、`MOLE_ANDROID_KEY_PASSWORD`。私钥与密码不能提交仓库。开发包的临时签名不应用于正式渠道。

CI 从 GitHub Actions Secrets 读取 `ANDROID_PREVIEW_KEYSTORE_BASE64`、`ANDROID_PREVIEW_STORE_PASSWORD`，以及可选的 `ANDROID_PREVIEW_KEY_PASSWORD`；别名由仓库变量 `ANDROID_PREVIEW_KEY_ALIAS` 指定，默认 `mole-preview`。未配置时分支只能生成开发包；正式版本标签缺少固定签名会直接失败。固定密钥需要长期备份，后续版本保持同一签名。

正式标签依赖全部桌面和安卓检查。安卓还会安装固定签名的 release APK、真实点击领养，再安装更高 versionCode 的同签名夹具，检查名字和小屋控件保留；该夹具不发布。通过后先上传 APK、素材及索引，最后上传清单，安卓渠道保持 prerelease／非 latest。

生成更新产物（只生成文件，不发布）：

```sh
npm run android:manifest -- --apk android/app/build/outputs/apk/release/app-release.apk --previous previous-android.json
```

首次构建可以省略 `--previous`；也可用 `--fetch-previous` 从既有安卓渠道读取历史基线。上传 APK、素材包、索引、blockmap 后，最后更新渠道清单，避免客户端先看到不存在的文件。保留清单引用的历史 blockmap，后续版本才可以跨版本复用。

**只有用户确认后才发布安卓渠道。** `android-preview` Release 必须是 prerelease，并设置 `--latest=false`，避免推进桌面版的 GitHub latest。桌面版的 `latest.yml` / `latest-mac.yml` 不参与安卓更新。

## 本地构建

需要 Node.js 22、Python 3、完整 JDK 21、Android SDK Platform 36 / Build Tools 36.0.0 / Platform Tools。设置 `ANDROID_HOME` 或在 `android/local.properties` 指定 SDK。

```sh
npm ci
npm run android:build
```

输出：`android/app/build/outputs/apk/debug/app-debug.apk`。Gradle Wrapper 固定为 8.13，并校验官方分发文件 SHA-256。

单独执行安卓检查：

```sh
cd android
./gradlew testDebugUnitTest lintDebug assembleDebugAndroidTest
```

Windows 使用 `gradlew.bat`。构建所需的 JDK / SDK、私钥、生成的素材和 APK 均不提交 Git。

云环境可使用 `node scripts/android/gradle.cjs testDebugUnitTest lintDebug`：自动识别本项目已有的 JDK / SDK 缓存，并沿用平台代理与受信 CA，保持 TLS 校验开启，不读取或打印代理凭据。

## 工程边界与验证

- `RamuHost` 维护唯一 WebView，小屋 Activity 与悬浮 Service 只移动同一个实例；`MutableContextWrapper` 在小屋提供正确的窗口上下文。
- 前端先从原生私有存储恢复快照，再挂载 React。localStorage 写入同步镜像到原生存储，系统文件选择器负责备份；更新前执行存档握手。
- 仅允许加载 APK 内代码与经过校验的本机素材，JavaScript Bridge 是固定方法白名单，不开放任意文件路径、服务器或命令。
- 手机动作图集使用较小的上色缓存，保留帧数、帧顺序、动作时长与位置注册信息；桌面画面不使用此降采样。
- JVM 测试覆盖真实 HTTP 206 重建、服务器忽略 Range、损坏基线、取消、不完整响应、错误哈希、恶意清单和压缩包越界等。
- 浏览器测试覆盖手机 / 平板布局、领养、背包、商店、课程、游戏入口、计时和返回。
- CI 的 Android 模拟器脚本检查原生 WebView、小屋 / 悬浮往返、种子拖动收纳、恢复触摸，并实际安装更高版本 APK 后核对原生和网页存档。
- 原生测试结束后，复用工程已有的 `build-reports` 分支记录日志与测试截图，路径为 `reports/jobs/<源代码 SHA>/android.json`。Actions API 不可用时仍可通过 Git 核对这份记录；失败或缺失的记录不能解释为通过。
- 模拟器通过不等于真机通过。发布前仍需在目标品牌设备验证悬浮窗、触摸穿透、长时间后台、来电音频中断和用户点击系统安装器的完整流程。

## 本轮接手验收（2026-10-30）

已修复通知栏回小屋时的特效／背包锚点恢复、手机横屏地面无法点击及提示气泡遮挡。v0.31.8 预发布检查通过，但正式候选发现长按被当作右键误开背包、阻止收纳，因此没有公开。v0.31.9 修复该问题并增加移动浏览器菜单和实际手指长按检查；发布仍要求完整 Android 15 模拟器流程、固定签名 APK 更高版本覆盖安装与存档保留全部成功。此前受控 APK 差量测试复用约 556 MB 数据，下载约 256 KB，不能据此保证每次升级的下载量。

[v0.31.9 发布与签名验证](../research/release-0.31.9-validation.md) · [接手修复与早期验证范围](../research/android-takeover-validation.md)。
