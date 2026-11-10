# 动画与魔法回归检查

本轮在 `preview/wardrobe-interactions` 修改，供本地审阅。没有改动玩家存档目录、存档键、成长规则、永久颜色或安装签名。

## 修复内容

- 魔法菜单仅保留水、火、木各六段原有完整变身，以及变盒子。恢复 `element-*` 图集与共用烟雾流程，移除菜单和自然魔法池中的其他 SWF 变身。
- 穿衣拖动保留完整原版装扮播放器，使用当前穿衣外观的拖拽力度；松手后不重新编译装扮。拖动适配属于本项目的交互适配，不是新增官方动作。
- 道具足球和快捷足球共用当前实际成长形态的完整原版足球图集，播完恢复原装扮。
- 穿衣摸头完成后正确结束忙碌状态；忙碌时被拒绝的按下事件，不会在松手时触发摸头并打断魔法。
- 大图集染色分批执行，保持像素、分辨率、遮罩和全部帧。三系素材提前解码，准备承诺在同一次表演内保持稳定，避免重复准备重置时间轴。
- 照料动作在图集准备后从开头播放；加载耗时不会提前耗尽动作时间。魔法也可按 Escape 结束并恢复原样。

原素材覆盖仍有边界：除足球外，一些老道具只有初级／中级／高级／经典超拉的官方片段，缺少神力超拉及三系版本。它们仍使用可用的原片外观，结束后恢复实际形态，不会把这种临时外观写入成长存档。不能把缺失的原片宣称为已经补齐。

## 检查方法

```sh
npm test
npm run build:preview
node scripts/animation-repair-regression.cjs
node scripts/animation-repair-regression.cjs --quick
node scripts/animation-repair-regression.cjs --mobile
xvfb-run -a -s '-screen 0 1600x1000x24' node scripts/animation-repair-regression.cjs --native
xvfb-run -a -s '-screen 0 1600x1000x24' node scripts/native-clothed-drag.cjs
node scripts/record-animation-repair.cjs
```

网站使用已有的 5173 预览服务。浏览器检查覆盖十八段三系原动画、盒子、正常结束、停止、表演中的点击、重新打开，以及三件代表装扮在八个成年形态下的二十四组拖动。组件测试额外遍历全部 122 件装扮的摸头、拖动和足球回退。

Electron 检查使用真实 Linux Electron 进程；拖拽用 X11 系统鼠标事件，验证按住、移动、松手时仍为同一个播放器。手机检查使用 390×844 浏览器窗口，不能代替华为、Windows 或 Mac 的实体设备测试。

自动测试为 514 项应用测试及 169 项桌面／打包模块测试。实际界面记录与 GIF 保存在 `artifacts/animation-repair/`，不进入安装包。没有用通过自动测试来代替逐段播放检查。

2026-11-10 的界面记录包括完整浏览器播放与装扮矩阵 46 项、最终 Electron 流程 8 项、手机尺寸流程 9 项，以及系统鼠标拖拽检查。最后补充的交互修正另通过 38 项相关测试和 TypeScript／生产构建检查。

多个图形测试与构建并行时曾出现装扮加载超时；串行复测通过。具体的并发资源瓶颈和低配实体设备表现仍需验证，不能据此承诺所有机器首次加载都无等待。图形测试应按上述顺序逐个执行。

## 测试记录隔离

`animation-repair-fixture.cjs` 首次生成命名明确的 QA 记录，之后复用同一个 `qa-storage.json` 身份和记忆。Electron 使用 `artifacts/animation-repair/electron-profile`，并通过游戏内导入备份功能准备测试；不访问正式玩家的配置目录。断言包含实际成长、自然成长、最高成长、形态、颜色、装扮、物品和既有记忆。
