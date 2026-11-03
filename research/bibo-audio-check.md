# BIBO 叫声补充核对

核对日期：2026-11-03。用户澄清“拉姆比伯”指的是拉姆的 **bibo** 叫声。本次没有找到能确认身份的 BIBO 原录音，因此没有替换 `src/pet-audio.ts` 的合成声音，也没有另发应用版本。这个结果只适用于下述已检查的资源，不代表所有年代、动画片或其他客户端均无该录音。

## 原件与检查范围

社区存档固定为 [`Miigon/RecMoleRes@7a6d6b3c7037a85afb28ad6abd4d7f4adfddb5ff`](https://github.com/Miigon/RecMoleRes/tree/7a6d6b3c7037a85afb28ad6abd4d7f4adfddb5ff)。它保存原客户端文件，不是官方经营的仓库。重新获取以下原字节，使用 JPEXS 26.4.0 导出音频与 SymbolClass，并递归检查 SWF 的嵌套 Sprite 声音标签。

| 存档内路径 | 字节数 | SHA-256 | 结果 |
| --- | ---: | --- | --- |
| `root/module/petUI/petUI.swf` | 36524 | `926da58cf54de37f65d1b9316b43c0fd1db1988536a8752672b73d0a173774ed` | 无声音定义或音频流 |
| `root/dll/ClientAppDLL.swf` | 2709921 | `9666b6f62ff5f9de9a3e3fb2885dbe234375eaafd03ee35d4e7d29ccc3ce87a6` | 无声音定义或音频流 |
| `root/dll/ClientCommonDLL.swf` | 451229 | `1c23c4167a37cef5cb1e57c577869a316e4da85b46250aa6c845e2697a479b47` | 无声音定义或音频流 |
| `root/dll/ClientConfigDLL.swf` | 1026462 | `52ad1c8dbee8b0b7cdcbecd05a83f4569bb4c0a17a3e2b0af98b8bd11bc2d0f5` | 无声音定义或音频流 |
| `root/resource/soundLib/lib1.swf` | 154665 | `d93e633b849cb02e28eceef6f2108bb67ccc46d3dc39a2318205bff4ba1cd275` | 10 段 MP3，未找到 BIBO 身份关联 |

另检查已有缓存的 `Client.swf`、另一版 `ClientAppDLL.swf`、`house.swf`，以及仓库 `research/references/` 下全部 **299 个 SWF**，包含四形态用品、涂鸦、`lamubone.swf`、`super.swf` 和三系技能。递归扫描的声音标签为 `DefineSound`、`SoundStreamHead`、`SoundStreamHead2`、`SoundStreamBlock`、`StartSound`、`StartSound2`；验证了解压后长度和标签边界，没有仅根据文件名判断。

299 个文件中，仅三段高级元素技能包含 `DefineSound`。空 `SoundStreamHead2` 标签不算有效录音；没有数据块的导出 WAV 只有 44 字节，不能作为声音素材。

## 导出的候选音频

`lib1.swf` 的原符号和 ffprobe 检查结果如下。十段 MP3 都可解析。符号是原文件中的名称；名称与时长本身不足以确认角色身份，本次没有把任何一段标作 BIBO，也没有声称完成听感鉴定。

| 原符号 | 时长（秒） |
| --- | ---: |
| `S_fail` | 1.042500 |
| `S_pa` | 1.196000 |
| `S_rocket2` | 4.316062 |
| `S_rocket` | 3.233958 |
| `S_hitWoodBlock` | 0.208500 |
| `S_drum` | 5.929750 |
| `S_trampleWoodBlock` | 0.770300 |
| `S_cracker` | 4.586289 |
| `S_pen` | 1.826000 |
| `S_button` | 0.398938 |

`S_button` 和 `S_hitWoodBlock` 已用于小游戏提示，原来源记录保留在 [`game-audio/sources.json`](../public/assets/original/game-audio/sources.json)。没有因为这次搜索重复添加它们。

三段元素技能导出如下，来源与原件哈希仍见 [`source-receipt.json`](references/original-element-skills/source-receipt.json)。它们属于技能时间轴，未发现将其绑定到角色 BIBO 叫声的符号或代码证据。

| 原件 | 声音 Character ID | MP3 时长（秒） |
| --- | ---: | ---: |
| `1208015.swf` | 52 | 6.321750 |
| `1208016.swf` | 67 | 5.956000 |
| `1208017.swf` | 84 | 7.471000 |

导出命令示例（输出目录和输入文件的顺序不可颠倒）：

```bash
java -Djava.awt.headless=true -jar /opt/jpexs/26.4.0/ffdec-cli.jar \
  -export sound,symbolClass /tmp/bibo-check /tmp/lib1.swf
ffprobe -v error -show_entries format=duration:stream=codec_name,sample_rate,channels \
  -of json /tmp/bibo-check/sounds/2_S_pa.mp3
```

## 原客户端调用核对

JPEXS 从固定存档的 `ClientAppDLL.swf` 导出 48 个名称含 pet/sound/audio/voice/talk 的类，从 `ClientCommonDLL.swf` 导出 9 个对应类：

- `com.module.pet.petLanXML` 从 `resource/xml/petTalk.xml` 读取 `lang0` 至 `lang3` 的气泡文案；该表没有音频地址。
- `com.module.pet.petSay` 调用角色 `say()` 显示文案，没有关联 BIBO 录音。
- `com.module.activityModule.SoundControlModule` 读取地图库 `bgSound` 并循环播放，是场景配乐。
- `com.module.sceneSoundModule.sceneSoundModule` 在地图事件中调用 `sound_2`、`sound_27`、`sound_32`，没有发现拉姆叫声关联。因此也未把此前 `ui.swf` 中身份未确认的 `sound_2` 冒充 BIBO。

后续只有取得可确认的原录音及其来源/角色调用证据后，才接入叫声播放，沿用音量、静音、隐藏页面停止和语音优先规则。当前产品的合成拟声说明继续见 [`audio-sources.md`](audio-sources.md)。

## 本轮与已发版本的关系

本轮只记录来源调查，没有改应用代码、用户存档或发布附件。`v0.32.0` 对应提交 `4b4355421765c05738fb5588ba31ffc55d6ba27b`，正式发布来自 [Actions 41515157038](https://github.com/Vinci-217/mole-baby/actions/runs/41515157038)：现代 Windows、兼容 Windows x64/ia32、Mac arm64/x64、Android 和发布任务均成功。后续重复构建不替代该次成品验证。

功能测试范围与华为实机限制见 [`release-0.32.0-validation.md`](release-0.32.0-validation.md)，数据位置及覆盖升级说明见 [`SAVE-DATA.md`](../docs/SAVE-DATA.md)。没有把云端 Android 测试写成 Pura 70 Ultra 实机测试。
