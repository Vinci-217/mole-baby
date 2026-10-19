# 神力形态核对与桌宠成长适配

2026-10-19 核对已有资源存档 [mli55/taomi-codex-pets](https://github.com/mli55/taomi-codex-pets/tree/8e960bff00f07ce55acd160e0f3b9871454fda39) 的 SOURCES.md、原动画帧表、neutral/mask 图集，实际查看四种形态的待机和闭眼源帧。上游来源记录对应以下原资源：

| 桌宠选项 | 原资源 | 原 master sprite |
| --- | --- | --- |
| 神力超级拉姆 | resource/petcloth/swf2/pet101/skill_7.swf | 940 |
| 神奇水系拉姆 | resource/petcloth/swf2/pet5/skill_2.swf | 538 |
| 弹力木系拉姆 | resource/petcloth/swf2/pet5/skill_4.swf | 1029 |
| 霹雳火系拉姆 | resource/petcloth/swf2/pet5/skill_1.swf | 898 |

原域名均为 `http://mole.61.com/`。本次下载并使用的是固定提交的原 SWF 转换图集，不声称本次重新核验了官方服务器。图集未重新绘画；保留 192×208、8 列9行及三通道覆盖遮罩，原路径、哈希、完整抽帧表见 `public/assets/classic/evolution-sources.json`。

上游原客户端考据表明元素拉姆仍接受玩家 PetColor 的原加法 ColorTransform，不强制水蓝、木绿、火红。本项目沿用粉、黄、蓝、红四种身体颜色，头冠不染色。没有增加第五种领养颜色。静态降级图由 `scripts/export-evolution-fallbacks.cjs` 机械裁出第0帧，并应用与运行时一致的配色，不生成新画。

待机、左右走动、打招呼、玩耍、情绪采用各自原图集。睡眠使用各自原 happy 闭眼帧及微小呼吸；照料使用各自短打招呼动作加既有物品专属运动配方，不变回普通高级拉姆。没有声称补出了四种神力形态的全部原版 food / wash / medical 时间轴，也没有把原 happy 帧宣传为原客户端 sleep 标签。

成长为本项目规则：普通阶段24/72/168小时，高级后新增168小时健康成长。满进度仍是高级外形，玩家在小屋选择后才成为第五阶段；没有导入原付费会员、登录或服务端任务。旧档可继续成长，未知进化值或未成熟却已有进化值的损坏存档拒绝导入；有效形态随备份保存。名字、颜色、物品与记忆不变。

接果子的碰撞边界按各形态原身体遮罩第0帧测量，头冠不扩大接果区域。提醒为真实截止时间；暂停保留剩余时间，重新启用、改间隔或领养另一只拉姆时重新计时，重启从配置的完整间隔开始。
