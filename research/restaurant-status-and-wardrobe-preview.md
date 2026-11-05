# 餐厅状态与衣橱扩充预览

本轮只供预览，不推送标签、Release 或自动更新渠道。

## 餐厅

小屋游戏列表移除餐厅服务员卡片。桌面足球菜单提供「去餐厅打工」和「进入餐厅」；开始后桌面只显示状态、倒计时、进入与停止按钮，不再展示灶台小动画。进入餐厅时读取实际活动状态，仅打工中显示端盘、客人用餐和离开流程；未工作、手动停止、完成或离线取消后显示空餐厅与「餐厅已经打烊了」。小屋底部餐厅入口保留，作为查看当前状态的入口。背景切换保留，原经营数据与玩家存档位置不变。

原角色/背景素材与本地编排的走位、服务流程分开说明：这不是原客户端完整餐厅游戏录像。在线工作120秒结算180摩尔豆；离线、隐藏、重载取消，不补发离线收益。

## 服装来源

优先核对本地原客户端库 `local-assets/raw/root/resource/petcloth/swf2/` 和反编译脚本。固定源为 Miigon/RecMoleRes 提交 `7a6d6b3c7037a85afb28ad6abd4d7f4adfddb5ff`。新增三件：

| 原模块 | 预览名称 | 处理 |
| --- | --- | --- |
| 1200006.swf | 鲜花花冠 | 原 petBone3 服装层与动作，身体源帧挂接 |
| 1200024.swf | 骑士盾牌 | 原 petBone3 服装层与动作，挂在身侧 |
| 1200040.swf | 天使羽翼 | 原光环与双翼、原动作，修正阶段标签偏移读取 |

形状、配色和可用动作来自原件；名称、摩尔豆价格、缩放与安装位置属于桌宠适配。缺少阶段/动作时使用原正面姿态，不能说是对应阶段的官方完整动画。原模块1200009、1200078、1200079有独立脸部，不纳入叠穿。原件未改动，SHA256与来源记录于 `public/assets/original/wardrobe/source.json`，导出动作校验保存在相邻 wardrobe-motion。

## 重现

```sh
local-assets/tools/python/bin/python scripts/art/export-registered-outfits.py \
 --sources local-assets/research/wardrobe-expansion \
 --ordinary local-assets/research/wardrobe-expansion/lamubone.xml \
 --evolutions local-assets/research/wardrobe-expansion \
 --work local-assets/research/wardrobe-expansion/registered \
 --ffdec /opt/jpexs/26.4.0/ffdec-cli.jar \
 --ids flower-crown:1200006,knight-shield:1200024,angel-wings:1200040
```

预览路由 `?preview=wardrobe` 使用独立 React 状态试穿，不读写主存档；`?preview=desktop-work` 查看静态工作卡；`?preview=restaurant` 查看打烊，增加 `&working=1` 查看独立工作演示。

本轮新服饰共141张动作图集，包含高级/超级完整左右飞行姿态；原8件动态装扮的旧360张图集保持逐字节不变。

## 本轮验证

- `npm test`：421项前端、161项Node桌面测试通过。
- `npm run build`：通过，1277张图片无损压缩并逐像素核对可见RGBA与透明度。
- `scripts/restaurant/work-showcase-check.cjs`：15套背景、完整服务循环、桌面仅状态、停止/完成打烊、离线/隐藏/重载取消、工资只结算一次、旧存档/颜色/回忆保留及320px/手机横竖屏通过。
- `scripts/wardrobe-expansion-check.cjs`：三件×八形态、八种动作、原玩球姿态、免费预览、重复点击购买只扣一次、穿戴/颜色/原库存重载保留及390px无横向溢出通过。
- 新衣服141张图集的原件哈希核对通过，旧8件动态配饰360张图集逐字节保持不变。新配饰空白控制帧的保持策略已记录在runtime元数据。

本轮为Linux上的生产网页构建与浏览器验证，未制作或宣称通过新的Windows/Mac/Android安装包实机测试。
