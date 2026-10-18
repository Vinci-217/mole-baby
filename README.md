# 拉姆陪伴 · 下一版预览

让熟悉的拉姆回到你的 Windows 桌面：轻轻摸一下、喂点食物，忙的时候让它安静地陪着你。支持 Windows 10/11 x64，使用 Electron + React + TypeScript，本地运行，无需账号或 API 密钥。

当前分支为 [`next/art-direction`](https://github.com/Vinci-217/mole-baby/tree/next/art-direction)，版本 `0.4.0-dev.1`，用于下一版美术迭代，尚未发布 Release。先试用已发布的 [v0.3.0](https://github.com/Vinci-217/mole-baby/releases/tag/v0.3.0)：该版本已在 GitHub Actions 的 Windows 运行器完成构建、产物校验和应用启动检查。

![桌面陪伴预览](artifacts/v3-native-pet.png)

## 开始使用

Windows 版本下载：[GitHub Releases · v0.3.0](https://github.com/Vinci-217/mole-baby/releases/tag/v0.3.0)。选择 `RamuHouse-0.3.0-x64.zip` 便携包，或 `RamuHouse-0.3.0-Setup.exe` 安装包。**完整解压**压缩包，打开其中的 **`拉姆陪伴.exe`**；保留同目录的其他文件。

第一次打开时，选择粉红、黄色、天蓝或红色拉姆，为它起个名字。默认领养熟悉的**两叶中级拉姆**，也可以选“从幼体开始养”。完成领养后，它会自动进入透明桌面窗口；已有存档时，启动也会回到桌面陪伴。

- **轻点拉姆**：摸摸它，看看它的反应。
- **按住拉姆拖动**：把它放到桌面的合适位置。
- **鼠标移近或右键**：打开喂食、洗澡、休息、对话和小游戏入口。
- **安静陪伴**：默认开启；也可以让它偶尔主动打招呼。
- **桌面散步**：在菜单或设置中开启，拉姆会隔一会儿走一小段，不主动抢焦点；睡眠时停止散步。
- **陪我专注**：开始 25 分钟计时，结束时提醒休息。
- **打开拉姆的家**：查看完整状态、食物口袋、成长手册和设置，再点“回到桌面陪我”继续陪伴。

从源码启动需要 Node.js 22 或 24，在仓库目录运行：

```powershell
npm ci
npm run desktop:dev
```

这是带热更新的桌面开发模式。使用构建后的界面启动 Electron：

```powershell
npm run desktop
```

## 下一版画面预览

本分支新增“晨光树洞书桌”背景：先对照原页游场景、UI 和道具，提炼大色块、深棕勾线、简化比例与活动留白，再用图片工具生成并修订新场景。它是参考原画风创作的新图，不是原客户端素材，也没有训练专用模型。

这套流程已整理为可复用的 [mole-classic-art skill](skills/mole-classic-art/SKILL.md)，包含[视觉参考规则](skills/mole-classic-art/references/style-guide.md)和[生成提示词模板](skills/mole-classic-art/references/prompt-templates.md)。本次生成记录见 [generation-record.json](public/assets/generated/generation-record.json)。

![下一版晨光树洞书桌预览](artifacts/v4-home.png)

拉姆本体继续使用原图集，原 UI 与照料道具也继续复用。后续背景、UI、图标与标识可以原创，也可以与已有素材混用；重点是同屏的画风协调，不要求完整照搬原房间或原面板。该预览不影响已经发布的 v0.3.0 下载包。

## v0.3.0 已发布版本

v0.3.0 的角色、小屋、面板、按钮和道具采用原页游素材导出的 PNG，该版本移除了此前生成的场景、图标与高清重绘。原版图集按原客户端的身体配色规则还原粉红、黄色、天蓝、红色；形态包括无叶初级、两叶中级与扇叶高级。

背景来自原家具资源“拉姆小屋”（160081）。界面使用原拉姆面板的橙黄边框、白底、胶囊按钮、状态条和道具格。可可果、熊熊饼干、浆果果汁、泡泡浴、运动足球等直接使用原道具 PNG。素材地址、原 SWF 编号、导出方式和校验记录见 [ASSETS.md](ASSETS.md)。

桌面窗口布局、交互和小游戏逻辑为本项目实现，成长速度及奖励按桌宠玩法调整。种子期暂用原初级幼体，不伪造独立的原版种子期画面。

![原版拉姆小屋](artifacts/v3-home.png)

## 照料、成长与小游戏

拉姆有饱食、心情、清洁、活力四项状态。可以喂普通食物、摸摸、洗澡、睡觉和唤醒，也能用“心情翻译”进行基础对话。对话由本地规则生成，不接入在线 AI。

初始赠送 **100 摩尔豆、5 份可可果、3 份熊熊饼干、2 份浆果果汁**。成长阶段为：

| 阶段 | 成长值门槛 | 原版画面 |
| --- | ---: | --- |
| 种子期 | 0 | 复用初级幼体 |
| 初级拉姆 | 60 | 无叶幼体 |
| 中级拉姆 | 180 | 两片嫩叶；默认领养起点 |
| 高级拉姆 | 420 | 展开的扇叶 |

选择从幼体养起会从 0 成长开始。照料和游戏会增加成长值；健康且清醒时，每小时最多获得 18 点自然成长。超级拉姆没有被计入普通成长阶段。成长速度、状态数值和奖励是本桌宠的玩法调整。

- **拉姆接果子**：20 秒移动拉姆接可可果，支持鼠标、触屏与左右方向键。
- **口袋翻翻乐**：45 秒内寻找 6 对图案，开局有 3 秒记忆预览，支持点击和键盘操作。

两款游戏满分均为 10 分，翻牌按完成配对的比例折算。完成一局奖励 `4 + 得分 × 2` 摩尔豆、1 份食物和 `3 + 得分` 成长值。提前退出不领奖，结算有重复领取保护。摩尔豆可在食物口袋购买食物。

离线最多计算 24 小时的状态变化，拉姆不会死亡。睡觉恢复活力；睡着时先唤醒它，再喂食或玩游戏。

## 存档与设置

进度自动保存在本机。设置中可以改名、调整安静陪伴和互动音效、导入或导出 JSON 存档。

v0.3 保留原有 `ramu-house-save-v1` 存储键与 `version: 1` 存档结构，兼容 v0.1、v0.2 的宠物进度。可可果沿用旧食物 ID `berry`，原先的库存会保留下来。新陪伴偏好单独保存。

Electron 的数据位于应用用户数据目录；网页开发版与桌面版使用各自的存储空间。换电脑、迁移运行方式或清理应用数据前，可以从“陪伴设置”导出存档，再在新环境导入。“重新领养”会替换当前进度，界面提供先导出存档的入口。

## 开发与验证

```bash
npm run dev                     # 网页开发；桌面原生能力需要 Electron
npm run build                   # TypeScript 检查与生产构建
npm test                        # 养成、离线计算、库存和存档单元测试
npx playwright install chromium # 浏览器测试首次运行时安装
npm run test:browser             # 完整交互与两款小游戏的浏览器验证
```

浏览器测试使用独立测试档案，并自动启动和关闭 5174 端口的 Vite 服务；日常开发端口为 5173。测试可使用系统 Chromium，也支持通过 `CHROMIUM_PATH` 指定浏览器路径。

网页模式提供桌面陪伴预览；真实透明窗口、屏幕位置移动和桌面散步由 Electron 实现。上面的桌面预览图用于展示交互布局。

v0.3.0 已通过 TypeScript 生产构建、40 项养成/存档逻辑测试、浏览器完整流程，以及 Linux Electron 原生窗口验证；其 GitHub Actions Windows 构建也已成功，生成 ZIP 与 NSIS 安装器，并完成包内运行文件校验和应用启动检查。CI 中的启动检查不替代你在自己 Windows 桌面上的试用；上述已发布版本的验证结论也不自动代表本分支每个后续改动均已验证。

[Windows 构建记录](https://github.com/Vinci-217/mole-baby/actions/workflows/windows-build.yml)：推送 `main` 或 `next/art-direction`、Pull Request 和手动运行会生成 Actions 构建产物；`v*` 版本标签构建成功后自动发布到 GitHub Releases。发布附件含 SHA256SUMS，可用于校验下载文件。标签发布的构建结果也记录在独立的 `build-reports` 分支。

下一版美术在 `next/art-direction` 独立分支开发；版本标签固定对应可试用的源码，不会随迭代修改。本预览尚未发布 v0.4 Release，稳定下载仍使用上方 v0.3.0 链接。

云端 Electron 原生交互检查使用独立测试档案，执行：

```bash
npm run test:desktop:cloud
```

该脚本仅用于此 Linux 云环境，会启动需要的虚拟显示与窗口管理器，验证原版 PNG 的生产 `file://` 读取、自动悬浮、拖动与动作、散步、面板、置顶、最小化/恢复和存档。测试参数与字体适配只用于云容器，Windows 正式应用保持 renderer sandbox。

## Windows 打包

```powershell
npm run dist:win:portable # 生成 Windows x64 ZIP
npm run dist:win          # 生成 Windows NSIS 安装器
```

输出位于 `release/`，文件名带当前 `package.json` 的版本号。已发布的稳定便携包为 `RamuHouse-0.3.0-x64.zip`；在本分支自行打出的预览包不等同于 GitHub Releases 已发布版本。

Windows 安装器由 GitHub Actions 的 Windows 运行器构建，也可在 Windows 执行上面的打包命令。当前应用没有代码签名；已完成 Windows CI 启动检查，仍需在用户实际桌面环境中试用透明窗口、系统通知和安装流程。

## 代码与素材

- `src/game.ts`：纯函数养成逻辑、时间、成长、库存与存档校验。
- `src/App.tsx`：领养、桌面陪伴、照料面板、对话、设置与存档。
- `src/components/Ram.tsx`：原版 PNG 图集配色、Canvas 动画与同源静态备用图。
- `src/components/`：角色和两个小游戏的交互与画面。
- `electron/`：原生窗口、拖动、散步、提醒与受限 IPC。
- `public/assets/`：本地角色、场景和道具素材，详细来源见 [ASSETS.md](ASSETS.md)。
- `skills/mole-classic-art/`：原页游画风的参考分析、生成流程与复核规则。
- `scripts/smoke.cjs`：浏览器交互验证。

窗口开启 `contextIsolation` 和 renderer sandbox，关闭 Node.js 集成，并限制 IPC 来源。各云任务使用已有的隔离检出目录即可，无需额外创建 Git worktree。

《摩尔庄园》非官方同人桌宠。拉姆角色及原游戏素材权益归原权利方所有。
