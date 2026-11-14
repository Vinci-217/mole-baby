# 网页体验版与 PWA

本包来自当前 v0.33.3 动画修复预览，仅包含浏览器客户端与完整运行素材。打开后直接进入小屋，不提供系统桌面悬浮。没有接入此前暂停的账号、好友或服务器项目。

## 本地构建

```sh
npm ci
node scripts/package-web.cjs
```

脚本在当前云电脑完成生产构建、逐像素无损图片检查、完整离线资源核验、网页 ZIP 与 SHA256。不会触发 GitHub Actions 或发布 Release。输出：

- `dist/`：可部署的静态网站全部文件。
- `release/mole-baby-0.33.3-web-preview.zip`：网页部署包，解压后根目录直接包含 index.html。
- 同名 `.zip.sha256`：部署包校验值。
- `release/web-package-report.json`：文件数量、素材字节数和校验记录。

打桌面包时仍用正常的 `npm run build` 及现有平台打包命令；`package-web.cjs` 单独设置网页构建标志，不改全局环境变量。

## 部署与打开

把部署包解压后的全部内容上传到静态网站目录，保留 assets、icons 等目录结构。根目录或子目录部署均可，相对地址自动适配。无需数据库、Node 常驻后端或安装 GitHub Actions。

正式分享给玩家使用稳定的 HTTPS 地址；本地开发的 localhost 也可以启用 PWA。不要双击 index.html 以 file:// 方式打开：浏览器对模块与素材读取有限制。

服务器应正确返回 `.js` 的 JavaScript 类型、`.wasm` 的 `application/wasm`、`.webmanifest` 的 `application/manifest+json`，缺失文件返回 404。`sw.js` 和 `index.html` 不要设置长期 HTTP 缓存。带内容哈希的 JS/CSS/WASM 可以长期缓存。

本轮先提供 Room 预览和部署包供检查，没有启用新的公开 GitHub Pages 或修改正式自动更新渠道。Room 预览用于审阅，长期对外体验需要稳定托管。

## PWA 的含义

PWA 是可添加到主屏幕的网页应用。用户无需 App Store，普通浏览器也能打开；添加后有独立图标，通常以独立窗口运行。本包提供安装清单、主屏幕图标与 Service Worker。

- iPhone/iPad：Safari → 分享 → 添加到主屏幕。
- 支持安装的安卓/电脑浏览器：菜单 → 安装应用或添加到主屏幕。
- 页面及已缓存的近期素材可离线使用；没有访问过的装扮、动作或音乐首次需要联网。
- 首次进入只准备页面，不自动下载全部约 628 MB 素材。其余按需缓存；动态资源最多保留 128 项，并优先保留已使用的原片引擎。浏览器也可能根据设备空间回收缓存。
- 新版网页安装完成后等待所有旧窗口关闭，再启用新版本，避免旧动作逻辑与新版原片混用。不会自动刷新玩家正在操作的页面。

## 存档

沿用 `ramu-house-save-v1`、回忆及偏好设置的原键，不创建新的宠物记录覆盖旧档。网页进度保存在当前浏览器、当前网站的数据中，与桌面客户端的用户目录独立，通过设置里的 JSON 导入/导出迁移。

苹果 Safari 与主屏幕应用使用独立存储，不能承诺自动复制 localStorage。建议先添加到主屏幕再领养；已有存档先在 Safari 导出，再在主屏幕版导入。领养页也提供导入入口。不会为了安装 PWA、更新网页或清理素材缓存而清空存档。

Service Worker 只管理以 `mole-baby-web-core-`、`mole-baby-web-media-` 开头的程序缓存，不操作 localStorage、IndexedDB 存档、原片截图缓存或其他网站缓存。

## 资源速度与已修复问题

已确认并修复的原因包括：错误的网站根路径导致原生素材找不到、换衣重建 iframe/WASM、重复读取原片、站立首帧等待无关图集，以及被面板遮挡的播放器继续争抢绘制资源。装扮初始化期间还会先显示与原片、形态和颜色匹配的本地 PNG 画面，再接完整时间轴。

网页版增加页面与按需素材缓存。不能把“网页首次访问不用下载”和“所有设备首次 SWF 初始化都为零”当成交付承诺。完整原片与所有无损素材仍在部署包内；没有删帧、降低分辨率或把静态过渡画面当作完整动画。具体回归与耗时记录见 `artifacts/web-review/` 和 `docs/BOARD-LOADING-SCALE-2026-11-13.md`。

Chrome 的真实回归还发现：动画引擎虽能正常编译，流式 WASM 响应直接写入离线缓存会报 NetworkError。现在只对缓存副本读取完整字节后写入，原播放响应继续流式传输。缓存写入失败不阻塞在线运行；只存完整的 200 响应，不把 206 音频分段当作完整资源。

PWA 安装说明参考 [MDN](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Installing)，苹果存储隔离参考 [WebKit](https://webkit.org/blog/14787/webkit-features-in-safari-17-2/)。
