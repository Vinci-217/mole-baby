# 服饰与身体贴合复核

## 复现

初级正面和走动时，羽毛、紫帽、花冠等与头部之间存在可见空隙；用服饰外框最低点定位会让低垂边角碰到身体，中部帽檐仍然悬空。初级身体注册包含纵向校准，但身体和服饰画布使用 `object-fit:contain`，不同尺寸的画布各自留白居中，导致显示位置偏离同一套注册坐标。

检查神力超级时，旧服饰图集中的空白控制格还会让部分帽子、兜帽短暂消失。经典三叶超级此前也没有出现在移动预览的形态列表中。

## 修正

- 身体和服饰画布按同一注册坐标填充，保留现有变换；恢复初级身体及兜帽在该坐标中的正确贴合。
- 7类头饰使用实际帽檐逐列像素和当前头部遮罩轮廓计算接缝，先居中，再平移到小幅重叠的位置。服饰原图形和尺寸不因这个接缝校准而改写。
- 光环、盾牌、书本、魔杖不按帽檐规则处理。足球表演继续使用其原头部轴和挂接方式。
- 空白服饰控制格保持同方向上一张有效原图，避免闪空。
- 经典三叶超级复用原神力超级方向服饰并挂接到自身身体；预览加入该形态，共8种成长形态，并支持独立两倍放大。

## 检查

`src/wear-contact.test.ts` 使用真实身体遮罩和解包后的原服饰透明像素，检查初级、中级、高级及5种最终形态的方向姿态，不只比较外框。`scripts/wardrobe-contact-metrics.cjs` 在浏览器中另行读取原遮罩、实际服饰画布和DOM显示尺寸，测量屏幕上的接缝，避免只相信播放器自己报告的数值。

```sh
npm test
node scripts/record-wardrobe-motion.cjs \
  --out artifacts/wardrobe-fit-review \
  --frames local-assets/research/wardrobe-polish-recording \
  --contact-check
node scripts/wardrobe-expansion-check.cjs
```

最终逐形态结果位于 `artifacts/wardrobe-fit-review/movement-recording-checks.json`，浏览器录制每一帧同时检查服饰非空、没有越界、正确层级和头饰接缝。8个GIF使用实际播放器截图；原素材及跨形态适配范围见 `public/assets/original/wardrobe-motion/README.md`。存档路径、存储键和玩家所有权均未更改。本轮仅预览，未推送或发版。
