const fs = require('node:fs');
const path = require('node:path');
function prepareReleaseNotes(directory, sourceSha, notes, version = require('../package.json').version) {
  if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error('Release guide requires a stable version');
  const receipts = ['arm64', 'x64'].map(arch => {
    const receipt = JSON.parse(fs.readFileSync(path.join(directory, `macos-trust-${arch}.json`), 'utf8'));
    if (receipt.architecture !== arch || receipt.sourceSha !== sourceSha) throw new Error('Mac trust receipt does not match the release source/architecture');
    if (!['local', 'notarized'].includes(receipt.mode)) throw new Error('Unknown Mac distribution mode');
    if (receipt.mode === 'notarized' && (!receipt.developerIdSigned || !receipt.stapled || !receipt.gatekeeperAccepted)) throw new Error('Apple trust verification incomplete');
    return receipt;
  });
  if (receipts[0].mode !== receipts[1].mode) throw new Error('Both Mac architectures must use the same trust level');
  const verified = receipts.every(r => r.mode === 'notarized');
  const trust = verified
    ? '**Mac 信任状态：已通过 Developer ID 签名、Apple 公证、票据装订和 Gatekeeper 验证。**'
    : '**Mac 信任状态：本地签名，尚未经过 Apple 公证；首次打开需要在“隐私与安全”选择“仍要打开”。**';
  const download = name => `https://github.com/Vinci-217/mole-baby/releases/download/v${version}/mole-baby-${version}-${name}`;
  const guide = `# 下载与安装 · 拉姆 v${version}

**第一次安装？直接点击下表的「下载」即可，无需注册或登录 GitHub，也不用下载源码。**

| 你的电脑 | 推荐下载（点击这里） | 下载后的操作 |
| --- | --- | --- |
| **Windows 10 / 11 · 64 位** | **[⬇ 下载 Windows 安装版 .exe](${download('Setup.exe')})** | 现代版，双击安装 |
| **Windows 7 SP1 / 8 / 8.1 · 64 位** | **[⬇ 下载老系统 64 位兼容版 .exe](${download('legacy-x64-Setup.exe')})** | 兼容版，双击安装 |
| **Windows 7 SP1 / 8 / 8.1 · 32 位**，或 32 位 Windows 10 | **[⬇ 下载老系统 32 位兼容版 .exe](${download('legacy-ia32-Setup.exe')})** | 兼容版，双击安装 |
| **Mac · Apple 芯片**（M1、M2、M3、M4、M5 及后续 M 系列） | **[⬇ 下载 Apple 芯片 Mac 版 .dmg](${download('mac-arm64.dmg')})** | 打开 → 拖入「应用程序」 |
| **Mac · Intel 芯片** | **[⬇ 下载 Intel Mac 版 .dmg](${download('mac-x64.dmg')})** | 打开 → 拖入「应用程序」 |

**不知道 Mac 选哪个？** 点击屏幕左上角苹果菜单 →「关于本机」：显示「芯片 Apple M…」选 Apple 芯片版，显示「处理器 Intel…」选 Intel 版。Mac 需要 **macOS 12 或更高版本**。

## Windows 安装（推荐）

1. 先按 **Win + R**，输入 **winver** 查看系统版本；再到「计算机／此电脑 → 属性」查看 **32 位／64 位操作系统**。选择上表对应的安装包。
2. Windows 10／11 的64位现代版文件是 **mole-baby-${version}-Setup.exe**；老系统64位文件是 **mole-baby-${version}-legacy-x64-Setup.exe**；32位文件是 **mole-baby-${version}-legacy-ia32-Setup.exe**。
3. 双击安装包，按提示选择安装位置并安装；完成后勾选运行。第一次使用会进入领养，同一版本渠道的更新保留已有拉姆。

如果提示「此应用无法在你的电脑上运行」，请先检查是否把64位程序放到了32位系统，或在Windows7／8上选择了现代版；下载不完整也可能造成此提示。重新下载对应安装包，可用 PowerShell 的 **Get-FileHash -Algorithm SHA256 文件名** 与附件 **SHA256SUMS.txt** 核对。安装器会在不支持的系统上给出明确提示。Windows XP、Vista及未安装SP1的Windows7不在兼容范围内。

**兼容版说明：** 老系统版固定使用仍支持Windows7／8的Electron22，现代版继续使用较新运行时。Electron22及老系统已停止安全维护，兼容版只加载本地应用界面；两种版本更新渠道隔离，兼容版不会因检查更新而下载现代版。新旧系统包都需用户分别确认下载和安装。

**两个版本的数据目录独立。** 在现代版和兼容版之间切换时，先从小屋设置导出宠物存档，再到另一版本导入。不会直接用旧Chromium打开新版浏览器数据目录；请保留导出的JSON备份，不要手工覆盖或删除原目录。
启动后拉姆会出现在桌面，图标在**右下角托盘**（可能藏在「∧」里）。关闭小屋会收起窗口，从托盘菜单选择「退出拉姆」才会完全退出。

## Mac 安装与首次打开

1. 按芯片下载上表的 **mac-arm64.dmg** 或 **mac-x64.dmg**，双击打开。
2. 把「拉姆.app」拖到 **Applications（应用程序）** 文件夹，复制完成后推出安装盘。
3. 从「应用程序」打开「拉姆」。启动后图标在**屏幕右上角菜单栏**，点击可重新显示，菜单中选择「退出拉姆」才会结束程序。

${trust}

${verified ? '此版本已完成 Apple 公证。若提示安装包损坏，请重新下载与芯片对应的文件，并核对 SHA256SUMS.txt。' : '如果出现「Apple 无法验证拉姆」：先尝试打开一次，再进入 **系统设置 → 隐私与安全性 →「仍要打开」**，按系统提示确认。较旧系统的入口是「系统偏好设置 → 安全性与隐私 → 通用」。只允许打开从本仓库下载的这个应用，无需关闭系统安全保护。'}

打不开应用时，也能查看安装盘内的 **「Mac 打开说明.html」**，其中提供打开系统设置的按钮；也可下载[独立 Mac 打开说明](https://github.com/Vinci-217/mole-baby/releases/download/v${version}/mole-baby-mac-help.html)。完整指引：[Mac 使用说明](https://github.com/Vinci-217/mole-baby/blob/main/docs/MACOS.md)。

## 已经安装过？

**v0.28.0 及更早版本需要先手动安装这次的新版本一次，才能获得自动更新功能。** 以后启动会自动检查，发现新版先询问是否下载，安装前再次确认；${verified ? '此版 Mac 已通过 Apple 签名公证，确认后使用标准更新机制安装。' : 'Mac 当前本地签名版自动检查，经确认下载安装包后手动替换应用。'}

**从 v0.31.4 起支持增量下载：** 旧版首次升级到这版仍可能下载完整包；安装新版后，后续更新优先复用本地旧安装包，只下载变化部分。缺少缓存、新增大量素材或增量不可用时，会完整下载，仍需你确认。首次安装不会因为增量而变成小安装包。

Windows 安装版确认安装后保存存档并更新重启；${verified ? 'Mac 使用对应签名版本的标准更新流程。' : 'Mac 的增量负责减少下载量，下载完成后仍需打开 DMG、拖入「应用程序」并替换，退出旧版后重新打开。'} 设置中的「软件更新」会显示增量/完整下载和传输量。[查看更新与缓存说明](https://github.com/Vinci-217/mole-baby/blob/v${version}/docs/UPDATES.md)。

同一渠道手动更新时，先从托盘／菜单栏退出旧版，再运行对应安装包或替换「应用程序」里的拉姆，**无需卸载，也不要删除存档**。小屋设置可导出存档，正常升级保留本机数据。首次切换到Windows兼容版则按上方说明导出、导入宠物。

<details>
<summary>其他附件怎么选？（便携版、备用包与源码）</summary>

- **Windows 现代便携版**：[下载 x64.zip](${download('x64.zip')})。
- **Windows 老系统便携版**：[下载64位兼容版ZIP](${download('legacy-x64.zip')}) / [下载32位兼容版ZIP](${download('legacy-ia32.zip')})。
- 所有Windows ZIP都先右键「全部解压」，在完整解压后的文件夹里打开「拉姆.exe」或「拉姆兼容版.exe」；不要直接在压缩包中运行，也不要只复制exe。便携版更新会提供对应渠道的安装包入口，想要确认后直接更新并重启请选择上面的安装版。
- **Mac ZIP 备用包**：[Apple 芯片 ZIP](${download('mac-arm64.zip')}) / [Intel ZIP](${download('mac-x64.zip')})。解压后把应用移入「应用程序」再打开；普通用户优先下载上面的 DMG。
- **Source code (zip / tar.gz)** 是开发者用的源码，不能直接运行；普通用户不用下载。
- **latest.yml、legacy-x64.yml、legacy-ia32.yml、latest-mac.yml、*.blockmap、SHA256SUMS.txt、macos-trust-*.json** 供更新程序或校验使用，不是安装包。
- 下载没有开始时，请检查网络或稍后重试，直接点击上表链接即可。

</details>`;
  return `${guide}\n\n---\n\n## 本次更新\n\n${notes}`;
}
function writeReleaseFiles(root,sourceSha){
  const notes=prepareReleaseNotes(path.join(root,'release'),sourceSha,fs.readFileSync(path.join(root,'RELEASE_NOTES.md'),'utf8'));
  const guide=fs.readFileSync(path.join(root,'electron/Mac 打开说明.html'));
  fs.writeFileSync(path.join(root,'release/mole-baby-mac-help.html'),guide);
  const sums=path.join(root,'release/SHA256SUMS.txt');
  const hash=require('node:crypto').createHash('sha256').update(guide).digest('hex');
  if(fs.existsSync(sums)){const content=fs.readFileSync(sums,'utf8').split('\n').filter(line=>line&&!line.endsWith('mole-baby-mac-help.html')).join('\n');fs.writeFileSync(sums,content+'\n'+hash+'  mole-baby-mac-help.html\n');}
  fs.writeFileSync(path.join(root,'release/RELEASE_NOTES.md'),notes);
}
if(require.main===module)writeReleaseFiles(path.resolve(__dirname,'..'),process.env.GITHUB_SHA);
module.exports = { prepareReleaseNotes,writeReleaseFiles };
