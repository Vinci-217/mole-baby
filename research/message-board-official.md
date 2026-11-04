# 小屋留言板原素材

2026-11-04 从官方站点直接读取两份 SWF：

- [小屋家具 160131.swf](https://mole.61.com/resource/goods/swf/160131.swf)：绳挂木牌。`ClientAppDLL.swf` 的 `GoodsLogic` 在家具编号 160131 处创建 `GuestBookLogic`。
- [GuestBook.swf](https://mole.61.com/module/external/GuestBook.swf)：留言窗口。`GuestBookLogic` 按此路径加载，`GuestBookUI.main` 使用 sprite 68，六个卡片复用 sprite 54。

使用 JPEXS 26.4.0 导出原矢量图，木牌以 4 倍、窗口以 2 倍分辨率栅格化。保留原木框、蓝色头像、纸张、页脚装饰、铅笔与标题按钮。没有使用生成图片或仿绘。原件及 SHA256 见 [sources.json](references/message-board/sources.json)。

本地交互适配：删除 SWF 中的占位日期、占位文字及联网举报入口，用 HTML 填入玩家本地存档；原“显示/不显示”按钮区域改为待办完成标记。输入框标题按新增、编辑、回复显示本地文字，保留原“提交/取消”图案并对齐点击区域。手机沿用完整三列原布局，可左右滑动。点击标题新增留言，点击正文编辑，回复与删除均只作用于本机记录。

不迁移存档。原 `notes` 数组、id、正文、完成状态和时间戳继续沿用，回复为可选字段；旧存档仍能读取。


2026-11-04 本轮修正：`GuestBook.as` 的列表刷新先隐藏 `book0..5`，再按实际条数显示；`OneMsg` 中的 `reply_mc` 也是按回复有无显示。现将六卡片从 sprite68 背景的实例列表分离，分别导出 sprite54 的有／无回复两种原状态。每页最多六条，零条为空木框，删除末页最后一条后回到有效页。正文、名称、时间与待办控件仍为本地 HTML；木框和卡片原图均未仿绘。桌面版另外用独立 Electron 窗口承载留言板，由主窗口合并、保存留言变更，独立窗口不会运行养成计时或写入整份旧存档。
