# 初级与中级左右拖拽修订 · 未发布

> 本页记录早期75/80帧方案。当前按用户澄清，共用初级身体和动作、中级只增加叶片，见[v35修订](v35-shared-drag-body.md)；中间的[v34独立形变](v34-middle-elastic-drag.md)作为历史研究保留。[本页原版本GIF](https://raw.githubusercontent.com/Vinci-217/mole-baby/95b041a1c6a85af470a73fe17c357a8c29fb647c/artifacts/animation-gallery/drag-young.gif)可用于对照。

用户只要求中级不额外上下弹跳。上轮把初级和中级都改成固定侧向姿态，造成左右拖动缺少转身和身体动作。本轮恢复两者的方向变化，只限制中级的附加纵向运动。手动上下拖动原生桌面窗口的能力保留。

## 可直接查看

- [初级 / 中级实际拖拽 GIF](../artifacts/animation-gallery/drag-young.gif)
- [五阶段实际拖拽 GIF](../artifacts/animation-gallery/drag.gif)
- [五朝向逐帧图，每个朝向抽取八帧](../artifacts/v33-drag-sequences.png)
- [完整动画目录](../README.md)

两组GIF使用应用的 `Ram` 和 `useElasticDrag`，覆盖向右拖、换向左拖、松手回正，24fps共154帧。它们展示实际实现，不能当作已获认可的正式版效果。代码仅提交到预览分支，不创建标签或Release，不推进main或自动更新。

## 原素材与自行适配

普通拉姆来自原页游 [lamubone.swf社区存档](https://raw.githubusercontent.com/Miigon/RecMoleRes/master/root/resource/NPC/lamubone.swf)，SHA-256：`01abf65f3e8db098068a830268bd7a7cefefc1edc93a44565788783d23f8a0cf`。

| 形态 | 主Sprite | 五种朝向 | 本轮序列 |
| --- | --- | --- | --- |
| 初级 | 936 | down / leftdown / left / rightdown / right | 每朝向15帧，共75帧 |
| 中级 | 1532 | down / leftdown / left / rightdown / right | 每朝向16帧，共80帧 |

初级使用原方向动作的完整周期、原侧脸和身体变化。每个方向采用统一比例注册，不再用一张侧脸代替全部拖动。原清空帧保留上一姿态一个原始帧的时长，避免闪烁。

中级从原五种视角提取稳定姿态，生成16帧一组的横向弯曲和轻微宽度变化。变形只采样横坐标，`y'=y`，顶部和底部固定；原眼睛、小嘴及叶片随身体一起变动。它属于基于原画的桌宠拖拽适配，不是核实到的官方拖拽动作。

原地面阴影形状41、65–69、89、333从导出显示列表隐藏，避免拿起时带着灰色地面。保留角色自身明暗与完整叶冠。PNG及蒙版保留，构建时再无损压缩；[runtime.json](../public/assets/original/drag/runtime.json)记录朝向、原帧、身体注册与装扮采样，[checksums.json](../public/assets/original/drag/checksums.json)记录图集哈希。

## 交互衔接

鼠标水平运动决定朝向，经过正面和斜侧面转身；慢速拖动不需要达到反复摇晃的眩晕阈值。身体落后于手部一点，换向时跟随，松手后用阻尼弹簧回正。帧播放由速度驱动，最高24fps，避免快速拉动时跳过大量姿态。初级保留轻微旋转与柔软惯性，中级关闭拖动和松手阶段的呼吸、旋转、纵向弹性层。

装扮沿用已有对应朝向的服饰帧，以原身体和新身体的注册框同步调整位置与尺寸，跟随侧脸和横向形变。拖拽结束后，摸摸、喂养等新动作立即取得控制权，避免松手回弹覆盖互动。

## 验证

- 230项Vitest与54项Node测试通过，新增检查方向变化、慢速转身、多个姿态、初级保留弹性、中级不附加纵向惯性、松手和减少动态效果。
- 两组实际代码录屏检查：初级、中级都出现左右侧脸与至少八个不同姿态；中级身体上下边界在全程内变化小于0.6个CSS像素（允许原斜侧轮廓一个源像素的差异）。每个中级朝向的16帧没有纵向变形。
- 浏览器回归覆盖四种颜色、初级/中级、两件原装扮、左右换向和松手恢复，检查实际画面图集、配色和可见服饰范围。
- 生产构建及压缩后的图片路径检查保留；本轮不构建或发布Windows/macOS安装包。

```sh
python3 scripts/art/prepare-original-actions.py --ordinary-xml /path/lamubone.xml --sources /path/source-xml --work /tmp/ramu-drag-export --ffdec /path/ffdec-cli.jar --forms ordinary --actions down,leftdown,left,rightdown,right --omit-middle-insect
python3 scripts/art/pack-drag-sequences.py --work /tmp/ramu-drag-export --contact artifacts/v33-drag-sequences.png
npm test
npm run build
node scripts/young-drag-regression.cjs
node scripts/record-horizontal-drag.cjs --young
node scripts/record-horizontal-drag.cjs
node scripts/render-animation-readme.cjs
```
