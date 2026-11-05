# 原版拉姆餐厅服务员素材

核对日期：2026-11-05。本轮是素材调查和提取，没有接入应用、改变餐厅工作逻辑或发布版本。

已在 [Miigon/RecMoleRes](https://github.com/Miigon/RecMoleRes/tree/7a6d6b3c7037a85afb28ad6abd4d7f4adfddb5ff) 的固定版本中找到原版服务员造型和动作，并核对原客户端的实际调用。该仓库是社区资源存档，原素材权利仍属于淘米等原权利方，不将它称为官方经营的仓库。

| 原文件 | 原客户端用途 | 提取结果 |
| --- | --- | --- |
| [1200043.swf](https://github.com/Miigon/RecMoleRes/blob/7a6d6b3c7037a85afb28ad6abd4d7f4adfddb5ff/root/resource/petcloth/swf2/1200043.swf) | 雇员空手、等待或走向取餐位置 | 正面方向容器 sprite 33，15 帧嵌套时间轴 |
| [1200042.swf](https://github.com/Miigon/RecMoleRes/blob/7a6d6b3c7037a85afb28ad6abd4d7f4adfddb5ff/root/resource/petcloth/swf2/1200042.swf) | 取到食物后、前往顾客餐桌的端盘状态 | 正面方向容器 sprite 35，15 帧嵌套时间轴 |

两个文件均保留 `down / leftdown / left / leftup / up / rightup / right / rightdown` 方向标签。方向主时间轴分别为 sprite 150 / 152，造型层时间轴分别为 sprite 151 / 153。最初的并排预览只导出正面方向；后续闭环预览进一步使用左、左上、右下方向的原时间轴，见下文。

## 原客户端调用证据

证据来自 [ClientAppDLL.swf](https://github.com/Miigon/RecMoleRes/blob/7a6d6b3c7037a85afb28ad6abd4d7f4adfddb5ff/root/dll/ClientAppDLL.swf) 的 JPEXS 反编译结果：

1. `com.module.restaurant.addLamuByRestaurant.addLamuMc`：创建雇员时设置 `Pet_cloth = 1200043`，开启 `autoMove`。
2. `com.module.restaurant.RestaurantGuest.empGetFood`：雇员移动到对应备餐位置。
3. 同类的 `addFoodToEmp`：取餐后设置 `PetCloth = 1200042`，调用 `refurbish()` 并移动到目标餐桌。
4. 同类的 `onFoodOver`：送达后恢复 `PetCloth = 1200043`，释放该雇员继续等待下一次送餐。
5. `com.module.npc.npcInstance.LamuNPC.refurbish`：从 `resource/petcloth/swf2/<PetCloth>.swf` 加载对应造型资源。

原版的完整服务流程由这些状态和移动代码串联，资源不是一段独立的整场餐厅服务影片。当前提取结果可用于后续还原“空手走到备餐处 → 端盘送餐 → 送达后恢复空手”。

另已检查 [restaurant.swf](https://github.com/Miigon/RecMoleRes/blob/7a6d6b3c7037a85afb28ad6abd4d7f4adfddb5ff/root/module/restaurant/restaurant.swf) 和 [restaurantEmployePanelMain.swf](https://github.com/Miigon/RecMoleRes/blob/7a6d6b3c7037a85afb28ad6abd4d7f4adfddb5ff/root/module/external/restaurantEmployePanelMain.swf)。前者的 `eatLamu*` 是餐桌顾客吃饭造型，没有拿来冒充雇员工作动作；后者用于雇员管理面板。

## 动图与保真范围

- 两套正面方向均完整导出 15 帧。原嵌套脚本第 1 帧 `stop()`，第 15 帧回到第 3 帧；动图展示原第 3–15 帧的 13 帧循环，每套包含 7 张不同画面。
- 原 SWF 为 24 fps；GIF 使用该帧率导出，受 GIF 百分之一秒时间单位限制，成品循环约 0.54 秒。
- 预览没有重绘角色、餐盘或服装，没有补帧、形变或用整体旋转模拟动作。仅将两套原帧按相同落脚点放在带标题的底板上。
- 最初并排预览中的灰色身体是原始未染色导出。原客户端通过 `LamuUIManage` 调用 `GF.setPetColor` 应用玩家配色；后续闭环预览按照这个规则应用原版蓝色，原件不变。
- 本项目此前的餐厅表现使用原身体动作与自行绘制道具，和本次取得的原服务员资源不同；本轮不把旧动画标成官方动画。

所有 5 个 SWF 均与固定版本的 Git blob SHA-1 对上，并另记录 SHA-256，见 [sources.json](references/restaurant/sources.json)。原件位于 `research/references/restaurant/raw/`；开发导出和逐帧哈希位于忽略提交的 `artifacts/restaurant-original-research/`。

## 官网核对与完整送餐流程

2026-11-05 实际获取官网的 [1200042.swf](https://mole.61.com/resource/petcloth/swf2/1200042.swf) 和 [1200043.swf](https://mole.61.com/resource/petcloth/swf2/1200043.swf)，与固定社区存档逐字节一致。红色服务员帽在原文件中，不是本地重新绘制的帽子。两文件的 SHA-256 分别为 `482a6eb19b6b21a42bfdf6898def786320b44cfc0fededc693aca565d4293520` 和 `bd2e161a58b7e0e1e556190f1e4a1306791418982f9bbed7307cc98bc3fc826a`，回执见 [official-verification.json](references/restaurant/official-verification.json)。

原客户端 `GF.setPetColor` 使用 `GV.petColor_3 = [1,1,1,1,-215,-57,31,0]`。本轮只在原 `petBone1` 身体实例施加这组 ColorTransform，保持眼睛和服装层独立，不把整张角色图统一染色。端盘状态的身体实例为 29、66、97、125、149；空手状态为 29、64、95、123、147。

闭环预览使用：

- `1200043.swf` 的左、左上、右下方向：父 sprite 150 的零基第 18、25、57 帧。
- `1200042.swf` 的右下方向：父 sprite 152 的零基第 57 帧。
- `resource/oneBigStree/swf/1330004.swf` 的原餐厅 `bg_mc / depth_mc / top_mc` 场景层，省去控制与碰撞覆盖层。
- `resource/restaurant/swf/1340002.swf` 的 sprite 71 第 6 帧原餐盘。

264 帧、24 fps、11 秒，阶段为等待接单 → 空手前往备餐台 → 取餐 → 端盘送餐 → 放下餐盘 → 空手返回。首尾 PNG SHA-256 完全一致，便于循环。成品在 `artifacts/restaurant-loop/`，包含完整场景、近景 MP4 和 GIF。

**角色姿势、服装、餐厅和餐盘来自原版；整段路线、节奏和循环前清台是本地编排，不是官方完整游戏录像。** 原客户端的餐盘在顾客进餐流程后清除；本演示在 8.9–9.35 秒清台以闭环。未重绘角色，未用整体拉伸或旋转伪造身体动作。

此轮仅提供研究、素材缓存和预览，没有接入现有餐厅工作逻辑。复现命令和全量素材库说明见 [LOCAL-ASSET-LIBRARY.md](../docs/LOCAL-ASSET-LIBRARY.md)。

```sh
# 需要项目已有 Node/sharp、Java、JPEXS 与 FFmpeg。
node scripts/art/review-original-restaurant.cjs /path/to/ffdec-cli.jar

# 如需复核客户端调用：
java -Djava.awt.headless=true -jar /path/to/ffdec-cli.jar \
  -selectclass 'com.module.restaurant.++,com.module.npc.npcInstance.LamuNPC,com.module.npc.uiManage.LamuUIManage' \
  -export script /tmp/restaurant-client research/references/restaurant/raw/ClientAppDLL.swf
```
