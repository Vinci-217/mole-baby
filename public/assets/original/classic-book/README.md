# 原版拉姆面板导出

来自 `petUI.swf` 的双页面板182，固定源URL、SWF哈希与原按钮编号见source.json；PNG哈希见checksums.json。layout.json中的rect是逻辑坐标，图片像素为其2倍，供Retina显示。

从固定源SWF导出XML后，在仓库根目录运行：

```sh
java -Djava.awt.headless=true -jar ffdec-cli.jar -swf2xml petUI.swf petUI.xml
python scripts/art/export-classic-book.py --xml petUI.xml --swf petUI.swf --work /tmp/classic-book --ffdec ffdec-cli.jar
```

JPEXS 26.3、Python3与Pillow。脚本克隆原显示列表，保留原配准、框体与静态标签，隐藏可变头像/数字；文本框另外清空，避免导出器忽略父透明度。按钮三态单独提取，新的运行时分类说明由HTML提供。第六个页边从同一原框体裁取。逻辑画布1100×688，原1200宽输出末尾的隐藏提示留白不参与布局。所有图像均为已有原素材的导出/裁取，没有新绘制或生成的UI。
