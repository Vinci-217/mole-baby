# 可扩展到小屋书架的原版书籍

本页记录前轮素材核对和候选目录，以下“尚待接入”的判断保留为当时的研究结果。

2026-11-17 后续：按用户确认，已将 54 本去重后的可阅读书籍加入原小屋家具书架，连同原六本共 60 本，支持 10 页书架。征文集文字换行和天使园显示边界已适配。现有实现与验证见 [READING-SHELF-DEMO.md](READING-SHELF-DEMO.md)，最终书目见 [READING-LIBRARY.md](READING-LIBRARY.md)。没有正式发版。

## 建议优先加入的五本

| 书名 | 原时间轴画面 | 内容 | 原文件（`local-assets/raw/root/` 下） |
| --- | ---: | --- | --- |
| 拉姆救治师手册 | 7 | 拉姆救治、职业和病房 | `resource/besmearBook/other/107.swf` |
| 黑森林的向往 | 15 | 拉姆小牛牛的成长与冒险，原封面署名团子 | `resource/besmearBook/other/2.swf` |
| 来自黑森林的超级拉姆 | 8 | 超级拉姆克尔的故事 | `resource/besmearBook/other/8.swf` |
| 拉姆世界征文大赛获奖作品集 | 12 | 拉姆世界冒险的原玩家投稿 | `resource/besmearBook/other/31.swf` |
| 拉姆运动会纪念册·第二届 | 13 | 拉姆运动会比赛与投稿纪念册 | `resource/besmearBook/other/224.swf` |

五本共 55 个原时间轴画面，已全部导出、PNG 解码和浏览器翻阅。数字包含封面、封底和过渡，不等同于印刷页码。正文为原客户端静态画面；不执行原账号、投稿、奖励或购买功能。

《拉姆救治师手册》是新确认的可翻阅读物，与物品编号 `12738` 的“拉姆救治手册”手持服饰素材不同。此前六本专题清单遗漏了上述五本，它们藏在编号书刊路径下。

《拉姆世界征文大赛获奖作品集》的部分静态导出文字超出纸面，接入前应处理排版；不能只裁掉文字后声称完整还原。当前查阅目录展示原始样张，方便看见这一问题。

## 也可扩展的庄园读物

以下五本也已完整导出并解码，封面题名或原客户端加载文字已核对：

| 书名 | 原时间轴画面 | 来源 |
| --- | ---: | --- |
| 自然课本 | 32 | `resource/besmearBook/naturalnessBook.swf`，菩提大伯自然科普；采用卷轴形式 |
| 公民手册 | 19 | `module/external/BooksUI/playerBook.swf` |
| 向导手册 | 8 | `module/external/BooksUI/guideBook.swf` |
| 记者手册 | 5 | `resource/pressman/pressmanBook.swf` |
| 天使园指南 | 11 | `module/external/BooksUI/angelGuideBook.swf`；有少量离开书面的标记，接入时需核对版面边界 |

另有封面和代表内页已确认的《摩尔庄园历史》《黑森林探险之摩尔王的宝藏》《我在星星上》《十年前的黑森林》《2010嘻哈纪念册》《摩尔勇士之战》《庄园好好玩·贺岁版（2014）》，以及消防员、驾驶员、骑士、警官、建筑师等职业手册。当前对这些只展示代表画面，未把抽样检查称为全部内页验收。

## 去重与不直接作为新书的资源

- `other/31.swf` 与 `209.swf` 原字节完全相同；`32.swf` 与 `210.swf` 也完全相同。全部候选中有 15 组这样的重复路径，目录默认合并。
- `other/12.swf` 与公民手册、`104.swf` 与向导手册的四个代表画面分别相同；原文件摘要不同，仍按待合并版本保留，不把抽样相同冒称全文件相同。
- `other/11.swf` 为另一来源的拉姆学习手册；`14.swf` 为另一版本的《超级拉姆的秘密》。应先比较差异，避免同名书堆叠。
- `besmearBook.swf`、`contributeBook.swf`、`smcBook.swf` 是选择书刊的目录入口，本身不算额外一本书。
- 卡牌册、天使图鉴和购物书依赖脚本、账号或商品数据；静态外壳不能算完整收藏／购物功能。
- 《飞龙手册》在根时间轴只有一个画面，内嵌文字存在，需要继续定位脚本切换的正文组件。

## 本次范围和产物

查询完整 SQLite 资源库中路径包含 `book` 的 89 个原件，并沿旧书刊调用补查 `tenYearsAgo.swf`。去除已经接入书架的四份归档原件（另两本来自官方补录）后，本次得到 86 个新增候选路径，按原文件 SHA-256 合并为 71 份原件。**这不是 71 本可直接新增的完整书籍**，其中包括版本、目录和界面。

原件只读复用，未新增网络下载，也未修改 SWF。生成目录位于 `local-assets/book-candidates/`，复用素材库 5181 服务的 `/book-candidates/` 页面；前端模板和书目判断分别在 `scripts/client-library/book-candidates.html`、`book-candidate-assessments.json`。

目录保存源路径、源 SHA-256、原 Git blob、sprite、实际时间轴画面数、展示帧编号与内嵌文字。共 412 张 PNG，保留原非透明像素，只裁透明边缘；完全相同的派生 PNG 使用硬链接，节省约 22 MB，原文件均保留。

```sh
python3 scripts/client-library/prepare_book_candidates.py --full-recommended
cp scripts/client-library/book-candidates.html local-assets/book-candidates/index.html
cp scripts/client-library/book-candidate-assessments.json local-assets/book-candidates/assessments.json
node scripts/client-library/review_book_candidates.cjs
```

浏览器验收包含 1360、393、320 像素宽度，五本优先候选的全部画面翻阅、首尾边界、键盘翻页、Escape 关闭、书名搜索、分组筛选、相同原件去重和视口不溢出。全部 86 个源 SHA-256 与 412 张 PNG 另独立校验。证据在 `artifacts/book-candidates-20261117/verification.json`。
