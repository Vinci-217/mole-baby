/** Same application identity and saves; separate, local-only review artifacts. */
const path = require('node:path');
const fs = require('node:fs');
const { build } = require('./package.json');
const output = 'release/windows-preview';
const mirrorFile = process.env.MOLE_PREVIEW_BOOK_MIRRORS;

module.exports = {
  ...build,
  directories: { ...build.directories, output },
  extraMetadata: { ...build.extraMetadata, animationPreview: true,
    ...(mirrorFile ? { bookResourceMirrors: JSON.parse(fs.readFileSync(mirrorFile, 'utf8')) } : {}) },
  // Unpack matching uses source paths, before renderer/ is mapped to dist/.
  asarUnpack: build.asarUnpack.map(pattern => pattern.replace(/^dist\//, '**/')),
  files: build.files.map(pattern => pattern === 'dist/**/*'
    ? { from: path.resolve(output, 'renderer'), to: 'dist', filter: ['**/*'] }
    : pattern).concat('!dist/**/*'),
  win: { ...build.win, artifactName: 'mole-baby-${version}-windows-test-${arch}.${ext}' },
  nsis: { ...build.nsis, artifactName: 'mole-baby-${version}-windows-test-Setup.${ext}' },
  afterPack: require('./scripts/windows-preview-after-pack.cjs'),
};
