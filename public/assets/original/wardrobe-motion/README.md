# 原客户端服饰动画

图形来自 Miigon/RecMoleRes 固定提交 `7a6d6b3c7037a85afb28ad6abd4d7f4adfddb5ff` 下的 `root/resource/petcloth/swf2/`。不是从商品缩略图制作变形动画，也没有生成或重画角色。8件、8形态共360张压缩透明图集；源文件SHA256见 `runtime.json` 的 `sourceSha256`，PNG校验见 `checksums.json`，完整源URL见相邻 `wardrobe/source.json`。

原 `ClientAppDLL.swf` 的 `com/module/npc/uiManage/LamuUIManage.as`：`loadCloth()` 加载 swf2；`synchroCloth()` 让 ActionMC0/1/2/3 跟随身体帧；`petCloth()` 将 ActionMC3 放回身体父层。商品预览 `swf/cloth` 只适合作为图标。一部分服饰是替换全身的骨骼，并非可直接叠到身体上的透明衣服。

## 可复现导出

需要 Python3、Pillow、NumPy、Java17与JPEXS26.3。下载原 swf2、普通 `lamubone.swf` 和 super/water/wood/fire 原骨骼；用 JPEXS `-swf2xml` 导出XML。对含 petBone3 的文件同时导出 AS 脚本到 `<id>/scripts`，脚本中 symbol 编号用于识别原装扮层。不要只导出 sprite2，星星、帽檐等可能位于另外的显示层。

```sh
python scripts/art/export-registered-outfits.py \
  --sources /path/to/swf2 \
  --ordinary /path/to/lamubone.xml \
  --evolutions /path/to/evolution-xmls \
  --work /tmp/registered-outfits \
  --ffdec /path/to/ffdec-cli.jar
```

仓库既有 classic/care/item-motion/football/emotions/grounded/slumber 图集和源帧配置提供目标身体遮罩与动作采样。导出脚本解析原显示列表、放置矩阵和子动画年龄；Move记录没有HasCharacter时保留原characterId。每个身体源帧选取同一服饰源帧，保留24fps原时序。图集去重后由 lookup → frameMap → rects 恢复透明位置；禁止把压缩后的身体图集格号当作原源帧号。

## 桌宠适配范围

- 身体、眼睛、嘴与服饰独立播放；不提取服饰预览中的脸。没有原独立服装层的文件保留彩色装饰形状，排除预览脸、灰影与叶冠。
- 原文件空白的种子/高级/神力节点，回退到初级原装扮；缺失动作回退到正面原姿态。bodyCell/origin记录目标形态视口。
- 兜帽包住头部，帽檐位于眼睛上方；书本与魔杖放在身侧。各类服饰保持原图形比例，以原身体覆盖范围调整位置；不是恢复所有原客户端装备位置。
- 遮冠服饰只隐藏身体图集中头冠的非身体像素，保留脸部与瞳孔。种子花盆不随帽子变形。叶冠隐藏与固定安装位置均为本项目适配。
- 庆生小帽没有可用 swf2，继续使用相邻目录的原静态 PNG 和身体遮罩锚点，不推测白色像素的“眼睛角度”。

实际桌面100px检查、录屏与限制见 `research/v24-original-wardrobe.md`。PNG没有包含新画的脸、眼睛或嘴。
