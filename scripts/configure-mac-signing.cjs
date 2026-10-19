const fs = require('node:fs');
const { signingMode } = require('./mac-signing-policy.cjs');
try {
  const mode = signingMode();
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `mode=${mode}\n`);
  if (process.env.GITHUB_ENV) fs.appendFileSync(process.env.GITHUB_ENV, `MOLE_MAC_DISTRIBUTION=${mode}\nCSC_IDENTITY_AUTO_DISCOVERY=${mode === 'notarized'}\n`);
  console.log(`Mac distribution mode: ${mode}`);
  if (mode === 'local') console.log('::warning::No Apple signing credentials configured. This is a local-signature build; Gatekeeper may require Open Anyway. It is NOT Apple notarized.');
} catch (error) { console.error(error.message); process.exitCode = 1; }
