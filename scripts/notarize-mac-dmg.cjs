const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { signingMode } = require('./mac-signing-policy.cjs');

async function notarizeDmg({ env = process.env, platform = process.platform, arch = process.arch,
  directory = path.resolve(__dirname, '../release'), log = console.log, notarize = require('@electron/notarize').notarize } = {}) {
  const mode = signingMode(env);
  if (mode === 'local') { log('Mac DMG is locally signed; Apple notarization was not performed.'); return; }
  assert.equal(platform, 'darwin', 'Apple notarization must run on macOS');
  assert.ok(['arm64', 'x64'].includes(arch), 'Invalid Mac architecture');
  const { version } = require('../package.json');
  const filename = path.join(directory, `mole-baby-${version}-mac-${arch}.dmg`);
  assert.ok(fs.statSync(filename).size > 0, 'Missing DMG for notarization');
  // This library submits the DMG to notarytool, requires Accepted, then staples
  // the Apple ticket. Do this before hashing or publishing the final disk image.
  await notarize({ tool: 'notarytool', appPath: filename, appleId: env.APPLE_ID,
    appleIdPassword: env.APPLE_APP_SPECIFIC_PASSWORD, teamId: env.APPLE_TEAM_ID });
  log(`PASS: Apple accepted and stapled macOS ${arch} DMG`);
}
if (require.main === module) notarizeDmg({ arch: process.argv[2] || process.arch }).catch(() => {
  console.error('Apple DMG notarization/stapling failed; no notarized download may be published. Check the Apple account and the build diagnostics.');
  process.exitCode = 1;
});
module.exports = { notarizeDmg };
