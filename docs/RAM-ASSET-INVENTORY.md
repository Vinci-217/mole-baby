# 拉姆相关素材专题档案

本轮只整理、索引和预览已有本地素材，不下载新原件，不进入应用安装包。

## 查看

复用已有素材库服务（5181）：`/ram-inventory/`。原素材库首页也已加入专题入口。

- 六份书籍支持逐画面翻阅：拉姆生活手册、拉姆学习手册、拉姆手册（宠物用品目录）、拉姆食谱、拉姆小导师、超级拉姆的秘密。
- 77 个原时间轴画面均从已保存 SWF 渲染；包含封面、封底和过渡，不是印刷页数。仅裁去透明边缘，未重绘、缩小或替换内容。书中购物和账号状态仅显示原图。
- 拉姆救治手册 `12738`、拉姆教科书 `13572`、拉姆魔法书 `12904` 是摩尔服饰／手持物；魔法书 `1200026` 是拉姆装扮动作。专题提供单独的检索入口。
- 支持名称、编号、路径、原动作标签检索，分类和来源过滤，完整及当前结果 CSV 导出。查看源文件时可选来源版本；关闭播放器会移除 iframe，释放播放器。

## 范围与核对

2026-11-17 结果：1,753 条已保存源路径（1,679 SWF、67 XML、7 MP3），14 类，2,215 个来源记录。925 条来自固定客户端存档，1,290 条来自官方补录；重叠路径归并展示。两个地图文件 `resource/map/304.swf`、`308.swf` 保留不同内容的版本。

来源为固定 `Miigon/RecMoleRes@7a6d6b3c7037a85afb28ad6abd4d7f4adfddb5ff` 全量存档、2026-11-06 官方拉姆补录、原物品配置名称和资源前缀，以及符号／成长骨骼、XML、场景音乐映射。共享场景、主题服饰、家具与配置均保留用途分类和证据，不能将其全部称为独立拉姆动作。

清单以原始源文件为单位。一个文件内的矢量组件、位图、声音与脚本可在详情及完整素材库中查看，不把每个内部组件计成一份完整动画。没有公开的全历史目录，本结果不宣称涵盖所有年代未取得的官方资源。

官方补录的 583 条失败候选中，3 条已有固定存档原件，因此按已保存展示；剩余 580 条单列为未取得候选，不计入已保存数，不在预览时联网重试。

运行产物在 `local-assets/ram-inventory/`：`catalog.json`、`catalog.csv`、`README.md`、`unavailable.json`、`books/*/pages/*.png`。每本书的 `render-source.json` 保存源 SHA-256、sprite、时间轴画面数与渲染命令。原件继续复用 `raw/` 和 `ram-official-sweep/`，不复制整套素材。

## 重建与验证

```sh
# 只重建索引与网页，已生成的书页直接复用：
python3 scripts/client-library/build_ram_inventory.py
# 首次生成／恢复书页，每次只启动一个渲染进程：
python3 scripts/client-library/build_ram_inventory.py --render-books
# 运行已有素材库服务（若原 Website 已运行则直接复用）：
python3 local-assets/server.py --port 5181
# 浏览器验收：
node scripts/client-library/review_ram_inventory.cjs
```

源码：`scripts/client-library/ram-inventory.html`、`ram-inventory-preview.html`、`build_ram_inventory.py`、`trim_ram_pages.cjs`。播放器复用已存 Ruffle 与独立 SWF 适配器，不修改原 SWF。

验收实际检查 2,215 个来源文件引用，77 个书籍画面浏览器解码，名称／编号／路径／标签检索，来源与分类过滤，分页，浏览器真实保存 CSV，原 SWF 像素前进与暂停冻结、形态切换、关闭后卸载播放器，以及 393／320 像素手机宽度的主页面和翻页弹窗。回执和截图在 `artifacts/ram-asset-inventory-20261117/`。

## 磁盘

原素材库约占 9.1 GB，其中原件约 1.75 GB、提取目录约 6.13 GB。脚本与图片数量很大，递归扫描开销明显；专题使用 SQLite 和静态索引，避免逐次遍历提取目录。检查时内存可用约 2.9 GB、inode 使用约 20%，不能据此判断为内存或 inode 耗尽。

本轮清除了当前用户可重建的 Electron 下载、electron-builder、node-gyp、Python 字节码缓存，以及项目允许清理的 TypeScript／Vite 缓存。工具缓存释放约 340 MB。原件、全部提取媒体、Git 历史、已有安装包、运行中的 dist、依赖、QA 档案、存档和已有测试证据保留。

没有可继续归档的大型 P-code（按现有工具最小 8 KB 门槛只读检查为 0 个），未再次压缩或改动原素材。最终磁盘与清理回执见同目录的 `disk-cleanup.json`，新增专题索引和书页约 24 MB；系统可用空间仍不足 1 GB，下一次大型打包前需再检查。
