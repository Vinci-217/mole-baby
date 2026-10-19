const assert = require('node:assert/strict');
const { execFileSync, spawnSync } = require('node:child_process');
function verifyMacTrust({ app, dmg, mode = 'local', run = execFileSync, describe = filename => {
  const result = spawnSync('/usr/bin/codesign', ['--display', '--verbose=4', filename], { encoding: 'utf8' });
  assert.equal(result.status, 0, 'Cannot read the Mac signing identity');
  return result.stderr;
} }) {
  assert.ok(['local', 'notarized'].includes(mode), 'Unknown Mac distribution mode');
  if (mode === 'local') return { mode, developerIdSigned: false, stapled: false, gatekeeperAccepted: false };
  assert.match(describe(app), /^Authority=Developer ID Application:/m, 'A real Developer ID Application signature is required');
  run('/usr/bin/codesign', ['--verify', '--strict', dmg], { stdio: 'pipe' });
  for (const filename of [app, dmg]) run('/usr/bin/xcrun', ['stapler', 'validate', filename], { stdio: 'pipe' });
  run('/usr/sbin/spctl', ['--assess', '--type', 'execute', '--verbose=2', app], { stdio: 'pipe' });
  run('/usr/sbin/spctl', ['--assess', '--type', 'open', '--context', 'context:primary-signature', '--verbose=2', dmg], { stdio: 'pipe' });
  return { mode, developerIdSigned: true, stapled: true, gatekeeperAccepted: true };
}
module.exports = { verifyMacTrust };
