const fs = require('node:fs');
const path = require('node:path');
function prepareReleaseNotes(directory, sourceSha, notes) {
  const receipts = ['arm64', 'x64'].map(arch => {
    const receipt = JSON.parse(fs.readFileSync(path.join(directory, `macos-trust-${arch}.json`), 'utf8'));
    if (receipt.architecture !== arch || receipt.sourceSha !== sourceSha) throw new Error('Mac trust receipt does not match the release source/architecture');
    if (!['local', 'notarized'].includes(receipt.mode)) throw new Error('Unknown Mac distribution mode');
    if (receipt.mode === 'notarized' && (!receipt.developerIdSigned || !receipt.stapled || !receipt.gatekeeperAccepted)) throw new Error('Apple trust verification incomplete');
    return receipt;
  });
  if (receipts[0].mode !== receipts[1].mode) throw new Error('Both Mac architectures must use the same trust level');
  const verified = receipts.every(r => r.mode === 'notarized');
  const header = verified
    ? '**Mac 信任状态：已通过 Developer ID 签名、Apple 公证、票据装订和 Gatekeeper 验证。**'
    : '**Mac 信任状态：本地签名，尚未经过 Apple 公证；首次打开需要在“隐私与安全”选择“仍要打开”。**';
  const macGuide = `### Mac 安装与首次打开

- 支持 macOS 12 及以上。M1 / M2 / M3 / M4 等 Apple 芯片请选择 **mac-arm64.dmg**；Intel 芯片请选择 **mac-x64.dmg**。可在苹果菜单 →「关于本机」查看芯片。
- 打开 DMG，把「拉姆.app」拖入 Applications（应用程序），推出 DMG 后从应用程序启动。ZIP 是备用包，解压后也请先移入应用程序。
${verified ? '- 此版本已完成 Apple 公证。若提示安装包损坏，请重新下载与芯片对应的文件，并核对 SHA256SUMS.txt。' : '- 当前版本尚未经过 Apple 公证，因此可能出现“Apple 无法验证拉姆”的提示。请先尝试打开一次，再进入「系统设置 → 隐私与安全性」，找到「拉姆」并点击「仍要打开」，按系统提示确认。较旧系统的对应入口在「系统偏好设置 → 安全性与隐私 → 通用」。这只是允许打开本应用，请自行确认下载来自本仓库。'}
- 安装盘内附有「Mac 打开说明.html」，应用被拦截、还没有运行时也可双击查看，并点击说明里的按钮打开系统设置。发布附件也提供 [独立 Mac 打开说明](https://github.com/Vinci-217/mole-baby/releases/download/v${require('../package.json').version}/mole-baby-mac-help.html)。
- 启动后常驻屏幕右上角菜单栏。关闭小屋会收起窗口；点菜单栏拉姆图标可重新显示，菜单中选择「退出拉姆」才会结束程序。
- 更新前可在小屋设置中导出存档，再退出旧版、替换应用；正常更新保留本机存档。

完整指引：[Mac 使用说明](https://github.com/Vinci-217/mole-baby/blob/main/docs/MACOS.md)。`;
  return `${header}\n\n${macGuide}\n\n${notes}`;
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
