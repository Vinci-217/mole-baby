# 小屋家具书架预览

本轮位于 `preview/ram-bookshelf-20261117`，供开发预览审阅。

## 原小屋里的体验路径

进入小屋 → 布置小屋 → 家具仓库里的“拉姆书架” → 放进小屋 → 完成布置 → 点书架上的书。

`/?preview=bookshelf` 直接进入同一个 `App` 的原小屋，沿用原场景、拉姆、导航和家具布置。新用户先走原领养流程；已有用户使用当前来源下正常的游戏存档。

书架免费可用，每层最多 7 本，每页两层。第一页从《拉姆手册》开始，后面收录庄园故事、职业手册、纪念册和早期《摩尔时报》。完整书目与来源见 [READING-LIBRARY.md](READING-LIBRARY.md)。

旧档只增加可用的家具仓库入口，不自动摆放、不扣摩尔豆。书架沿用原家具的拖动、复制、缩放和收回；手机上可先收起仓库再选家具。

## 翻书架与阅读

- 书脊在两层木架上紧密竖放。图书用与内容对应的插画、装订配色和简写书名。《摩尔时报》各期用统一的棕金装订。鼠标悬停或键盘聚焦时，书脊发光并轻轻抬起。点击、触屏轻点或按 Enter 可取书。
- 用左右木色箭头换一组藏书，或点中间页码直接跳转。第一页和最后一页的对应箭头禁用。
- 点击书架边框可继续当前书架页最近阅读的书，也可打开当前页第一本。
- 书架分页按钮只在完成布置后出现，手机按钮为 34 × 34 像素。复制出的书架从第一页开始，各个书架分别记住自己的页码。
- 阅读只展示原书本，没有额外窗口、标题栏、藏书列表、页码选择器或工具栏。
- 封面右下角翻开；书页右下角前进、左下角后退，包含返回封面。
- 原画关闭叉号、书外空白或 Escape 合上书本；键盘左右键也可翻页。Tab 焦点限制在书本内，合上后恢复焦点。
- 每本书独立记忆阅读位置。图片失败才出现重试提示。

阅读期间沿用正常 App 暂停拉姆动画和阻止地面走动的行为。

## 原素材与派生书页

书页沿用封面、内页、封底及部分原过渡。书中账号、奖励、购买等内容为静态历史画面。

此前的已选书页沿用 PNG，新增书页从本地只读 SWF 导出为高质量 WebP。长时间轴依据原 ActionScript 的停帧选择阅读画面。书页与本地派生缓存使用硬链接，减少重复占用。

`public/assets/original/reading-books/` 中：

- `catalog.json`：书名、来源、封面与页面路径。
- `source.json`：原 SWF SHA-256、sprite、所选原帧编号、文字适配记录与每张书页图片的 SHA-256。
- `layout.json`：书面坐标、透明外边缘、原按钮位置和显示边界。
- `shelf.svg`、`shelf-bounds.json`：本地绘制木框及其点击遮罩。书架造型是本地适配，封面和正文取自原素材。

原创书脊在 `public/assets/generated/reading-spines/`。两张模型原图、参考、提示词和切图坐标见[书脊生成记录](../skills/mole-classic-art/references/reading-spines/generation.json)。

JPEXS 静态导出不能完整重现 Flash HTML 的软换行。新书正文在内存中将原 `<sbr/>` 转为换行，并启用原文字的自动换行；《拉姆世界征文大赛获奖作品集》另将相关正文字号按 86%（最低 11 px）、段落宽度按 85% 适配，避免文字跑出纸面。原插图保留，原 SWF 不写回；派生图片包含这些排版适配，不宣称与未适配的静态渲染逐像素相同。

页面仅裁掉透明外边缘。天使园等个别画面的离纸独立标记不纳入阅读显示边界，完整派生位图仍保留。原六本沿用既有纸面边界及按钮注册；新书沿用原画关闭位置，并在下方页角设置透明点击区。

## 重新生成

```sh
python3 scripts/client-library/prepare_reading_books.py
```

该入口依次准备原六本、计算其几何，再汇入 `reading-book-selections.json` 选定的扩展书库。原六本读取 `local-assets/ram-inventory/` 中已有的导出和来源回执。扩展书库使用原 SWF、已提取脚本与 `local-assets/reading-library/` 派生缓存。只重新渲染来源、所选帧或适配版本变化的书。

单独更新扩展书库可运行 `python3 scripts/client-library/extend_reading_library.py`。单独运行 `prepare_reading_layout.py` 时，扩展书复用自己的已验证几何，不寻找原六本专用回执。所需工具为现有 JPEXS、Java、Python、Node 和项目内 sharp；不联网抓取素材。

临时渲染只移除本次脚本生成的工作目录，原素材、派生缓存与 QA 数据保留。

## 存档

书签保存在同一 `GameState` 的可选 `reading` 字段，如 `{pages:{life:3,rescue:4},lastBook:'rescue'}`；位置从零计数，导入时过滤未知书目并限定合法页数。

每件书架家具在 `room.placed` 中使用可选 `shelfPage`，同样从零计数；移动、缩放、刷新及 JSON 备份均保留，复制的新书架默认第一页。普通家具不会保留该字段。旧档无需迁移，不使用独立演示存档键。

## 验证

```sh
npx tsc -b
npx vitest run src/reading-books.test.ts src/room-furnishings.test.ts src/pet-backup.test.ts src/game.test.ts src/economy.test.ts src/care-balance.test.ts --maxWorkers=2
node scripts/bookshelf-pagination-regression.cjs
```

原 `node scripts/bookshelf-demo-regression.cjs` 入口转到同一套完整书库回归。

回归脚本核对每份独立源和每张书页的摘要。浏览器检查书脊竖排、鼠标高亮、触屏取书、翻页、书架跳页、多个书架分页及存档恢复，输出位于 `artifacts/bookshelf-spines/`。

## 开发预览卡顿

此前 Vite 复现 `ENOSPC: System limit for number of file watchers reached`：开发服务器监听到原件与大量提取结果，并从研究输出发现依赖。

`vite.config.ts` 将依赖入口限制为 `index.html`，忽略 `local-assets`、`artifacts`、`research`、`release` 和 `dist` 的开发监听；应用源码与正式素材仍正常使用。没有调高系统限额、清除原素材或停止其他预览。
