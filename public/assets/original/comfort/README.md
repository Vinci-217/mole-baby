# 原版闭眼表情层

高级、超级拉姆、水、木、火五种飞行形态各有一张 6 × 1 图集，单格 192 × 208。运行时仍使用原版四色加法配色，只改变身体覆盖率，保留头冠、眼睛和装饰原色。

闭眼线来自 `lamubone.swf` 的原 shape665，放回各形态原 down 身体的眼睛位置，并隐藏原瞳孔。导出后只把眼睛区域配回已有原版正面六帧，其余身体、轮廓和头冠逐像素保留。这样表情切换不会改变头冠的动画相位或身体比例。睡觉保持第一帧，摸头沿用连续飞行帧；呼吸、蹭手、接球与醒来时序是桌宠适配，不冒充原游戏的整段官方动画。

源 URL、社区存档地址、SWF 与输出图集 SHA-256、原 sprite ID、采样帧和眼睛区域见 [source.json](source.json)。基础身体来自已有 `assets/classic` 图集，来源记录仍保留在该目录。种子、初级、中级复用已有 seed / grounded 闭眼层。

可复现导出需要 Python 3、Pillow、NumPy、Java 和 JPEXS 26.3；SWF 不随应用运行：

```sh
python3 scripts/art/export-comfort.py \
  --sources /path/to/super-water-wood-fire-swf-and-xml \
  --ordinary-xml /path/to/lamubone.xml \
  --ffdec /path/to/ffdec-cli.jar \
  --work /tmp/mole-comfort
```

四份神力源文件使用 `super.swf/.xml`、`water.swf/.xml`、`wood.swf/.xml`、`fire.swf/.xml` 命名，XML 通过同版本 JPEXS `-swf2xml` 导出。`--reuse-exports` 可只重新打包已经导出的 PNG。录屏还需 `npx playwright install ffmpeg`。验证：`npm run test:comfort-motion`，会生成八形态 × 四色的睡觉、摸头、接球、醒来、读书截图和实时 WebM。
