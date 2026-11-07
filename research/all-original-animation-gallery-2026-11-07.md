# 全部接入素材的 GIF 预览目录

用户要求逐项查看全部新接入的内容。本轮提供独立 GIF 目录、可直接离线打开的 HTML、中文 CSV 及 ZIP。没有修改玩家存档，也没有 push、发版或更新 latest。

范围为当前 manifest 的全部 567 项：装扮 122、道具互动 251、课堂 109、魔法 27、变身 30、技能 27、基础身体 1。衣橱实际新增为 110 件；旧 12 件装扮的原片同时保留在目录中。532 份源文件含多帧，35 份静态，另有多帧源文件在选定形态下停驻。以实际录制的帧变化标注，不能把每一项都称作新增完整动作。

每项从桌宠使用的同一离线 runtime 和原 SWF 控制器录制 canvas，再转为 GIF。记录采用已核对的蓝色偏移 `(-215, -57, 31)`，等待骨骼与染色稳定后采集。装扮依次展示正面、左移和右移；一般截取约 4 秒，短片遇到原结束事件提前收尾，不重绘、不插帧。预览选用的形态和原件支持的其他形态列在每项详情里。

录制器每 8 项回收浏览器，避免累积 WASM 和 worker；结果保存在 `artifacts/all-original-animations/captures.jsonl`，按录制版本及播放器哈希缓存。全部原件 SHA-256 和预览服务器使用的构建控制器／runtime 副本已逐项核对。

`artifacts/all-original-animations/` 是独立、无需 Flash 的预览站点，具有分类、名称／编号搜索、新衣橱筛选、停驻／变化筛选、分页、大图、前后切换和原件来源。元数据内嵌于 HTML，不依赖 fetch，因此 ZIP 解压后可以直接用 `file://` 打开。每页最多 12 个 GIF，适配手机。

复现步骤：

```sh
node scripts/record-all-original-animations.cjs
node scripts/build-original-animation-gallery.cjs
node scripts/build-original-animation-overview.cjs
```

`CAPTURE_SHARD=0/2` 和 `CAPTURE_SHARD=1/2` 可分别录制互不重叠的条目；不要在同一条目上重复运行。不会覆盖固定原件库。最终覆盖数量、文件解码、网页分类和离线打开检查以交付目录中的回执为准。

最终结果：567/567 录制成功且全部 GIF 完整解码，507 项在录制画面中有变化，60 项停驻或静态。6 个一次性外壳改为选择其原导出的可重播节点：skillsource/2、4 的 `2_fla.ctp11_1`，以及四个阶段时空感应的 `shikongganying_fla.Timeline_1`；控制器和原件未改。产品构建、TypeScript 和相关 4 项测试通过。

网页检查通过全部 567 个 GIF 地址、7 类计数、110 新衣橱筛选、搜索魔法书、大图、翻页、停驻／变化筛选、393px／320px 布局和无 HTTP 服务的离线 HTML 打开。页面错误为 0。实际桌宠足球入口启动原片、自然结束后恢复普通拉姆、紫色和背包保留均通过。回执：交付目录 `checks.json`。ZIP 包含 567 个逐项 GIF、HTML、清单和总览，CRC 检查通过。
