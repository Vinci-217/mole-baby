# 原版拉姆小配饰

从原客户端 `resource/petcloth/swf/cloth/` 提取三件完整 sprite2。原舞台导出会裁切一部分配饰；本版使用完整 sprite 的透明边界，保留原轮廓、颜色和细节，缩放至最长192px。原文件 URL、SHA-256、款式编号见 `source.json`；输出见 `checksums.json`。

商品显示名和价格是本地设计，不声称对应官方商品名称/售价。仅支持一个头饰位；后续全套服饰所需的素材与分层说明见 [装扮实现说明](../../../../docs/WARDROBE.md)。

```sh
python3 scripts/art/export-wardrobe.py --sources /path/to/original-accessory-swfs --work /tmp/mole-accessories --ffdec /path/to/ffdec-cli.jar
```

文件应命名 `1200008.swf`、`1200018.swf`、`1200020.swf`，哈希与 `source.json` 一致。PNG 不染成身体颜色。运行时只使用 PNG，不执行原 Flash。
