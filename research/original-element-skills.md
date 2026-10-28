# 三系原版变身的来源与桌宠适配

原客户端 `ClientAppDLL.swf` 中 `com.module.npc.npcInstance.LamuNPC.useLamuSkill(type,level)` 的编号公式为 `1208000 + type - 1 + (level - 1) * 3`，火=1、水=2、木=3。沿公开社区项目 [Miigon/RecMole](https://github.com/Miigon/RecMole) 的资源回源逻辑查找，取得官网 `https://mole.61.com/resource/petcloth/swf2/1208000.swf` 至 `1208017.swf` 全18个公开资源。没有访问账户、凭证或绕过登录。

取得记录与每个原文件的SHA256见 [source-receipt.json](references/original-element-skills/source-receipt.json)，原件保存在同目录 `raw/`，不打进应用。检索构建 [40525187526](https://github.com/Vinci-217/mole-baby/actions/runs/40525187526) 的结果另存于 `codex/original-skill-resource-cache` 分支，提交 `0b6a2ef5b0050cee545a3af83eef33ef8cbda5cd`。社区归档固定为 `Miigon/RecMoleRes@7a6d6b3c7037a85afb28ad6abd4d7f4adfddb5ff`。

三系各包含基础变身和五个进阶动作。名称来自原客户端 `PetStep5View`、基础课堂文案与内嵌 `InfopetSkillListXML`；课程时长、逐节解锁、进度和证书是本桌宠设计，不是原服升级数值。

| 火系 | 水系 | 木系 |
| --- | --- | --- |
| 小火苗 | 小水滴 | 小树苗 |
| 旺盛火焰 | 水花碎片 | 树根缠绕 |
| 爆烈燃烧 | 水上蔓延 | 通天藤蔓 |
| 火焰漩涡 | 似水奔腾 | 飞花炫舞 |
| 流星火 | 水龙 | 野蛮生长 |
| 星火涅槃 | 水上狂舞 | 上天入地 |

`level_2_2` 有8个方向标签和 `getItem`。标签的零基帧号是68，不能误把第9帧当成 `getItem`。根时间轴停在此帧后，内部 MovieClip 仍继续播放。使用 JPEXS 的 `FrameExporter` 冻结根帧68，并让嵌套时间轴按原始24fps完整播放；原帧总数、Sprite编号、注册和源哈希逐项记录在 `public/assets/original/element-skills/*/clip.json`。导出器和编排脚本为 [SourceExporter.java](../scripts/art/SourceExporter.java)、[export-original-elements.py](../scripts/art/export-original-elements.py)。

原文件在 `checkGetItem` 事件的 MovieClip 中放有紫色占位道具；原客户端 `geocaching` 收到事件会调用 `GC.clearAllChildren(mc)` 再载入真正物品。本桌宠没有取物任务，所以同样清空该占位容器，保留其父级运动及身体。逐文件容器ID见 [item-placeholders.json](references/original-element-skills/item-placeholders.json)。原SWF不修改；仅在导出时按运行时规则清空容器，没有逐帧修画、程序绘制或伪造角色动作。

每段动画用一个共同包围框注册，整段共用比例，未逐帧缩放；具体素材年代无法从这批公开文件确定。相同帧只在图集保存一次，`frameMap` 仍保留完整帧序和原始播放时长。图集分页不超过3456×2304，避免旧显卡超大纹理。生产包采用已有无损WebP转换并校验透明度和可见像素。

演出采用「原形 → 自制共用烟 → 原版变身及技能完整动作 → 自制共用烟 → 原形」。烟是新绘的共用素材，不称为官方变身过渡；魔术盒也是自制。原版目标动作在第一股烟散去后才开始计时，完整播完后再恢复。原身体、颜色、阶段和装扮不改写存档。
