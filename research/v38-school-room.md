# 课程、打工、布置与叶片接点 · v0.29.2制作记录

本页记录预览制作与验证过程。用户已于2026-10-26确认进入v0.29.2正式发布流程；最终安装包与发布状态以GitHub Release为准。制作阶段的预览分支提交不会被客户端自动更新发现。

## 叶柄修订

v37在原叶片/身体交叠区域中选最深像素，落到了外侧叶片下缘，而非中央叶柄。单纯“身体像素一致”的检查没能发现美术接点错误。

v38把原始接点限定到双叶中央，再通过源角色和目标身体的眼部位置定位相同的头部接点，叶柄略埋入头顶，降低独立转动幅度，并按初级静止头部换算原叶冠与身体的比例。身体、眼睛、嘴及颜色遮罩仍逐像素保留初级原帧。原SWF来源和哈希继续见[此前来源记录](v37-bound-crown-drag.md)。

新生成的[合成帧循环](../artifacts/v38-school/crown/bound-sequence.gif)、[75帧PNG下载](../artifacts/v38-school/crown/frames-red.zip)及[应用实录](../artifacts/animation-gallery/drag-young.gif)分别提供图集和实际鼠标驱动效果。旧v37效果保留为历史对照，不能作为本轮预览。

## 新玩法与动画

课程分为语言、英文、魔术及旋风、流火、寒冰、陨石术。三节结业，前置课程、已完成课时、证书与正在进行的一节一起保存。语言课前宠物气泡显示bibobibo；结业后恢复原有中文陪伴短句，英文另需英文课。没有恢复API聊天或Key配置。

餐厅每班2分钟，完成加180摩尔豆；取消无收益，重开结算一次。演员身体播放原行走、停下和转向；新绘盖盘、送汤、收空碗三个道具姿态编排成连续图集。书本有不同页形，魔术有空帽、出花、花束。四系法术有预备、成形、施放、消散，不仅移动一张固定图。

新道具先用图片模型绘制3–4张关键姿态，再离线编排成48/72帧、24fps透明图集；角色本体不重画。叶片、身体、道具与音效使用同一事件时钟，冷加载不另起一个错位时间轴。飞行形态另下移道具，特效集中右下方，留出面部。原始新绘图、参考板、提示词及审核规则放在[美术skill](../skills/mole-classic-art/SKILL.md)。本轮没有拿到可核对的《摩尔勇士》完整技能原帧，四系法术是新绘候选，不宣称官方原帧复刻。

小屋新增八件可购买摆设和七种课程证书。墙饰按下缘、家具按落脚点限制在不同区域；拖拽保留抓取偏移，避免跳到鼠标中心。购入、摆放、收回、证书归属均保存在宠物存档。手动睡觉放在玩耍内，保留自动睡眠；睡觉会中断当前课程/打工，最短手动睡眠避免精力高时立即自动醒来。

自动更新的忙碌保护也加入课程/打工：活动结束之前不自动重启。未改更新源和平台安装策略。

## 验证入口

```sh
npm test
npm run build
node scripts/school-room-regression.cjs
MOLE_PRODUCTION=1 node scripts/school-room-regression.cjs
node scripts/record-animation-gallery.cjs school school-skills elemental-skills restaurant school-preview
node scripts/record-horizontal-drag.cjs --young
node scripts/record-horizontal-drag.cjs --middle
node scripts/record-horizontal-drag.cjs
node scripts/young-drag-regression.cjs
node scripts/compact-production-check.cjs
node scripts/render-animation-readme.cjs
```

浏览器流程覆盖9节课、前置限制、中文解锁、证书、施法、墙/地拖拽、重开和一次工资、手动睡眠/叫醒，并捕获缺图和页面错误。逐帧录制覆盖课程、七种技能、打工的全部可用成长形态。Windows/macOS本轮未构建安装包，也未把云端浏览器测试当作这两个系统的实机结果。

验证结果：253项Vitest、54项Node测试通过；生产构建和完整课程/打工/墙地拖拽流程通过，另包含语言课前的工资浮动提示及露天场景隐藏墙饰。初中级四种颜色、两件装扮的双向拖拽和松手通过；三组实录中比较102帧，身体像素差为0。新道具672帧裁去空白后逐张重建核对可见RGBA/透明度一致，理论图集解码面积176.16 MB → 54.44 MB，非进程或GPU实测值。

当前运行图片738张，90.38 MB → 无损WebP 55.30 MB，逐张核对透明度和可见RGBA相同。技能图集原始绘制关键帧、参考板、GIF和PNG下载包均不进入安装目录。
