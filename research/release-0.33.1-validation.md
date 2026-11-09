# v0.33.1：神力超拉与显示复核

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

- `npm test`：64 个 Vitest 文件、503 项测试和 168 项 Node 测试通过。
- `npm run build`：生产构建完成；918 张 PNG 转为无损 WebP，逐像素验证可见 RGB 和所有 alpha。
- 新增真实像素回归检查：神力超拉三个方向的每张原姿态都必须包含中间亮黄色叶片，橙色侧叶无法代替其通过检查。
- `scripts/audit-raster-sizes.cjs`：扫描 310 段位图、54,116 个时间帧。两个既有初级涂鸦备用图集的中位身体宽度被标记；应用相应道具使用完整官方 SWF 路径，未按该旧图集重新缩放角色。
- `scripts/record-super-reading-review.cjs`：实际生产组件录制完整看书循环、待机及左右移动；没有页面错误或缺失请求，逐帧检查飞行动作中间叶片的存在。
- `scripts/pet-details-hover-regression.cjs`：在隔离目录复用原“小紫”记录，验证托盘开关、鼠标移入/移出、原生转发鼠标事件、重启偏好、神力看书和阅读时禁止拖动；检查名字、配色、成长、衣橱、物品以及每条旧记忆保留。

完整播放器、服装边界、三系变身及各平台成品的最终检查结果，在发版完成后补充。

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
