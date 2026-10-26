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
| **Windows 10 / 11 · 64 位** | **[⬇ 下载 Windows 安装版 .exe](${download('Setup.exe')})** | 双击 → 安装 → 完成 |
| **Mac · Apple 芯片**（M1、M2、M3、M4、M5 及后续 M 系列） | **[⬇ 下载 Apple 芯片 Mac 版 .dmg](${download('mac-arm64.dmg')})** | 打开 → 拖入「应用程序」 |
| **Mac · Intel 芯片** | **[⬇ 下载 Intel Mac 版 .dmg](${download('mac-x64.dmg')})** | 打开 → 拖入「应用程序」 |

**不知道 Mac 选哪个？** 点击屏幕左上角苹果菜单 →「关于本机」：显示「芯片 Apple M…」选 Apple 芯片版，显示「处理器 Intel…」选 Intel 版。Mac 需要 **macOS 12 或更高版本**。

## Windows 安装（推荐）

1. 点击上表「下载 Windows 安装版」，下载文件为 **mole-baby-${version}-Setup.exe**。
2. 双击安装包，按提示选择安装位置，点击「安装」。
3. 安装完成后勾选「运行拉姆」，点击「完成」。第一次使用会进入领养；更新安装会保留已有拉姆。

启动后拉姆会出现在桌面，图标在**右下角托盘**（可能藏在「∧」里）。关闭小屋会收起窗口，从托盘菜单选择「退出拉姆」才会完全退出。

## Mac 安装与首次打开

1. 按芯片下载上表的 **mac-arm64.dmg** 或 **mac-x64.dmg**，双击打开。
2. 把「拉姆.app」拖到 **Applications（应用程序）** 文件夹，复制完成后推出安装盘。
3. 从「应用程序」打开「拉姆」。启动后图标在**屏幕右上角菜单栏**，点击可重新显示，菜单中选择「退出拉姆」才会结束程序。

${trust}

${verified ? '此版本已完成 Apple 公证。若提示安装包损坏，请重新下载与芯片对应的文件，并核对 SHA256SUMS.txt。' : '如果出现「Apple 无法验证拉姆」：先尝试打开一次，再进入 **系统设置 → 隐私与安全性 →「仍要打开」**，按系统提示确认。较旧系统的入口是「系统偏好设置 → 安全性与隐私 → 通用」。只允许打开从本仓库下载的这个应用，无需关闭系统安全保护。'}

打不开应用时，也能查看安装盘内的 **「Mac 打开说明.html」**，其中提供打开系统设置的按钮；也可下载[独立 Mac 打开说明](https://github.com/Vinci-217/mole-baby/releases/download/v${version}/mole-baby-mac-help.html)。完整指引：[Mac 使用说明](https://github.com/Vinci-217/mole-baby/blob/main/docs/MACOS.md)。

## 已经安装过？

**v0.28.0 及更早版本需要先手动安装这次的新版本一次，才能获得自动更新功能。** Windows 安装版以后启动会自动检查、下载，在空闲时保存并更新；${verified ? '此版 Mac 已通过 Apple 签名公证，支持标准自动更新。' : 'Mac 当前本地签名版自动检查和下载安装包，下载完成后仍需手动替换应用。'}

手动更新时，先从托盘／菜单栏退出旧版，再运行新安装包或替换「应用程序」里的拉姆，**无需卸载，也不要删除存档**。小屋设置可导出存档，正常升级保留本机数据。

<details>
<summary>其他附件怎么选？（便携版、备用包与源码）</summary>

- **Windows 便携版**：[下载 x64.zip](${download('x64.zip')})。右键「全部解压」，在解压后的文件夹里打开「拉姆.exe」；不要直接在压缩包里运行。便携版更新会提供安装包入口，想要后续全自动更新请选择上面的安装版。
- **Mac ZIP 备用包**：[Apple 芯片 ZIP](${download('mac-arm64.zip')}) / [Intel ZIP](${download('mac-x64.zip')})。解压后把应用移入「应用程序」再打开；普通用户优先下载上面的 DMG。
- **Source code (zip / tar.gz)** 是开发者用的源码，不能直接运行；普通用户不用下载。
- **latest.yml、latest-mac.yml、SHA256SUMS.txt、macos-trust-*.json** 供更新程序或校验使用，不是安装包。
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
