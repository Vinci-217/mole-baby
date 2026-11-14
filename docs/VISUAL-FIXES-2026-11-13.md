# 留言板、动作显示与加载修复验收

本轮修改位于 `preview/v0333-wardrobe-audit`，基于 v0.33.3。交付的是本地源码和网页预览；未创建正式版本、推送代码或修改自动更新渠道。原 Windows 测试安装包尚未重建，不包含本轮修复。

## 问题与修复

| 问题 | 原因与处理 |
| --- | --- |
| 留言框“保存”文字重叠 | 原素材自带按钮文字，全局禁用样式把上层按钮变为半透明，露出了底图文字。让禁用按钮保持不透明，继续用可读的 HTML 标签。 |
| 涂鸦、左右伸出的动作被截断 | 桌面原先仅为装扮扩展绘制窗口。现在原片动作和道具也可提交完整画布边界；动作结束恢复窗口，拉姆身体尺寸不变。自动三系动作同样使用展开边界。 |
| 变盒子过大 | 原来所有形态共用 160% 画布比例。现在按盒子实际可见像素与各形态身体宽度、脚底位置校准；烟雾独立绘制。原三系动作素材保留。 |
| 一些动作启动慢 | 菜单动作 ID 过去会再次启动 SWF 播放器，即使同一动作已有完整本地帧。现在优先复用对应帧图集；后续形态已选用的经典原片也复用同一份图集，并按身体尺寸定位。 |
| 大图着色期间响应慢 | 保持原像素计算和完整图集，分段让出主线程；支持时使用浏览器调度器，兼容路径使用消息任务，避免嵌套计时器的额外等待。鼠标悬停或键盘聚焦道具时只预热选中的动作。 |
| 自主动作没有说明或只有 bibo | 为自然动作、玩耍和魔法生成具体中文意图气泡，说明不受语言毕业状态影响；普通说话继续遵循原语言规则。安静模式仍生效。 |
| 每日领取 1000 豆有奇怪音效 | 移除签到的游戏奖励声音调用，保留领取、豆数增加和记忆记录。其他游戏音效开关不变。 |

生产构建还统一了运行资源枚举：本地 `downloads/` 安装包服务目录不参与游戏/PWA 资源哈希，避免保留下载目录重建时把目录链接当成素材读取。

## 实际验证

- TypeScript 与生产构建通过；前端 71 个测试文件、507 项测试通过，桌面/更新/打包 Node 测试 189 项通过。
- Chromium 中逐一播放 8 种成年形态的变盒子，以及初级、中级、高级、经典超拉各 4 段涂鸦。核对实际像素、完整源画布、帧推进，无缺失请求和页面异常。
- 校验 247 份本地动作表、225,327 处图块位置，全部位于其导出画布内。
- 真实 Linux Electron：无装扮神力形态播放已有经典涂鸦原片，完整画布位于原生扩展窗口内；退出动作恢复窗口，身体显示比例、身份及成长记录保持不变。
- 真实 Linux Electron：摸头、连续摸头晕眩、穿衣足球、三系魔法、变盒子、打断及重新加载，共 9 项专项动作回归通过。
- 留言板实际新增、编辑、回复、完成、删除通过；模拟写入失败后保留输入，重试仅新增一次。既有留言和拉姆身份保留。
- 390×844 浏览器窄屏：空白禁用按钮无重影、编辑框在屏幕内，实际保存和删除通过。这是窄屏界面测试，不等同于 Android/iPhone 实机验证。
- 开启游戏音效后实际领取 1000 豆，豆数正确增加，未播放游戏奖励音效；未语言毕业的拉姆实际显示“我想练习写字，一会儿再来陪你。”
- 最终生产资源清单包含 4,327 个本地文件、633.57 MB；无损处理 918 张图片，保留完整运行素材与原栅格备用资源。未更改原始 SWF、帧数或素材质量。

## 加载速度的实际范围

最终浏览器回归中，16 段涂鸦在本次进程内首次准备图集约 964～2,712 毫秒，中位数 1,239 毫秒；已准备图集重新播放约 40 毫秒。测试沿用已有 QA 浏览器档案，没有清理 HTTP 缓存；这些数字描述本机播放准备和界面等待，不能当作网络下载速度或所有设备的保证。

预热减少点选后的等待，着色分段减少界面阻塞，但首次读取、解码和着色仍然需要时间。未删帧或压低桌面素材分辨率来换取这些结果。

## 复核方式与证据

先等待生产构建及最后的 `Lossless assets` 汇总全部结束，确保预览服务已启动，再运行界面回归。

```sh
npm test
VITE_WEB_APP=1 VITE_LOCAL_DEBUG=0 npm run build -- --emptyOutDir false
node scripts/visual-bounds-regression.cjs
node scripts/interaction-feedback-regression.cjs
node scripts/mobile-board-regression.cjs
xvfb-run -a -s '-screen 0 1920x1200x24' node scripts/board-scale-regression.cjs --native
xvfb-run -a -s '-screen 0 1920x1200x24' node scripts/native-drawing-bounds-regression.cjs
xvfb-run -a -s '-screen 0 1920x1200x24' node scripts/animation-repair-regression.cjs --native --quick
```

脚本沿用各自独立 QA 档案，不重置用户记录。签到测试当天重复执行会跳过领取，并如实记录本次没有领取；首次成功领取回执已保留。

- `artifacts/visual-bounds-review/checks.json`：尺寸、涂鸦像素和加载时间。
- `artifacts/visual-bounds-review/body-sized-transformation.gif`：实际运行画面，左边原形、右边变盒子；1000×570，46 帧，4.6 秒循环。
- `artifacts/board-scale-review/native-checks.json`：真实桌面留言和缩放操作。
- `artifacts/native-drawing-review/checks.json`：完整绘画窗口及退出恢复。
- `artifacts/interaction-feedback-review/checks.json`：签到静音、中文动作说明与记录保留。
- `artifacts/interaction-feedback-review/mobile-board-checks.json`：窄屏留言操作。
- `artifacts/animation-repair/electron-checks.json`：9 项原生动作及存档回归。

本轮未进行 Windows/macOS 原生安装或手机实机测试，Linux Electron 与浏览器结果不能替代这些平台验收。没有删除、迁移或重置现有玩家存档。
