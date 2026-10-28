# 本轮交接：原版动画与小屋界面

截至 2026-10-29（北京时间）。用户最新要求：停止继续测试和构建，把当前代码提交推送，交给其他 Codex 接手。当前工作在 `preview/original-motion-and-room-ui`，基于 main `5db47c18a649470fda7e41341cbd1c8f3c36f630`；版本保持 0.30.10，未创建标签或 Release。

## 已实现

- 三系18段动画保留全部1711帧／24fps／固定配准，清除原运行时紫色道具占位。根因是导出缓存仅检查数量；现按 SWF、导出器、帧配置及清除 ID 指纹刷新。
- 九个小屋入口使用不同图标，新增原商城、学院、齿轮导出；进入摩尔庄园按钮在布置小屋左侧，通过固定白名单 IPC 打开 https://mole.61.com/ 。
- 回忆提取为 PetDiary，照料日记在上、计时记录在下，独立折叠和键盘展开。用户提到“即时记录”，实现沿用已有产品名称“计时记录”。
- 阶段、任意神力形态、自动成长／手动固定模式统一移到成长，沿用确认、进度保存和活动取消规则；设置不再重复显示。睡觉按钮使用原睡眠图标。
- 15个小游戏事件映射12段原 MP3（51KB），无合成游戏提示音回退；集中管理音量、静音、隐藏和退出的音频释放。照料／提醒音频仍是原有独立实现。
- 高级、经典三金叶超级、神力金冠超级补齐原正面／左右完整可见飞行循环；高级使用原8片叶冠分层，横向拖速和摸头驱动连续转速。整体身体不跟随叶冠旋转。
- 经典超级拉姆睡觉不再误播食物动作，使用自己的身体、金叶、原眼睑与嘴型，睡眠和小嘴照料属于桌宠适配。

## 来源与复现

公开原客户端存档 [Miigon/RecMoleRes](https://github.com/Miigon/RecMoleRes/tree/7a6d6b3c7037a85afb28ad6abd4d7f4adfddb5ff)，并不代表获得官方授权。

- 飞行源 SWF 与哈希：`research/references/original-flight/sources.json`。`lamubone.swf` sprite1777／2525，`pet101/skill_7.swf` sprite940。输出 `public/assets/original/flight/runtime.json` 保留 sourceFrame、空控制帧、配准、全部8片原叶冠。导出脚本 `scripts/art/export-flight-rig.py`。
- 图标：`public/assets/original/room-icons/sources.json`；ui.swf 6868 mall_btn、6917 class_btn、6882 quality_mc。
- 原音频：`public/assets/original/game-audio/sources.json` 含源路径／源哈希／soundId／符号／MP3哈希；来自 lib1、CullFruit、BeatsMain、TreasureHunt 的原 MP3 流，未重新编码。
- 三系：`scripts/art/export-desktop-elements.py`、`public/assets/original/element-skills/clips.json`；`SourceExporter.java` 支持声音导出、XML回写、完整帧。
- 经典睡眠／小嘴：`scripts/art/export-slumber.py --forms classic [--awake]`，对应 slumber、gentle-care 的 source.json／checksums。
- 本环境导出工具 `/workspace/mole-art-tools/export-swf`；Java编译需 `java -m jdk.compiler/com.sun.tools.javac.Main`（没有 javac 命令）。临时来源 `/tmp/mole-room-motion-sources`，外部存档 `/workspace/mole-original-resources`。这些绝对路径只用于开发，不参与客户端运行。

参考观察：
1. 轮廓：原角色圆短身体、长眼白、层叠叶冠；复用原图形，未重画角色。
2. 形状：原8片不等长叶片有透视，不能用几何等分扇叶代替。
3. 色面：原素材大块明亮色，深色短阴影；四种角色颜色仍由独立遮罩复用。
4. 高光：保留原眼白、眼珠与叶片高光，不增加写实体积光。
5. 空间：原小屋、UI、道具参考已实际看图；1180×820／1000×720 检查头部按钮、九个入口和折叠卡片。

## 已验证与尚未完成的验证

- 最新 Vitest 42文件、366测试通过（含原帧覆盖、MP3哈希、叶冠8片、紫色结尾像素检查、音频生命周期、转速模型）。Node119测试另行全部通过；第一次沙箱 Git 子进程 EPERM，沙箱外重跑通过。
- 此前 `npx tsc -b` 和现代生产构建通过（850张图片优化并检查alpha／可见像素）；最后增加 data-direction 诊断属性后未再次构建。用户明确要求无需继续构建。
- 成长设置专项浏览器回归通过。新增小屋浏览器回归首轮通过：九图标、官网、折叠、阶段迁移、睡觉图标、摸头加速；实际慢拖约0.391转/秒、快拖约1.001转/秒。
- 首轮真实桌面小屋回归在最后的预览画像等待失败：错误地只选择 ram-classic-frame，遗漏种子 seed-body-frame。已改成阶段画像中全部非服装Canvas，但修复后的完整桌面回归尚未重跑。不要把该次桌面回归记为通过。
- 完整浏览器回归已跑过照料、桌面拖动、外出、原瞳孔、备份及课程／18法术／计时流程，用户要求停止时未跑完整套最终断言，因此不能标记整套通过。
- 最新截图等待器修正后的浏览器复跑、完整桌面回归、Electron22兼容运行、完整动作录屏、经典超级睡眠／照料实际画面复核尚待接手。测试脚本已保留。
- 原音频实际解码／播放审查脚本已改写，但这次启动时审查服务器5230未启动，ERR_CONNECTION_REFUSED；尚无实际播放通过凭证。可先启动Vite5230，再运行 `node scripts/review-game-audio.cjs`。
- `OriginalFlightFrames` 的 data-row 现在是真实图集行，原方向断言已改用 data-direction，尚未重跑相应桌面巡游断言。
- 本轮截图位于 `docs/previews/original-room/`（小屋、回忆、高级静态）；没有把尚未完成的录屏或未复查的动作当作正式效果。

## 接手建议

用户当前只要求提交推送，停止后续构建测试。接手后先确认用户接下来安排。若继续验证，可运行 `npm test`、`node scripts/original-room-regression.cjs --dev`、`node scripts/growth-settings-regression.cjs --dev` 和生产后的 `node scripts/desktop-smoke.cjs --original-room-only`；全面回归入口为 `--fixes-only`／`scripts/compact-care-regression.cjs`。云环境 Chromium／Git 测试可能需要沙箱外运行；真实桌面测试一次只运行一个。

本轮尚未发版。遵守 AGENTS.md 的具体预览确认流程，不将预览分支直接推进 latest。
