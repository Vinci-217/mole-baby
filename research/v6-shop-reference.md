# v0.6 背包与书本商店的参考和实现

## 实际检查过的素材

本次实际打开并查看了以下原客户端导出 PNG，而不是仅凭记忆描述：

- `public/assets/original/ui/reference-pet-panel.png`：原 `petUI.swf` 的 `DefineSprite_182_petPanelMC`，原面板右侧为三列四行道具格，白底、亮橙线、右侧分类页签，页码和三角翻页按钮位于底部。
- `public/assets/original/ui/reference-classic-pet-panel.png`：原 `ui.swf` 的 `DefineSprite_4081_pet_panel_pet_panel`，橙黄外框、白内页、少量大状态图标。
- `public/assets/original/ui/icon-book-large.png`：原 `petUI.swf` `DefineShape_161` 的棕黄色书本图标；商店标题使用此图，不把它冒称为商品目录原界面。
- `artifacts/v5-shop.png`：旧桌面侧窗的双列/列表式商店，逐条显示所有说明，文字过密，且桌面直接买货。
- `public/assets/original/items/petfood.xml`、`items/sources.json`：继续采用真实物品名称、效果和同 ID 图案；不为新 UI 虚构商品或替换素材名称。

资源来自社区原客户端存档 [Miigon/RecMoleRes](https://github.com/Miigon/RecMoleRes)，固定提交 `7a6d6b3c7037a85afb28ad6abd4d7f4adfddb5ff`。原拉姆面板 SWF：

`https://raw.githubusercontent.com/Miigon/RecMoleRes/7a6d6b3c7037a85afb28ad6abd4d7f4adfddb5ff/root/module/petUI/petUI.swf`

精确角色编号、导出比例、原 PNG 校验值见 `public/assets/original/ui/manifest.json` 与 `SOURCES.md`。本次没有找到并验证原页游商店图书的完整展开截图，不声称新书本页面是原界面的逐像素重现。

## 视觉决策

遵照用户要求，将背包改为 **三列三行**；原面板实际上三列四行，这一处是为桌面小窗主动适配。九格只显示道具大图和库存数量，选中后在下面显示名称、一行合并后的效果、使用按钮。没有把效果说明重复挤进九个格子。没有库存的已有商品会变淡，尾页保留空槽，分类和页码始终保留。普通字号为 13–16px，小侧窗的数量和次要效果最低 12px。

商店用四本可切换的商品目录：美味食谱、咕嘟饮品、香香手册、健康宝典。分类书本使用同一原道具 PNG 和橙黄/白色语汇，封皮和白纸双页以 CSS 排版，避开复杂木纹、皮革、铜钉或厚重仿古材质。打开后左页九宫格商品，右页只放选中商品大图、名称、效果、现有数量和价格按钮。窄屏把书页上下排列，交互保持不变。没有生成或重画拉姆角色。

## 交互范围

- `CarePocket` 只有库存选择和 `onCare`。保留旧 `onBuy` 参数兼容，但不调用；侧窗绝不显示购买按钮。
- `onVisitShop` 是导航入口，桌面显示“到小屋补充”，小屋背包可显示“去商店补充”。是否实际进入房间由 App 控制。
- 独立 `ShopBook` 只在小屋渲染。`onBuy` 交给 App 的既有交易函数扣摩尔豆、增加库存、给出实际结果；UI 不直接修改库存，也不会用前端提示替代真实购买。
- 商店按摩尔豆不足或库存满禁用购买；阶段限制保留为可提前购买、到对应阶段才使用。
- 翻页保留每页九格；换分类回到第一页；每格的 `data-item-id`、库存 `data-count`、选中 `aria-pressed`、按钮中文标签供键盘辅助和端到端检查。

## 实际验证

通过 Vite 加载真实组件、真实 `createPet` / `buyItem` / `care` 状态函数，在 Chromium 中检查：

- 背包恰好九格，食物可翻到第二页，再返回第一页；四分类正常切换。
- 背包没有购买按钮，空库存无法使用，去小屋补充仅触发导航。
- 商店四本书；食物第二页切到药水书后回到第 1 / 1 页；400 豆药水在余额不足时不能购买。
- 从 100 豆买一份 15 豆熊熊饼干，余额成为 85、库存成为 1，回背包使用后库存成为 0，饱食增加。
- 332px 背包内容宽 306px，九宫格列宽约 98.7px，无横向溢出；390px 页面书页变为上下排列，无横向溢出。
- 850px 商店、332px 背包、390px 商店截图已实际打开检查；没有角色重绘，也没有每格重复塞效果小字。

这些是组件级 UI 检查，完整的小屋入口和原生窗口生命周期另由整体回归验证。
