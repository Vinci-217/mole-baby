/** Same application identity and saves; separate, local-only review artifacts. */
const path = require('node:path');
const { build } = require('./package.json');
const output = 'release/windows-preview';

module.exports = {
  ...build,
  directories: { ...build.directories, output },
  extraMetadata: { ...build.extraMetadata, animationPreview: true },
  // Unpack matching uses source paths, before renderer/ is mapped to dist/.
  asarUnpack: ['**/assets/original/uploaded-actions/**/*', '**/assets/original/daily-frames/**/*'],
  files: build.files.map(pattern => pattern === 'dist/**/*'
    ? { from: path.resolve(output, 'renderer'), to: 'dist', filter: ['**/*'] }
    : pattern).concat('!dist/**/*'),
  win: { ...build.win, artifactName: 'mole-baby-${version}-windows-test-${arch}.${ext}' },
  nsis: { ...build.nsis, artifactName: 'mole-baby-${version}-windows-test-Setup.${ext}' },
  afterPack: require('./scripts/windows-preview-after-pack.cjs'),
};
