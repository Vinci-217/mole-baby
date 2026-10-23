# 原版足球动作

角色、球、眼睛与叶片来自原客户端同一 `football` 时间轴，按原 24fps 播放。没有另造一个球的轨迹盖在静止角色上。初级 257 帧、中级 148 帧、高级与水/木/火各 143 帧、神力超拉 110 帧；原末帧清空显示列表的空帧不播放。完全相同的图像共用图集格子，`frameMap` 仍保留原帧时长。

原演出包含很长的横向走动和高跳。桌宠使用一组共同的平移/缩放将演出留在透明绘制区域内，身体与球始终一起变换，保留爬球、踩球、顶球和落下的接触关系；离得很远的球或装饰可能暂时离开视口。身体不根据远处装饰一起缩成小点。普通宠物、拖拽热区与原生窗口尺寸没有扩大。

每格 160×192，8 列，运行时绘制到原角色之外的透明留白。各形态的源 sprite、原帧与图集映射、每帧身体/球包围盒、共同变换和核对的音效帧见 [manifest.json](manifest.json)。[runtime.json](runtime.json) 只保留播放需要的精简数据；[source.json](source.json) 记录原 SWF URL 与 SHA-256，[checksums.json](checksums.json) 记录 PNG 校验值。应用只播放 PNG，不运行 Flash。

可复现导出（Python 3、Pillow、NumPy、SciPy、Java、JPEXS 26.3）：

```sh
python3 scripts/art/prepare-original-actions.py \
  --ordinary-xml /path/to/lamubone.xml \
  --sources /path/to/evolution-xml-files \
  --work /tmp/mole-original-actions \
  --ffdec /path/to/ffdec-cli.jar
python3 scripts/art/pack-original-football.py --work /tmp/mole-original-actions
```

神力输入命名 `super.xml`、`water.xml`、`wood.xml`、`fire.xml`；XML 由同版本 JPEXS 从记录中匹配 SHA-256 的 SWF 导出。准备步骤也导出 `boring`、`happy` 供动作对照，这些不冒充独立的官方睡眠或摸头动作。验证命令：`npm run test:original-actions`。
