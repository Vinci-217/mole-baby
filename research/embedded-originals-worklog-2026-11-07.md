# 原版 SWF 接入桌宠：工作记录（进行中）

## 后续：用户要求查看全部新增动图

最终检查已完成：第三版 567/567 GIF 成功，507 项有画面变化、60 项停驻／静态；`check-original-animation-gallery.cjs` 通过全量解码、567 URL、分类计数、搜索／大图／分页、320/393px、离线 HTML、实际 App 原动作开始／自然结束及原紫色和背包保留。新资源节点总计修正 6 项（两庆典、四阶段时空感应），生产增量构建和 TypeScript／相关 4 测试通过。ZIP 位于 `artifacts/拉姆全部原版素材预览.zip`，包含全部567GIF，CRC通过。新 GIF 目录 HTTP 服务在5189（本Agent启动，session30904），只复用已有5173App网站；下一步是一次 artifact publish 后最终回复，不 push/发版。

云电脑上一轮发生资源不足后现已恢复。新需求以完整 GIF 目录和可离线打开的 ZIP 交付，不只给 8 个示例。脚本 `record-all-original-animations.cjs` 每 8 项回收浏览器，分两组互不重叠地录制；输出 `artifacts/all-original-animations/`，最终有效录制版本为 `capture-v3-settled-blue`。前两个试录版本发现身体染色尚未完成时抓帧，已修正并统一重录，最终目录只接受第三版结果。

新增 `build-original-animation-gallery.cjs` 和 `scripts/art/all-original-gallery.html`；完整目录含 567 项，110 件新增衣橱另有筛选，支持分类／搜索／翻页／大图／静态筛选，数据内嵌可直接离线打开。`build-original-animation-overview.cjs` 用原录制帧生成 12 件示例总览 GIF。

逐项录制发现 skillsource/2.swf 与 4.swf 的外壳只触发一次，重播后没有画面；已在 manifest 和 prepare 工具中改选其原导出节点 `2_fla.ctp11_1`（140 帧）。两项需要最后补录；控制器及其他原件均未变。产品代码构建需要在录制后更新，以纳入这两项节点配置。最终应检查全部 GIF、网站及离线打开，并一次发布新 GIF 网站、原 5173 App 网站、ZIP、总览 GIF 和 CSV。没有 push 或发版。

用户当前明确要求：上一轮素材库网页无法预览；确认这些SWF是否进了桌宠，希望把能用的都接入桌宠，并提供GIF和接入清单。当前分支 preview/original-reading-and-debug；禁止本轮未经确认发版/push/latest。此前书本等大量未提交修改保留。不要spawn子agent。

## 已实现

- 资源入口 `scripts/art/prepare-embedded-originals.py`，来源 `local-assets/ram-official-sweep/2026-11-06/`（上轮1290官方SWF），固定原件库从不改写。
- 产品资源 `public/assets/original/official/`：567份SWF、567条manifest、110件新增衣橱，原12件不改ID，总122衣橱项；原件18,843,929字节，另Ruffle0.7.1约10MB。全部源SHA256核对后复制。
- 567分类：outfit122、care251、school109、magic27、transform30、skill27、body1。含静态片段，不可称567完整独立动画。
- 排除3个纯控制模块（无独立画面），仍留研究库：module/lamuPKSys/AnimalSkillControler.swf、resource/lamuPKSys/animalSkill/skillLib/celebrationSkill.swf、eggRainSkill.swf。
- 衣橱使用 `ALL_OUTFITS`，既有 `OUTFITS` 保持12件避免破坏旧导出/回归；新ID original-120xxxx，只扩展normalize白名单，不改save键/位置/version。摩尔豆购买60，只扣一次。种子禁穿；缺原形态时保留收藏、不伪装该形态。
- `src/official-clips.ts` 数据/资格/形态映射。source113、pet5/skill_1和skill_4要按带level标签的导出类选节点，不能只找lamu_mc。
- `OfficialRamClip` 在真实Ram里离线播放，隔离iframe+token/event.source校验；fallback原角色，不留空白。动作16秒或结束按钮，结束恢复旧衣服。原版动作集在桌面足球Play和小屋Play/Games中。
- `EmbeddedRamHarness.as` 独立控制器：复用Ebook编译容器且同长重命名preview_fla避免冲突；四骨骼0/1/2/3同步；108套服装只有petBone3，需要另载lamubone.swf并把服装层挂到身体parent；染色petBody按原petView逻辑，普通body按petBone1。动态TextField姓名占位已移除（否则???）。
- 角色点击mask来自播放器canvas alpha，缩到100x108传parent不可见canvas，沿用既有像素点击检测；不要再用AS BitmapData.draw（ExternalInterface曾返回null，已删）。
- 原生Electron `ram-original://assets/` 只读资源scheme及MIME，保持webSecurity/contextIsolation/sandbox，frame没有Node/desktop桥。App CSP仅新增自有frame，主renderer仍禁eval和远程脚本。
- Android RamuHost新增wasm/swf MIME。
- 游戏音效/音量已通过Ram->OfficialRamClip->runtime接线，App和DesktopCompanion均传gameSound与soundVolume；runtime只在form/dir/moving变化时reset骨骼，声音开关不重启动作。
- 预览路由 `?preview=official`，4格2页8件装扮；care/school/magic分类；`?preview=official&clip=<id>&form=junior` 单项真实Ram播放器。preview不读写存档。最初预览body没合成已修。

