# 原餐厅客户端界面与移植边界

本轮以本地固定存档 SWF 与已经验证过的同路径官方文件为依据，未连接官方游戏服务器。目标是纠正上一版自行设计的界面，而不是把前端适配称为官方整套游戏。

## 能读取到什么

`local-assets/extracted/root/dll/ClientAppDLL.swf/scripts/com/module/restaurant/` 中有餐厅核心的 ActionScript 3 反编译结果：包括 RestaurantFood、RestaurantView、RestaurantGuest、RestaurantUI、RestaurantMakeFoodTips 等 13 个类。`ClientSocketDLL.swf` 中还有这些客户端请求所用的协议定义。

部分外部面板没有成功还原成高层 ActionScript，例如 `restaurantMenuMain.swf`。这些模块已保留 P-code 字节码，可以据其类名、常量、显示树与调用次序核对行为；不能称为拿到了淘米的完整原始工程。

原代码直接依赖 `flash.display.MovieClip`、Flash 时间轴、GV/GC 全局管理器、人物寻路、动态类加载和官方 socket 返回的状态。React/Electron 不会直接执行 ActionScript；仅把 `.as` 文件复制进项目不能运行餐厅。复用方式是保留原 SWF 和反编译结果，用原显示对象与帧导出资源，并移植已经核实的客户端流程。官方服务端的存储、结算校验、真实好友、全服排行和活动实现不在这些客户端文件中。

## 本轮按源码纠正的内容

| 原客户端证据 | 当前实现 |
| --- | --- |
| RestaurantView.actionHandler：type 1–50 调 makeFood | 点击场景中原 `zaoBtn` 的位置；取消底部灶台卡片。 |
| RestaurantFood.makeFood：空灶加载 restaurantMenuMain | 使用该 SWF 的 VIEW 图形与原六格菜谱排版、翻页箭头。 |
| foodState 1、2、3 | 放锅、放入食材、开始制作；各步使用原 50 帧 bar 里的第 3–50 帧。 |
| RestaurantMakeFoodTips.onFoodNext | 对应原 downPot / downFood / foodOk 音效。 |
| foodState 3→4→5，NeedTimer / Timeout | 使用每道菜原烹饪与烧糊秒数，移除上一版 1/60 加速和时间上限。 |
| MovieClip.gotoAndStop(foodState) | 导出全部 72 道菜的六个状态，共 432 张原状态帧；原位置显示锅、食材、制作中、成品与烧糊。 |
| makeFood state 4 / moveMakeFoodLocation | 原灶台点击端菜，相同菜品合并到餐台。 |
| makeFood state 3 / state 5 弹确认 | 制作中捐赠或烧糊清理先确认，按原文扣 100 摩尔豆。 |
| RestaurantGuest 等餐、用餐计时 | 等餐 15 秒，用餐 16 秒；取送餐、离开仍需继续核对寻路表现。 |
| UI、joinMc、myNameMc、buttonLevel、shuo | 直接使用原 HUD、营业牌、名字板、点击范围与空灶手势；坐标和文本框来自原显示树。 |

帧序列合成同图集，避免原 24 fps 制作动画逐帧发起网络请求。原件保留不改，导出与可重建脚本在 `scripts/restaurant/`。

## 仍然不同的内容

- 用户明确要求的规则继续生效：所有菜品都用摩尔豆获取；无离线收益；退出、断网、后台自动取消打工。厨房计时也不会离线推进。这些规则本身与原版服务器行为不同。
- 员工招募、装修管理和账本内容仍使用本地状态与适配面板；右侧图标已使用原素材，其所有菜单行为尚未逐项还原。原菜谱收藏与升级面板 `restaurantMenuBtnMain` 尚未接入原逻辑，当前菜谱图标打开选菜页。
- 角色寻路、方向、遮挡顺序和部分循环帧仍使用上一版的本地安排，不是原客户端的完整场景运行结果。
- 真实好友雇佣、互访、排行榜、会员与服务器活动未实现，不能从客户端代码推导出缺失的服务端实现。
- 手机没有原页游对应的原生排版，本轮保持场景比例并支持横向查看。

因此，本轮可以说“炉灶、制作阶段与选菜界面按原资源和源码移植”，不能说整个餐厅已经与原版百分之百一致。
