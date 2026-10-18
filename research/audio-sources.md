# 小屋音乐与拉姆音效来源

核对日期：2026-10-18。使用公开社区存档 [Miigon/RecMoleRes](https://github.com/Miigon/RecMoleRes)，固定提交 `7a6d6b3c7037a85afb28ad6abd4d7f4adfddb5ff`。不是官方经营的代码仓库；其中保存的原客户端音频仍属于原权利方。

## 实际核对与保存的原版音乐

查看了该提交的 [`root/resource/bgSounds`](https://github.com/Miigon/RecMoleRes/tree/7a6d6b3c7037a85afb28ad6abd4d7f4adfddb5ff/root/resource/bgSounds) 目录，读取原 [`对应表.xml`](https://raw.githubusercontent.com/Miigon/RecMoleRes/7a6d6b3c7037a85afb28ad6abd4d7f4adfddb5ff/root/resource/bgSounds/%E5%AF%B9%E5%BA%94%E8%A1%A8.xml)，按地图注释与 `musicId` 对照名称，没有按听感编造歌名。

| 本地文件 | 原文件 | 名称与证据 | 时长 |
| --- | --- | --- | --- |
| `audio/castle.mp3` | `BGM_001g.mp3` | 地图 1 注释“摩尔城堡” | 46.080 秒 |
| `audio/pet-shop.mp3` | `BGM_002.mp3` | 地图 21 注释“宠物店”；此曲也用于城堡大厅等室内场景 | 30.093 秒 |
| `audio/mystery-lake.mp3` | `BGM_017b.mp3` | 地图 8 注释“神秘湖” | 40.098 秒 |

三首 MP3 直接保存原字节，没有重新编码、截取、混音或音量归一化。原客户端表里的 FX 环境声没有叠加到 BGM 中。`ffprobe` 核对音轨可解析、时长有效，三首共约 909 KiB。完整原始 URL、文件大小和逐文件 SHA-256 在 [`audio/sources.json`](../public/assets/original/audio/sources.json)，对应表原文保存为 `audio/map-sounds.xml`。没有把这些音乐声称为原本用于本项目小屋的配乐；它们作为可选的原页游曲目提供。

## 原版拉姆声音的查找结果

实际检查 `lamubone.swf` 的 JPEXS XML：`DefineSoundTag`、`SoundStreamHeadTag`、`SoundStreamHead2Tag`、`SoundStreamBlockTag` 均为 0。另查看存档 [`root/resource/soundLib`](https://github.com/Miigon/RecMoleRes/tree/7a6d6b3c7037a85afb28ad6abd4d7f4adfddb5ff/root/resource/soundLib)，其中为 `fishGotoWater.mp3`、`netGotoWater.mp3`、`lib1.swf`；前两者与拉姆说话、吃饭无关。缓存 `ui.swf` 中有 `sound_2` 等未确认用途的通用音频，未当作原版拉姆叫声使用。这些检查不足以证明所有原版资源都没有拉姆声音，只说明本次没有找到可确认身份的原录音。

因此 `src/pet-audio.ts` 使用本地 Web Audio 合成：

- 轻触、提起、轻摇、放下、接住、唤醒、难受：短音节基频与共振滤波。
- 吃东西：三次短促咀嚼噪声与低频口腔声。
- 喝东西：三次低声咕噜。
- 洗澡：轻柔泡泡与水声。
- 休息：短促轻呼吸。

这些是本项目程序合成声音，不是原版录音，也没有经过声音克隆。声音仅在明确交互时触发，沿用用户的声音开关并节流。系统语音正在朗读时优先保证对话，不插入另一段拉姆叫声。

## 播放与用户自己的音乐

`useRoomMedia(inRoom, speechBusy)` 只在进入小屋、音乐开关打开时播放；回到桌面或退出小屋会立即暂停。换曲会停止上一首。首次播放若被系统的自动播放规则阻止，会在用户点击后恢复，也提供“播放音乐”按钮。系统朗读或调用方标记正在对话/录音时，配乐音量降到设定值的 20%。默认音量 18%，可手动调整。

设置可选三首内置原版曲目，也能导入一份 20 MB 以内的有效本地音频。导入前检查音频能解析；文件 Blob 保存在这台电脑的 IndexedDB `ramu-local-music` / `tracks`，没有上传行为，重启后恢复。再次导入会替换原文件；“删除本地音乐”会移除保存的 Blob，切回摩尔城堡曲目。背景、曲目、开关、音量单独保存在 `ramu-room-media-v1`，不与宠物存档或 API Key 混用。

四个背景均复用已有图片：晨光书桌为已记录的生成背景，拉姆小屋、神秘湖木屋、树洞房为已有原客户端导出。对应来源仍见 `ASSETS.md` 的背景章节，本次没有重绘或改变其来源标识。
