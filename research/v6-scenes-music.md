# v0.6 场景与配乐

## 本次实际参考观察

- 轮廓：原拉姆小屋和神秘湖木屋的大轮廓温暖深棕，长弧与短折角混合，并非规整的对称 3D 家具。
- 形状：木板宽窄不一，圆窗和叶片夸张；新温室与溪畔树屋保留这种玩具舞台比例，独立安排植物、门窗和平台。
- 色面：蜂蜜黄、杏色、叶绿、青蓝，各材质两到四层大硬边色面，无木纹照片与纸张噪点。
- 高光：UI 橙黄圆框与道具饼干只保留少量短反光；背景光斑用大色块，不加写实体积光。
- 空间：轻俯视、遮挡分层，中央下部与底栏留白；不绘制拉姆、按钮、文字。角色继续由原角色 PNG 图集独立叠加。

实际查看：`original/scenes/ramu-home.png`、`lake-cabin.png`、`original/ui/reference-pet-panel.png`、`original/items/180017.png`。技能：`skills/mole-classic-art/SKILL.md` 与 `references/style-guide.md`。

## 新场景

`generated/v6-starlight-greenhouse.png`（星光温室）与 `generated/v6-creek-treehouse.png`（溪畔树屋）由 image_gen.imagegen 生成，各 1586 × 992，为同一构图的 2×2 四时段图。完整提示词、参考、本次日期与处理记录见 `public/assets/generated/v6-scenes-provenance.json`。原生成文件按字节复制，运行时由 CSS 分别裁切四个象限，未重画或用脚本制造新插画。实际查看后确认：没有角色、文字或按钮；中央下部保留角色活动区域；夜景仍有清楚的地台和暖色灯。各时段家具布局一致但仍有图片模型导致的微小形状差异，不声称逐像素动画配准。

`TimeScene` 将场景图放在独立图层，时段光照仅影响背景，不给拉姆与 UI 染色。已有四种背景也随真实本机时间改变背景日光、夕阳、蓝色夜色和暖灯层；原图像文件不被修改。早晨 06:00–10:59、白天 11:00–16:59、傍晚 17:00–19:59、夜晚 20:00–05:59。每分钟读取一次本地 Date，在页面恢复可见或窗口聚焦时立即校正。预览时段仅在内存保存，不写入背景偏好；重启默认跟随时间。11 项有意义的测试验证边界和四象限对应。

## 原版配乐扩充

原映射依据：`public/assets/original/audio/map-sounds.xml`，固定 RecMoleRes 提交 `7a6d6b3c7037a85afb28ad6abd4d7f4adfddb5ff`。逐首原 URL、字节数、SHA-256 见 `audio/sources.json`。下载保留原 MP3 字节，不做转码或剪切。曲目按实际独立音频文件计数，共 12 首；不会把同一曲目在不同地图的使用冒充为几首不同音乐。

| 文件 | 原文件 | 原对应表内场景 | map id |
| --- | --- | --- | --- |
| castle.mp3 | BGM_001g.mp3 | 摩尔城堡、淘淘乐街、粒粒小广场 | 1、3、47 |
| pet-shop.mp3 | BGM_002.mp3 | 宠物店、摩尔餐厅、游戏小屋 | 21、17、22 |
| mystery-lake.mp3 | BGM_017b.mp3 | 神秘湖 | 8 |
| sunshine-ranch.mp3 | BGM_006c.mp3 | 阳光牧场、开心农场 | 9、10 |
| ramu-school.mp3 | BGM_008.mp3 | 拉姆学院 | 28 |
| berry-jungle.mp3 | BGM_004.mp3 | 浆果丛林、彩虹瀑布 | 41、42 |
| snow-rink.mp3 | BGM_003.mp3 | 摩尔拉雅滑冰场 | 5 |
| playground.mp3 | BGM_1003b.mp3 | 西部游乐场、东部游乐场、拉姆运动场 | 6、7、68 |
| magic-carriage.mp3 | BGM_026.mp3 | 魔法马车 | 24 |
| farm-workshop.mp3 | BGM_061.mp3 | 农场发明屋 | 27 |
| art-street.mp3 | BGM_1004.mp3 | 咕噜艺术街 | 59 |
| raceway.mp3 | BGM_016.mp3 | 摩摩赛车场 | 36 |

场景称呼按原 XML 注释确认，没有仅凭听感起名；这些是原场景配乐的复用，不声称原本属于新增的原创温室或树屋。12 首可在小屋设置直接点选，用户本地音乐仍仅留本机 IndexedDB，支持导入、重启恢复和删除，既有关闭音乐、音量、离屋暂停和对话压低音量逻辑保留。

## 实际验证

除了 11 项纯时间/象限测试，还在 Chromium 里运行实际 React `useRoomMedia`、`TimeScene` 和 `RoomSettings`：以 Asia/Shanghai 浏览器时区从 05:59:30 运行一分钟，夜景切为晨景；分别跳到 11:00、17:00、20:00 并触发恢复可见事件，立即切到白天、傍晚、夜晚。选择温室和早晨预览，确认 localStorage 只保存房间选择、不含 phase/timeMode；重载后保留温室且回到真实夜景与 auto。检查 12 个曲目可选、牧场选中状态、零页面异常。两新场景在 1180×820 与 1000×720 的实际 CSS cover 裁切均检查，保持 1.6 图像比例，仅显示一个象限；四时段原图已实看。

12 个本地 MP3 使用真实 Chromium `Audio` 解码 metadata 全部成功，时长均超过 10 秒，实测时长写回来源清单；所有音频和两张生成图哈希已核对。此验证不等同于用户本机扬声器听感或各系统的音量一致性测试。
