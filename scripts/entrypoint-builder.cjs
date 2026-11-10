const { build } = require('../package.json');
module.exports = {
  ...build,
  extends: null,
  appId: 'com.molebaby.entrypointfixture',
  productName: '拉姆入口测试',
  directories: { output: 'artifacts/entrypoint-package' },
  files: ['scripts/windows-entrypoint-fixture.cjs'],
  extraMetadata: { name: 'mole-entrypoint-fixture', main: 'scripts/windows-entrypoint-fixture.cjs' },
  win: { ...build.win, extraFiles: [] },
  nsis: { ...build.nsis, artifactName: 'entrypoint-Setup.exe' },
};
