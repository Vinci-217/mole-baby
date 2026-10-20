# 原拉姆分层动作图集

每张图为 5×1 格，单格 192×208：身体与眼白、半闭眼、原开心闭眼线、瞳孔、叶片。初级没有叶片，第五格为空；中级两片叶子与原身体分层。四色沿用原加色变换，眼白、瞳孔、叶片保持原色。

身体来自 `lamubone.swf`：初级 root936/body63/down第3帧，中级 root1532/body947/down第1帧；闭眼线是原 shape665，按原眼睛中心缩放摆放。运行时呼吸、眨眼时序、目光和小幅叶片摆动为桌宠适配，不是官方完整待机动画。没有 SVG 重画身体，也没有用新生成图替换角色。

来源、配准与文件哈希见 [source.json](source.json)。开发导出需要 Java、JPEXS 26.3.0、Python Pillow/NumPy，以及来源文件（核对 source.json 的 SHA256）：

```bash
java -Djava.awt.headless=true -jar /path/to/ffdec-cli.jar -swf2xml lamubone.swf /tmp/lamubone.xml
python3 scripts/art/grounded-prepare.py --work /tmp/ramu-grounded --xml /tmp/lamubone.xml --ffdec /path/to/ffdec-cli.jar
python3 scripts/art/grounded-export.py --work /tmp/ramu-grounded --ffdec /path/to/ffdec-cli.jar
python3 scripts/art/grounded-pack.py --work /tmp/ramu-grounded
```

所有变体保留透明的原放置以固定导出边界，使用同一个比例与偏移，避免眨眼、摸摸时重新按包围盒缩放导致身体跳动。neutral/probe 的差分还原三层身体覆盖率，不染色眼白、眼线和叶片。原解析器、导出与遮罩方法参考 `mli55/taomi-codex-pets` 的 `scripts/export-ram-levels.py` 和 `scripts/compose-selected-actions.py`，本目录新增动作使用本仓库的固定姿势分层流程。
