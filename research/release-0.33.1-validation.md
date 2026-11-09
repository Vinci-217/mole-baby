# v0.33.1：神力超拉与显示复核

## 审核状态

用户已经完成本轮审计并授权发版；本地检查通过后将推送 `release/v0.33.1`，由既有多平台流水线创建标签和 GitHub Release。发布前不会直接改动用户存档或自动更新渠道。
本轮实现包含神力超拉图集、导出脚本、显示设置、完整栅格回退资源保留及 Android XAPK 分包产物。
相对于线上 v0.33.0（`aa00515`），候选版累计包含此前已预览但未发布的 8 个本地提交、155 个文件变动。
除下述本次修复外，还包括原版服装加载、摸头和动作回退、点点拉姆装尺寸、透明绘制窗口及神力形态选择修复。

## 本轮修复

神力超拉原文件 `resource/petcloth/swf2/pet101/skill_7.swf` 的 SHA-256 为
`4bcaaba6cc71bb956a2e8617ee016c9d1b3cce405afcb823b0947bd9ba4dfa20`。
其中 shape 41 是中间金色叶片的原姿态，并非普通 `lamubone.swf` 中相同编号的阴影。
旧飞行动作导出器全局排除了编号 41，导致正面第 5/6、15/16 帧的中间叶片消失。
现在按源文件区分排除规则，完整保留神力超拉三方向的 60 张原姿态；源帧编号、循环长度、身体配准和缩放均保持一致。

神力超拉普通看书的书本中心下移 8 个角色坐标百分比（100px 桌宠约 8.6px）。
该调整属于既有日常动作的离线编排，不是魔法书装扮，也不声称是官方独立看书片段。
重新采样并打包神力超拉的摸头、看书、睡觉、看蝴蝶、张望、醒来、头晕共 7 段、768 个时间帧；原 SWF 与素材库原件不变。
阅读预览补齐神力超级拉姆。

此版本还包含 v0.33.0 之后本地审核过的原版服装互动、身体配准、绘制边界、神力形态选择修复，及托盘「仅悬停时显示名字和状态」设置。
新增设置默认关闭，单独保存在现有窗口偏好中。

## 本地验证

- `npm test`：64 个 Vitest 文件、503 项测试和 169 项 Node 测试通过，共 672 项。
- `npm run build`：生产构建完成；918 张 PNG 转为无损 WebP，逐像素验证可见 RGB 和所有 alpha；不再排除可作为动作回退的逐帧图集。
- 新增真实像素回归检查：神力超拉三个方向的每张原姿态都必须包含中间亮黄色叶片，橙色侧叶无法代替其通过检查。
- `scripts/audit-raster-sizes.cjs`：扫描 310 段位图、54,116 个时间帧。两个既有初级涂鸦备用图集的中位身体宽度被标记；应用相应道具使用完整官方 SWF 路径，未按该旧图集重新缩放角色。
- `scripts/record-super-reading-review.cjs`：实际生产组件录制完整看书循环、待机及左右移动；没有页面错误或缺失请求，逐帧检查飞行动作中间叶片的存在。
- `scripts/pet-details-hover-regression.cjs`：在隔离目录复用原“小紫”记录，验证托盘开关、鼠标移入/移出、原生转发鼠标事件、重启偏好、神力看书和阅读时禁止拖动；检查名字、配色、成长、衣橱、物品以及每条旧记忆保留。
- `scripts/audit-rendered-actions.cjs`：9 种形态 × 72 种动作，共 648 个组合，无页面错误，无空白、加载回退或不等比例标记。
- `scripts/audit-element-body-registration.cjs`：9 种形态 × 18 个三系特效，共 162 个组合；每段首帧、中间帧、末帧都检查固定身体比例和实际像素，全部通过。
- `scripts/audit-outfit-pixels.cjs`：稳定构建上完整复跑 122 套服装、406 个服装/形态组合，0 加载失败、0 画布边缘裁切。

### 检查范围与待验证项

首次服装扫描与构建输出写入重叠，空手服务员的 8 种形态出现加载失败；单独复查 8 种形态全部通过，之后完整复跑 406 个组合也全部通过。保留首次失败报告，最终结论使用稳定构建的完整复跑结果。

静态扫描标记的 `junior-tuya1`、`junior-tuya2` 是既有备用位图，当前道具入口使用 `resource/pet/swf/pet2/tuya1.swf` 和 `tuya2.swf` 官方原片；这些标记仍公开保留，没有用外框缩放掩盖问题。
648 个动作组合按播放窗口抽样检查，不等同于人工逐帧审美验收；三系特效检查首、中、末帧，完整位图另有帧表扫描。
预览 GIF 为 14 秒、12fps 的实际录屏，游戏中保留原 24fps 动作数据。

本轮 Windows 现代/兼容版、Mac arm64/x64、Android 成品由发版流水线构建和验证；Android 同时生成标准 APK 与 XAPK（内含字节一致的 APK 和安装清单）。
Windows/Mac 托盘设置另有模拟原生接口测试；实际桌面操作验证运行在云电脑的 Linux Electron 环境，不能代替各平台成品验收。
用户已确认发版；推送后必须通过既有各平台构建、安装包、XAPK 内容和升级存档检查，全部通过后才公开发布。

## 优先审计的代码

| 内容 | 文件与复核点 |
| --- | --- |
| 神力超拉书的位置 | `src/social-motion.ts`：只对神力超拉的书本纵坐标加 8；不改身体比例，不替换成书本装扮 |
| 中间叶片闪烁 | `scripts/art/export-flight-rig.py`：41 号图形按 SWF 来源判断，不再跨文件全局排除 |
| 真实像素回归 | `src/original-room-assets.test.ts`：每个正面/侧面姿态都要求亮黄色中间叶片存在 |
| 日常图集 | `public/assets/original/daily-frames/super-*`、`flight/super-*.png`：完整帧表，缩放及落点不变 |
| 托盘开关 | `electron/main.cjs`、`src/components/DesktopCompanion.tsx`：默认常显；开启时悬停显示并记住偏好 |
| 角色绘制与原版服饰 | `src/components/Ram.tsx`、`OfficialRamClip.tsx`、`src/original-viewport.ts`：原版服装、临时动作回退、扩展绘制面 |
| 版本与发布说明 | `package.json`、`package-lock.json`、`RELEASE_NOTES.md`：候选号 0.33.1，尚未公开 |

## 复现素材导出

使用已有 `local-assets/tools/python/bin/python`、JPEXS `SourceExporter` 和原文件 XML：

```sh
python scripts/art/export-flight-rig.py \
  --ordinary /path/lamubone.xml \
  --super /path/super.xml \
  --super-swf /path/pet101/skill_7.swf \
  --forms super --work /tmp/super-flight \
  --exporter /path/source-exporter
node scripts/record-daily-frames.cjs --forms=super --force
python scripts/art/pack-daily-frames.py
```

`source-exporter` 将参数传给 `java -cp ... SourceExporter`。
录制脚本的 Vite 观察器排除原客户端素材库和录制产物，避免大量原件耗尽系统文件观察器。
最终图集写入 `public/assets/original/`；临时截图可以在完成打包后重新生成。

## 存档与发布范围

不更改应用身份、用户数据目录、存档键、存档结构、Android 包名或固定签名。
测试使用隔离配置，不覆盖玩家或既有持久测试配置。
Windows 现代版、兼容版 x64/ia32、Mac arm64/x64 和固定签名 Android APK 必须通过既有发布流水线后才更新公开渠道。
