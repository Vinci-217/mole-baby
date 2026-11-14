# 动画播放与本地素材

## 安装版的素材位置

桌面安装版包含整个构建目录 `dist/`，包括游戏图片、音频、原始 SWF、动画适配器和播放引擎。普通图集从应用目录读取，隔离的原片播放器通过只读的 `ram-original://` 协议读取安装目录，不需要运行时下载原片。

Android 同样将引擎和游戏素材随 APK 安装。`resources.zip` 是 APK 内的本地资源包，首次启动在应用私有目录解包；这一步不是联网下载。原有存档目录、包名、签名和更新渠道不因此改变。

网页预览从网页地址读取文件，首次访问仍需要网络。浏览器缓存不等于安装版的本地资源，不应承诺网页首次打开也能断网。

`local-assets/` 是开发用原客户端资料库与原件归档，不是应用依赖。它保留在本项目本地，不把十余 GB 的研究资料额外塞进安装包，也不删掉这些原件。

## 构建和打包检查

构建结束会生成 `dist/offline-resources.json`，记录所有最终文件的路径、字节数和 SHA256，并确认 `public/` 中的每一项游戏资源进入安装目录。它是校验清单，不是需要联网下载的素材列表。

```sh
npm run build
node scripts/verify-offline-assets.cjs
```

必须等 `Lossless assets` 汇总和构建退出码 0 后再验证。校验还会逐个比对原 SWF 的原始摘要；Android 资源打包前会自动执行同一检查。桌面包的 `files` 包含整个 `dist/**/*`。

图片继续保留所有原动作帧。构建时的无损编码逐张验证可见 RGBA 与全部透明度一致，不用压缩画质或删帧解决加载问题。

## 播放代码职责

- `Ram.tsx`：统一选择穿衣或普通动作入口。
- `ClothedRam.tsx`：保存已加载的服装播放器，处理临时原形动作和返回服装。
- `RamVisual.tsx`：普通形态、原版足球、图集、阅读和魔法等完整动作。
- `OfficialRamClip.tsx`：原片的加载、状态、重试和隔离通信。
- `OfficialOutfitMotion.tsx`：完整穿衣原片的摸头和拖动适配。
- `UploadedLamuFrames.tsx`：图集解码与逐帧播放，加载计时和播放计时分开。

衣服只有初级原片时，穿上暂显完整初级穿衣外观；真实成长不变。摸头和拖动保持衣服。没有穿衣原片的完整动作使用真实形态的原版动作，结束后恢复同一个服装播放器。隐藏的服装播放器会暂停，避免反复加载引擎和额外绘制。

换到另一件服装、另一种源形态或失败后重试时，会建立新的隔离会话，避免继续调用已经销毁的 AVM 和音频资源。会话退出后拒绝迟到的恢复消息；同一件服装的普通姿势和临时动作仍复用已加载的会话。

摸头手势和拉拽弹性是项目适配，不冒称官方完整动作。原片、原始时间轴和完整图集继续保留。

## 日志导出

试衣间下方、设置中的“动画与素材”均始终显示“导出动画日志”。文件名带导出日期，JSON 中包含 `exportedAt`。

日志最多保留当前会话 80 条加载、切换、重试和错误记录，不包含拉姆名称、玩家存档或服务器地址，不上传。Android 使用系统文件保存界面。旧版未记录的历史错误无法补回。

## 复查入口

```sh
npm test
node scripts/animation-continuity-regression.cjs
node scripts/wardrobe-quality.cjs
node scripts/wardrobe-interaction-regression.cjs
node scripts/wardrobe-gameplay-quality.cjs
node scripts/wardrobe-load-regression.cjs
xvfb-run -a -s '-screen 0 1280x900x24' node scripts/wardrobe-native-quality.cjs
node scripts/record-wardrobe-quality.cjs --continuity
```

独立预览不写玩家存档；实际游戏测试仅使用专用 QA 档案，后续运行复用，不清除档案。Linux Electron 与浏览器的结果不能代替 Windows、macOS、Android 真机验证。
