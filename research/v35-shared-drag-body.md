# 拖拽共用初级身体，中级只增加叶片 · 历史未采用方案

> 本页为历史研究。当前方案见[v37：初级身体原帧与逐帧绑定叶片](v37-bound-crown-drag.md)。本页描述的是当时实现，不能作为当前效果说明。

当时的实现意图：中级拖动时与初级使用一样的身体，只在叶片上区分。本轮直接共用初级的原始身体序列和完整拖动响应，移除中级独立的横向形变序列、力度采样和专用冻结层。

## 预览

- [身体一致的拖拽 / 回弹片段](../artifacts/animation-gallery/drag-shared-body.gif)：实际录屏第18–119帧，两种形态同时运行。
- [完整过程，含各自原待机形态](../artifacts/animation-gallery/drag-young.gif)
- [中级完整过程特写](../artifacts/animation-gallery/middle-elastic.gif)
- [五阶段实际拖拽](../artifacts/animation-gallery/drag.gif)
- [逐帧图：每个朝向上排初级、下排中级](../artifacts/v35-shared-body.png)

本轮范围为拖拽及松手衔接。待机、睡觉、喂养、足球等继续使用各阶段既有原动作。正式版、版本号和自动更新渠道不变，预览仅提交 `preview/ramu-drag-study`。

## 身体与叶片

初级与中级都使用原页游Sprite936的五种朝向、每朝向15帧，共75帧。帧顺序、侧脸、眼睛、嘴巴、身体轮廓及配色蒙版一致。初级PNG与上一轮保持逐字节一致。

中级只从原Sprite1532相应朝向提取绿色叶片，保留原图比例，根据每帧身体的上沿贴合。叶片位于身体后方；所有原身体非透明像素都得到保留，新增像素仅在身体外，不遮住眼睛。花冠控制在图格安全边界内。这里是原初级身体与原中级叶片的桌宠组合，不声称是原游戏的完整中级拖拽动作。

原资源为 `lamubone.swf`，SHA-256：`01abf65f3e8db098068a830268bd7a7cefefc1edc93a44565788783d23f8a0cf`；[来源链接与导出记录](v33-directional-drag.md)。[runtime.json](../public/assets/original/drag/runtime.json)标明 `bodyFrom: junior`、共有帧映射、叶片来源与注册点。[checksums.json](../public/assets/original/drag/checksums.json)记录PNG哈希。

两个阶段共用初级的惯性、挤压、旋转、回弹和方向切换，不再给中级独立计算一种弹性。服饰继续按对应帧的身体注册框贴合。以本轮“同一身体、同一动作”的要求为准，过去中级专用的纵向冻结规则已移除；中级不另外添加跳跃动作，身体变化来自与初级相同的原帧。

拖动钩子提交新状态后同步刷新身体，避免两套独立RAF回调或图片加载顺序造成偶发的一帧错拍。四种颜色的装扮回归同时检查每次采样的帧索引一致。

## 验证

- 资源导出时逐帧断言：75帧中，中级全部原身体RGBA及其配色蒙版与初级相同，身体外增加叶片，叶片无裁切。
- 实际应用录屏的102个拖拽/回弹采样逐帧核对身体像素、帧索引、CSS弹性变换和身体边界：身体像素差异为0，仅中级增加绿色叶片。结果见[shared-body-checks.json](../artifacts/animation-gallery/shared-body-checks.json)。对照GIF为这些实际帧的截取，完整过程同时保留。
- 单元测试检查两个阶段每种朝向和采样时刻身体/动作一致，并覆盖两轴拖拽、换向、眩晕阈值与松手后的完整物理响应。
- 四种颜色、两件装扮、双向拖拽、松手回待机通过浏览器检查。生产构建另检查八种形态与实际鼠标拖动、摸摸响应、无丢图。
- 232项Vitest、54项Node测试通过。当前710张图片84.40 MB → 无损WebP 50.04 MB，较上一轮运行图片减少约1.06 MB；全部透明度和可见RGB逐张校验一致。未构建或发布Windows/macOS安装包。

```sh
python3 scripts/art/pack-drag-sequences.py --work /path/original-drag-export --contact artifacts/v35-shared-body.png
npm test
npm run build
node scripts/record-horizontal-drag.cjs --young
node scripts/record-horizontal-drag.cjs --middle
node scripts/record-horizontal-drag.cjs
node scripts/young-drag-regression.cjs
node scripts/compact-production-check.cjs
node scripts/render-animation-readme.cjs
```
