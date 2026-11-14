#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const crypto = require('node:crypto');
const asar = require('@electron/asar');
const { packageWindows } = require('./package-windows.cjs');
const { verifyOfflineAssets } = require('./verify-offline-assets.cjs');
const { inspectPe, verifyPortableZip, verifyNsisInstaller } = require('./windows-artifacts.cjs');
const { writeChecksums } = require('./package-checksums.cjs');
const { withLocalNsisReader } = require('./nsis-local-uninstaller.cjs');
const { verifyRendererPackage } = require('./windows-preview-after-pack.cjs');
const metadata = require('../package.json');
const config = require('../electron-builder.windows-preview.cjs');
const root = path.resolve(__dirname, '..');
const output = path.resolve(root, config.directories.output);
const renderer = path.join(output, 'renderer');
const prefix = `mole-baby-${metadata.version}-windows-test`;
const application = path.join(output, 'win-unpacked');

function hash(bytes) { return crypto.createHash('sha256').update(bytes).digest('hex'); }

async function main() {
  assert.equal(config.appId, metadata.build.appId);
  assert.equal(config.productName, metadata.build.productName);
  const webIndex = path.join(root, 'dist/index.html');
  const previousWebHash = fs.existsSync(webIndex) ? hash(fs.readFileSync(webIndex)) : null;
  const resume = process.argv.includes('--resume-package');
  const portableRequested = !process.argv.includes('--installer-only');
  if (!resume && !process.argv.includes('--package-only')) {
    const result = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm',
      ['run', 'build', '--', '--outDir', renderer], {
        cwd: root, stdio: 'inherit', shell: process.platform === 'win32',
        env: { ...process.env, VITE_WEB_APP: '0', VITE_LOCAL_DEBUG: '0' },
      });
    if (result.error) throw result.error;
    if (result.status !== 0) throw Error('Desktop renderer build failed');
  }
  const resources = resume ? JSON.parse(fs.readFileSync(path.join(output, 'packed-assets.json'))).resources : verifyOfflineAssets(renderer);
  if (resume) verifyRendererPackage(path.join(application, 'resources/app.asar'), resources);
  else fs.rmSync(path.join(output, 'packed-assets.json'), { force: true });
  await withLocalNsisReader({
    installer: path.join(output, prefix + '-Setup.exe'),
    // Load one complete config file: merging its FileSets into package.json
    // would also retain the web dist/ pattern from the default configuration.
    run: () => packageWindows({ config: path.join(root, 'electron-builder.windows-preview.cjs'), outputDirectory: output, portable: portableRequested, ...(resume ? { prepackaged: application } : {}), arch: 'x64' }),
  });
  const receipt = JSON.parse(fs.readFileSync(path.join(output, 'packed-assets.json')));
  assert.equal(receipt.resources.revision, resources.revision);
  const textures = receipt.textures;

  const archive = path.join(application, 'resources/app.asar');
  const packedMetadata = JSON.parse(asar.extractFile(archive, 'package.json'));
  assert.equal(packedMetadata.name, metadata.name);
  assert.equal(packedMetadata.animationPreview, true);
  assert.equal(packedMetadata.version, metadata.version);
  assert(textures, 'Installed animation resources were not verified');
  const executable = config.productName + '.exe';
  const pe = inspectPe(fs.readFileSync(path.join(application, executable)), { architectures: ['x64'] });
  const installer = prefix + '-Setup.exe', portable = prefix + '-x64.zip';
  inspectPe(fs.readFileSync(path.join(output, installer)), { architectures: ['x86', 'x64'] });
  const nsis = await verifyNsisInstaller(path.join(output, installer));
  const container = spawnSync(await require('app-builder-lib/out/toolsets/7zip').getPath7za(),
    ['t', path.join(output, installer)], { encoding: 'utf8', timeout: 120000 });
  const evidence = path.join(root, 'artifacts/windows-build');
  fs.mkdirSync(evidence, { recursive: true });
  fs.writeFileSync(path.join(evidence, 'installer-integrity.log'), (container.stdout ?? '') + (container.stderr ?? ''));
  if (container.error) throw container.error;
  assert.equal(container.status, 0, 'Installer container integrity failed');
  for (const file of ['启动拉姆.cmd', '先看这里-启动说明.txt']) assert(fs.existsSync(path.join(application, file)), file);
  const zip = portableRequested ? await verifyPortableZip(path.join(output, portable), application, executable) : null;
  const deliverables = [installer, ...(portableRequested ? [portable] : [])];
  await writeChecksums(output, deliverables, 'SHA256SUMS-windows-test.txt');
  if (previousWebHash) assert.equal(hash(fs.readFileSync(webIndex)), previousWebHash, 'Existing web preview changed');

  const report = {
    checkedAt: new Date().toISOString(), version: metadata.version, target: 'windows-x64-local-preview',
    applicationIdentity: { appId: config.appId, productName: config.productName, packageName: packedMetadata.name },
    automaticUpdatesDisabled: packedMetadata.animationPreview === true,
    resources, textures, executable: pe, portable: zip, nsis,
    files: deliverables.map(name => ({ name, bytes: fs.statSync(path.join(output, name)).size })),
    validation: { installerStartupCRC: 'passed', installerContainerCRC: 'passed', allPackagedResourceHashes: 'passed', portableCRCAndFileHashes: portableRequested ? 'passed' : 'not requested', nativeWindowsInstall: 'requires Windows user test' },
  };
  fs.writeFileSync(path.join(output, 'windows-test-report.json'), JSON.stringify(report, null, 2) + '\n');
  fs.writeFileSync(path.join(output, 'Windows测试说明.txt'),
    '拉姆 Windows x64 本地测试版\r\n\r\n' +
    '安装：运行 ' + installer + '。\r\n' +
    (portableRequested ? '便携版：完整解压 ' + portable + '，在解压目录中运行 拉姆.exe 或 启动拉姆.cmd；不要只拖出单个 exe。\r\n' : '本次按需只构建安装版，全部运行素材已包含在安装包内。\r\n') +
    '沿用原应用标识和存档位置。本测试版关闭自动更新，可在设置里检查、导出和导入已有存档。\r\n' +
    '本包在 Linux 云电脑交叉构建，已核验 Windows EXE、便携包完整性和全部素材；Windows 原生安装与快捷方式实际体验请在电脑上检查。\r\n');
  for (const file of ['latest.yml', installer + '.blockmap']) fs.rmSync(path.join(output, file), { force: true });
  const debug = path.join(output, 'builder-debug.yml');
  if (fs.existsSync(debug)) { fs.copyFileSync(debug, path.join(evidence, 'builder-debug.yml')); fs.unlinkSync(debug); }
  if (!process.argv.includes('--keep-unpacked')) {
    fs.rmSync(application, { recursive: true, maxRetries: 5, retryDelay: 100 });
    fs.rmSync(path.join(output, 'packed-assets.json'), { force: true });
    console.log('PASS: validated unpacked build removed; requested complete packages retained');
  }
  console.log(JSON.stringify(report, null, 2));
}

async function run() {
  let scratch;
  if (process.platform === 'linux' && fs.existsSync('/dev/shm')) {
    const space = fs.statfsSync('/dev/shm');
    if (space.bavail * space.bsize >= 1536 * 1024 * 1024) {
      scratch = fs.mkdtempSync('/dev/shm/mole-nsis-');
      process.env.TMPDIR = scratch;
    }
  }
  try { await main(); }
  finally { if (scratch) fs.rmSync(scratch, { recursive: true, force: true }); }
}

if (require.main === module) run().catch(error => { console.error(error); process.exit(1); });
