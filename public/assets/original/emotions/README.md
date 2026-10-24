# 原版心情动作

`joy` 取各形态原 `happy` 时间轴，按原24fps和原停留帧播放；中级原片很短，重复三次后结束。`grumpy` 取原 `angry` 前34帧，再按原帧反向舒展开来，形成一次短暂的皱眉。初级后段有很大的喊叫嘴型，这次不采用。它们是经过选择和剪辑的桌宠心情表达，不冒充未修改的整段官方动作。

`runtime.json` 记录原 sprite/clip、源帧序号、映射和各阶段的实际时长；`source.json` 与 `checksums.json` 记录 SWF 和输出 PNG 哈希。身体、眼睛、叶片来自同一原帧，沿用身体灰阶遮罩适配原四色，没有重画表情。

复现（Python、Pillow、NumPy、Java、JPEXS 26.3）：

```sh
python3 scripts/art/prepare-original-actions.py --ordinary-xml /path/to/lamubone.xml --sources /path/to/evolution-xml --work /tmp/mole-emotions --ffdec /path/to/ffdec-cli.jar --actions angry,happy,boring
python3 scripts/art/pack-emotions.py --work /tmp/mole-emotions
```

安心眯眼、困倦小哈欠使用已经导出的原眼部、嘴型与正常身体；种子使用独立身体层，不搬动花盆。实际心情根据当前需要和仍保留的真实记忆选择，静默、忙碌或缺少基本照料时不自动发起；所有自发动作不增加数值和经历奖励。
