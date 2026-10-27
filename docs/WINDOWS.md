# Windows 版本与兼容包

| 系统 | 安装包后缀 | 便携包后缀 | 运行时 |
| --- | --- | --- | --- |
| Windows 10/11，64位 | `-Setup.exe` | `-x64.zip` | Electron 35 |
| Windows 7 SP1 / 8 / 8.1，64位 | `-legacy-x64-Setup.exe` | `-legacy-x64.zip` | Electron 22.3.27 |
| Windows 7 SP1 / 8 / 8.1，32位；32位Windows10 | `-legacy-ia32-Setup.exe` | `-legacy-ia32.zip` | Electron 22.3.27 |

按Win+R输入`winver`看系统版本，在「计算机／此电脑 → 属性」查看32位或64位。ZIP必须完整解压再打开，不能只复制exe。下载不完整、架构不符、在老系统运行较新Electron程序，都可能导致「此应用无法在你的电脑上运行」；这张报错本身不能确定唯一原因。

Electron官方从23起不再支持Windows7/8/8.1，因此兼容包固定使用最后的22系版本，构建工具仍使用现代Node；构建Node不会安装到用户电脑。[官方兼容说明](https://www.electronjs.org/docs/latest/breaking-changes#removed-windows-7--8--81-support)。XP、Vista和Windows7 SP0不在支持范围内。

兼容版默认使用CPU绘制Canvas2D界面，并保留显示合成需要的软件绘制后备路径。Chromium仍会启动显示服务；其旧GPU沙箱可能与新Windows虚拟显示驱动冲突，因此兼容版仅关闭GPU服务的沙箱，页面的sandbox和context isolation继续开启。应用身份与安装目录同样与常规版分开。

兼容版与老系统已停止安全维护。渲染器仅加载打包的本地界面，生产CSP阻止外部脚本与远程连接，保留context isolation与sandbox；更新只访问固定发布源。这些隔离措施不能替代运行时的安全维护。

## 更新与存档

常规版使用`latest.yml`；兼容版按架构使用`legacy-x64.yml`或`legacy-ia32.yml`，不自动切换运行时或架构。发现新版和安装前分别确认，退出应用不自动安装。

常规版沿用原存档目录，兼容版使用`mole-baby-legacy`，避免旧Chromium读写新版本的数据目录。跨版切换先从小屋设置导出JSON，再在另一个版本导入；保留备份，不手工覆盖Chromium目录。32/64位兼容版之间可沿用兼容版目录。

## 开发与验证

```sh
npm ci
npm test
npm run dist:win:legacy:x64
npm run dist:win:legacy:ia32
```

CI在最新Windows验收常规x64，在Windows Server 2022验收兼容x64与兼容ia32，避免将已停止维护的Chromium108只放在更新的Server2025驱动环境中验收。检查PE架构和边界、ZIP内每个文件的CRC及与实际测试成品的一致性，启动程序并测试领养、照料、小屋、透明窗口、更新设置、存档回执及安装器完成页。全部平台通过后才发布。

本地另以Electron22.3.27 / Node16 / Chromium108运行生产页面检查领养、用品提示、照料与小屋设置，并执行阻止外部脚本的实际CSP探针。这验证旧运行时API与页面兼容性，不能代替Windows7/8/8.1实机测试。当前云环境没有这些系统的虚拟机，不能声称已完成其驱动、DWM、DPI、字体与系统补丁组合的验收。
