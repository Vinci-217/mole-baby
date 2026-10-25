# 原拉姆眼白与瞳孔分层

每张图两格：第一格为原正常身体、叶片与眼白，第二格只有两颗原瞳孔。种子单格96×99，其他形态192×208。正常身体注册、眼白大小、服饰坐标与四色变色规则保留；运行时仅平移瞳孔，让它们在原眼白内绕圈，末段缓缓复位。头顶星星保持原有提示。

这是原素材分层后的桌面适配，不是官方完整眩晕片段。没有画新眼睛或替换原角色。来源、瞳孔边界和轨道幅度见source.json；PNG校验见checksums.json。

导出：`python3 scripts/art/export-dizzy.py --ordinary-xml /path/lamubone.xml --sources /path/element-xml --work /tmp/dizzy --ffdec /path/ffdec-cli.jar`。源XML与工具同slumber导出。独立导出身体层和瞳孔层，隐藏祖先容器内的其他叶冠/装饰；所有透明源放置保留以固定原边界，再按原身体遮罩配准。
