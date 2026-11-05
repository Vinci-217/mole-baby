# 穿戴移动动画复核

本轮针对实际桌宠播放器及 `?preview=wardrobe-motion`，沿用本地归档的原页游图形；不改写 `local-assets/raw/` 和玩家存档。

## 复现与修正

- 中级侧向第一个采样格是蹲姿，身体只有约49px高。旧校准将它放到正面87px的身高，随后95px的起跳姿势被放到约165px，头饰随之变大、越界。现按完整动作的最大身体高度设置一组固定等比变换，最大约113px，保留原起跳、落地和轮廓。
- 初级15帧、中级16帧的源动作曾统一按8格、每格62.5ms播放；中级还因调用漏传形态参数而使用初级默认值。现按各自原24fps采样时间戳保留停顿，左右换向共享当前步态时钟。
- 部分头饰的原替身骨骼位移与当前身体不同，紫色魔法帽和皇冠猫耳在起跳时曾越出预览框。普通侧向播放采用对应原方向的中性头饰图形，按当前头部挂接，避免把服饰抛离身体。此处是桌宠的挂接适配。
- 天使羽翼曾盖住眼睛，初级侧向若干帧还会上窜。现将原服饰帧放在身体后方，侧面移向背部，保持光环高于脸部。保留原服饰图形及比例。
- 高级/超级的完整飞行身体曾使早先8件服饰回退到商品小图，导致兜帽和帽子过小、悬空。现复用已有原服饰方向采样格，按对应原身体源帧选取，保留正确视口、大小和朝向。三件新服饰继续使用完整飞行服饰图集。

## 验证方式

- 真实遮罩测试检查侧向动作的全部8个采样格，约束最大身高和落地基线，不只校验第一格。
- 时序测试逐个核对两种落地形态的原24fps采样停顿及循环。
- 录制脚本同时检查12件装扮、7种成长形态的正面、左行、右行、回位。每个录制帧检测服饰可见、无回退、服饰像素没有越出卡片，以及羽翼位于身体后方。
- GIF使用实际播放器截图，不以重新绘制的角色代替运行画面。预览存档哨兵用于发现意外写入。

运行：

```sh
npm test
npm run build
node scripts/record-wardrobe-motion.cjs \
  --out artifacts/wardrobe-motion-polish \
  --frames local-assets/research/wardrobe-polish-recording
node scripts/wardrobe-expansion-check.cjs
```

最终逐形态录制结果见 `artifacts/wardrobe-motion-polish/movement-recording-checks.json`；种子、购买及存档回归见 `artifacts/wardrobe-expansion/browser-checks.json`。

原服饰素材来源、缺失动作及服饰挂接范围继续以 `public/assets/original/wardrobe-motion/README.md` 为准。GIF展示本项目的播放适配，不冒称原客户端完整录像。本轮仅供预览，未推送或发版。
