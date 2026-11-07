# 桌宠内原版素材

`manifest.json` 记录本轮接入的 567 份原版 SWF 的路径、长度、SHA-256、导出节点及形态标签。532 份含多帧时间轴，35 份为静态；这不是 567 套新增完整角色动画。衣橱新增 110 件，旧 12 件保持原编号。

桌面足球 → 玩耍 → 原版动作集，或小屋 → 游戏 → 原版动作集，可在当前拉姆上试播适合当前形态的片段。种子不能穿戴，原件不支持当前形态时不能强行穿戴。试播不消耗用品，不授予原版课程、魔法或战斗奖励。

`files/` 原件从已核验的官方缓存复制，复制前重新检查 SHA-256；没有重绘原图或插帧。`controller.swf` 是单独的桌宠适配层，选择原件形态、方向，按原客户端骨骼事件同步身体、衣服、染色和结束状态。`icons/` 是原图标导出，两件缺少原图标的服务员装扮使用现有占位图标。

Ruffle 0.7.1 随应用离线加载，沿用桌宠的游戏音效开关与音量。播放器位于独立文档，Electron 通过只读本地协议加载且不注入桌面桥。Ruffle 许可保存在 `ruffle/LICENSE_MIT` 和 `ruffle/LICENSE_APACHE`。

来源为 `https://mole.61.com/`，具体原始路径见清单；请求回执和固定原件保存在开发素材库 `local-assets/ram-official-sweep/2026-11-06/`。生成工具：`scripts/art/prepare-embedded-originals.py`。逐项 GIF 目录由 `scripts/record-all-original-animations.cjs` 和 `scripts/build-original-animation-gallery.cjs` 生成，不随产品安装包分发。

摩尔庄园、拉姆及原版美术、动画素材的权利归淘米等原权利方所有。本项目基于公开可取得的素材进行非官方学习与适配，公开可访问不等于自由授权。如构成侵权，请通过项目作者或 GitHub Issue 联系删除。
