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
  return `${header}\n\n${notes}`;
}
if (require.main === module) {
  const root = path.resolve(__dirname, '..');
  fs.writeFileSync(path.join(root, 'release/RELEASE_NOTES.md'), prepareReleaseNotes(path.join(root, 'release'), process.env.GITHUB_SHA, fs.readFileSync(path.join(root, 'RELEASE_NOTES.md'), 'utf8')));
}
module.exports = { prepareReleaseNotes };
