# 原版道具动作与 Windows 测试包

## 本轮动作规则

道具与衣服分开选择。初级、中级、高级分别使用原客户端 `pet2`、`pet3`、`pet4` 的完整动作；经典超级拉姆、神力拉姆、水系、火系、木系统一使用 `pet101`。种子期不开放道具玩耍。

覆盖足球、逗逗一/二/三、弹簧、乐刷刷、泡泡糖、涂鸦一/二/三/四，共 11 种道具、44 份原 SWF。菜单、快捷玩球、自主玩耍和旧动作 ID 都通过同一套规则匹配，不再依据衣服自带的初级外观来决定道具阶段。

穿衣时暂停并暂时隐藏原装扮播放器，直接播放实际成长阶段的原道具动作，完成或取消后恢复原装扮。保存的衣服、成长、颜色、衣橱和记忆不会被修改。走路、摸头、拖动等基础穿衣动作继续沿用原有装扮与适配机制。

40 份动作沿用已有的原 SWF 完整帧导出，逐份核对导出记录的 `sourceSha256` 与打包原 SWF 哈希一致；不是重新绘制或用衣服加道具图标编排动作。泡泡糖的 4 个阶段继续直接播放原 SWF。原文件、完整帧数和分辨率没有为提速而更改。

## 加载优化

- 原服装播放器在道具动作期间保持挂载并暂停，恢复服装时复用它，避免重新初始化引擎。
- 道具的悬停、键盘聚焦和触控预热现在也适用于穿衣状态。衣橱同样预读被指向的本地原片，复用协议或 HTTP 缓存；不批量下载或初始化整个衣橱。
- 图集着色用 256 级权重查表，保留原计算顺序和最终像素；分段让出主线程的策略不变。
- 着色当前图集时只提前解码下一页，避免串行等待，同时限制解码并发。
- 原装扮首次加载与切换姿态期间更快检查就绪；就绪后的检查频率保持原状。

同一浏览器对一张 2048×2048 原涂鸦图集进行 5 次对照，旧算法中位耗时 78.8ms，查表算法 23.2ms，全部输出字节一致。这是着色计算的本机对照，不能等同于完整动作或网络加载提速比例。首次引擎编译、图集解码仍需要时间。

## 验证

- 72 个前端测试文件、510 项测试通过；全套桌面/更新/打包 Node 测试 190 项通过，包括打包新增分支的 5 项专项检查。
- 核对全部 44 个原 SWF 的 SHA-256，并验证 40 份完整帧导出的来源与时间轴。
- 浏览器逐项实际播放 8 种成年形态 × 11 种道具，共 88 组；检查正确来源、实际图像、帧推进、装扮暂停和同一播放器恢复。没有页面异常或素材请求失败。
- 原服装播放器保持不变的恢复检查约 28～43ms；这表示本机界面恢复，不代表冷启动或所有设备的速度。
- 真实 Linux Electron 专项 9 项通过，包括摸头、拖动后的晕眩、原版经典超拉足球、三系魔法、变盒子、中断、恢复衣服与重新加载后保存属性不变。
- 8 种成年形态的变盒子与 16 段完整涂鸦显示回归通过；缓存动作重播检查约 27ms。与构建同时运行时，首次大图准备仍有数秒等待，未宣称首次加载完全没有延迟。

证据位于 `artifacts/original-tools-review/`、`artifacts/animation-repair/original-tools-*.log` 和 `artifacts/windows-build/`。沿用独立 QA 档案，不重置玩家记录。

```sh
npm test
node scripts/original-tools-regression.cjs
node scripts/tint-performance-review.cjs
node scripts/visual-bounds-regression.cjs
xvfb-run -a -s '-screen 0 1920x1200x24' node scripts/animation-repair-regression.cjs --native --quick
node --test scripts/package-windows.node-test.cjs
node scripts/build-windows-preview.cjs --installer-only
node scripts/prepare-windows-download.cjs
node scripts/windows-download-regression.cjs
```

## Windows 测试交付

输出 `release/windows-preview/mole-baby-0.33.3-windows-test-Setup.exe`。这是本轮重新构建的 Windows 10/11 x64 本地测试安装版，包含全套运行素材，不依赖在线补齐动画。沿用原应用标识与存档位置，测试包关闭自动更新，不创建 GitHub Release 或推进 latest 渠道。

完整性、文件大小和资源清单以同目录的 `windows-test-report.json` 与 `SHA256SUMS-windows-test.txt` 为准，下载后实际字节检查见 `artifacts/windows-build/download-regression.json`。安装包在 Linux 云电脑交叉构建，原生 Windows 安装、系统权限与快捷方式体验仍由 Windows 实机确认。

最终包 672,686,189 字节（约 641.52 MiB），SHA-256 为 `4c868e0bf2a5e86f3d568f8782bd0411c058e787539139ccf447bb3831d5b688`。包含 4,316 个运行文件、567 个原 SWF；资源哈希、PE、NSIS 启动及容器 CRC 均通过。真实浏览器完整保存后的 SHA-256 与此值一致，断网重开续传、截断/损坏分段重试以及损坏缓存拒绝保存测试全部通过。

本次按需只构建安装包，省去便携 ZIP 的额外压缩与磁盘副本；默认通用构建仍保留安装包加 ZIP。构建时清理了可重新生成的旧测试包、网页 ZIP 和上一轮下载分段，保留原素材库、QA 档案和全部玩家记录。下载入口完成后使用新包重新生成分段与校验清单。

云电脑磁盘空间不足时，NSIS 曾中断生成安装器；这些不完整的 EXE 没有交付。进一步确认当前 Linux makensis 的中间文件使用硬编码 `/tmp/mak…`，仅设置 `TMPDIR` 无法迁移这部分临时占用。续建时将已封装的 7z 输入逐字节哈希验证后暂存到 `/dev/shm`，给磁盘上的 NSIS 中间文件与最终 EXE 留出空间；完整原应用和输入内容不变。封装成功后清理这份临时输入，最终仍验证安装器 CRC 和资源哈希。