## 已验证

- `scripts/audit-embedded-originals.cjs` 全量567来源均成功显示非空alpha（最初570排除3代码库，修复3导出类后567/567）。回执 `artifacts/embedded-originals-audit.jsonl`。脚本按controller+runtime hash缓存；之后runtime只改了音量/pose去重，不改素材/节点/控制器，核心绘制结果仍适用，最终prefs需单独回归。
- 原生Electron37 Linux/Xvfb104真实loadFile和custom scheme通过，紫色#784fb8、穿戴原运动帽、旧wizard-cap/背包/identity保留；frame的window.desktop/require均undefined，mask成功，页面错误0。`artifacts/official-native-checks.json`、`official-native-room.png`。不是Windows/Mac/Android真机测试。
- 首轮构建与第二轮构建通过；1401张PNG无损WebP逐像素验证166.4MB->106.17MB。
- 14个目标Vitest+1原生路径测试通过。全量Vitest已通过（详见 `artifacts/embedded-originals-tests.log`），全量Node初次因desktop-lifecycle mock缺新增protocol对象失败，已补mock，正在重跑Node。

## 当前运行中的工具/服务

- 最终构建（第三次，包含567最终manifest、资格、音量接线）：exec session95376，日志 `artifacts/embedded-originals-final-build.log`，不要再并行写dist；Vite最后closeBundle压图要几分钟。
- 全量Node：session1637，日志 `artifacts/embedded-originals-node-tests.log`。
- Xvfb :104 session70343（自己起的，可以任务末尾Ctrl-C停止）；没有必要kill任何未知监听。
- App网站端口5173已通过tutti ensure，现有artifactId `6d41b660-076a-4793-b8a7-369ba51ba136`；只复用它，命令npm run preview，folderPath项目根。外部URL https://w6guv5owh8gegxq6awlz2vd83a-room-preview-v3.tutti.sh/
- 不要另外开同项目服务器。build写dist后现有5173直接用新产物。
- 本轮尚未调用最终artifact publish，最后一次发布网站+所有GIF/CSV/报告，网站先。原素材库5187本轮未改，不必再发布。

## 仍须完成

1. 等最终构建/Node结束，处理真实失败；不必盲目重跑所有已经过的素材/旧测试。
2. 在最终5173做真实App回归：桌面足球->原版动作集->选择播放/结束，用户颜色/旧memory/owned保留；小屋衣橱购买新增/穿戴->刷新仍在->移除；种子限制、320/393px布局、游戏音效/音量的runtime实际值、mask非空且透明处不点宠物。
3. 录制用户要求的GIF（必须是实际Ram播放器）：建议 `?preview=official` 4格新增装扮第一页8秒+第二页8秒拼一段，另care分类8秒一段。截图已目视new cap/goggles/mask很贴合；旧???已动态TextField移除，应复看最终图。用浏览器截图录，FFmpeg输出到 `artifacts/embedded-originals-review/`；不靠网页预览当作GIF交付。
4. 有条件可另录实际desktop菜单启动的动作，不只独立预览；至少App流程一定验证。
5. 输出完整CSV清单（567来源、类别、名称、app入口、原相对路径、SHA）和110衣橱列表，研究报告写最终行为、数据保护、检查与限制（形态依原件；不宣称全部平台真机，尚未发版）。public/original/official/README来源/适配/Ruffle许可。
6. 原件素材图标：108个原icon由OriginalWardrobeIcons.java渲染，2个服务员无原icon用现有Ram图标。prepare工具目前不自动重做icon，但PNG产品文件齐，原图标导出在local-assets/research/embedded-icons。source.json已567/110，manifest准确。
7. git diff --check，最终资产zip/manifest无缺文件，CSP外部脚本继续阻断（现有renderer-policy-checks可复用）。发布一次现有5173网站+GIFs+CSV(+报告)，最终嵌入GIF并简明说新增哪些，给实际App预览链接。不push、不发版。
