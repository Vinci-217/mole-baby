# 中级待机预览

最初预览分支：`preview/middle-calm-idle`，基于 `53ed7d6`；预览时未发布或改变更新清单。用户确认后，此效果纳入v0.30.4，见 [本轮验证](release-0.30.4-validation.md)。

## 观察与参考

- 轮廓：沿用原双叶中级形态，身体和叶柄接点不重绘，不改大小或注册位置。
- 形状：参考 `public/assets/original/pets/middle-red-idle.png` 与 `skills/mole-classic-art/references/v38/original-reference.png`，眼白、瞳孔保留原比例。
- 色面：复用 `public/assets/original/grounded/` 的四配色遮罩，不对叶片和眼白染色。
- 高光：保留原身体亮面与硬边底部阴影，不增加材质、描边或滤镜。
- 空间：按桌面100×109像素录制，叶片保持小幅摆动；身体仍使用当前微弱呼吸层，不增加跳跃。

旧的 `groundedMotion` 同时用两条正弦曲线修改瞳孔横纵坐标，无交互也持续游移，并把笑眼混入常规眨眼。新方案仅覆盖中级的 `idle`、`waiting`：默认瞳孔居中，现有半眨眼图层短暂显示120ms，两次间隔不同；不循环切换开心闭眼。附近鼠标依旧通过当前150ms视线缓动获得微小回应，离开回正。叶冠转动由约±1.15°降为±0.45°并放慢。

素材来源仍是 `public/assets/original/grounded/source.json` 中的 lamubone 原素材。图层分离、半眨眼造型、视线、叶片摆动及其时序是项目适配，不能描述为原游戏完整待机原片。没有生成新角色图片。主动张望、摸摸、读书、拖拽、睡眠、玩球和其他阶段的动作路径不变。

## 可复现预览

运行 `node scripts/record-middle-idle.cjs`，通过 Vite 挂载实际 `Ram.tsx`，四种颜色共录制12秒、24fps：前8秒视线输入为零，第8秒注入附近鼠标输入，第10秒移开。录制脚本检查前8秒居中、靠近响应、移开回正及浏览器错误。`before.gif` 来自动作修改前的同一录制脚本；`--before` 仅用于原实现对照录制，不能从已经修改后的源码恢复旧效果。

- 动作、视线和原动画回归：`npx vitest run src/grounded-motion.test.ts src/pet-attention.test.ts src/components/ram-animation.test.ts --maxWorkers=2`，36项通过。
- 四配色实际组件录制：通过，无角色静态回退、无浏览器错误；见 `artifacts/middle-calm-idle/after-checks.json`。
- `npm run build` 通过，813张生产图片的无损转换、透明度与可见像素校验通过。
- 编码后的GIF只作为预览文件；客户端继续使用原有PNG图集，不增加运行时图片资源。
