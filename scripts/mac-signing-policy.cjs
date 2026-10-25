const REQUIRED = ['CSC_LINK', 'CSC_KEY_PASSWORD', 'APPLE_ID', 'APPLE_APP_SPECIFIC_PASSWORD', 'APPLE_TEAM_ID'];

function removeEmptySigningCredentials(env) {
  // GitHub resolves absent Secrets to empty strings. electron-builder treats
  // an empty CSC_LINK as a supplied certificate, rather than no certificate.
  for (const name of REQUIRED) if (typeof env[name] === 'string' && !env[name].trim()) delete env[name];
  return env;
}

function signingMode(env = process.env) {
  const requested = env.MOLE_MAC_DISTRIBUTION || 'auto';
  if (!['auto', 'local', 'notarized'].includes(requested)) throw new Error('Invalid MOLE_MAC_DISTRIBUTION; use auto, local or notarized.');
  const present = REQUIRED.filter(name => typeof env[name] === 'string' && env[name].trim());
  if (requested === 'local') {
    if (present.length) throw new Error('Local signing cannot ignore configured Apple credentials. Remove the local override or the credentials.');
    return 'local';
  }
  if (!present.length && requested === 'auto') return 'local';
  const missing = REQUIRED.filter(name => !present.includes(name));
  if (missing.length) throw new Error(`Mac signing credentials incomplete. Missing: ${missing.join(', ')}. Configure GitHub Secrets; do not put values in source or chat.`);
  return 'notarized';
}

function macBuildConfig(base, env = process.env) {
  const mode = signingMode(env);
  const config = { ...base,extraMetadata:{...base.extraMetadata,macUpdateSigned:mode==='notarized'}, mac: { ...base.mac }, dmg: { ...base.dmg } };
  if(Array.isArray(base.dmg?.contents))config.dmg.contents=[...base.dmg.contents,{x:290,y:325,type:'file',path:require('node:path').join(__dirname,'../electron/Mac 打开说明.html')}];
  if (mode === 'notarized') {
    // Let electron-builder select the imported Developer ID Application identity.
    delete config.mac.identity;
    config.mac.type = 'distribution';
    config.mac.notarize = true;
    config.mac.hardenedRuntime = true;
    config.forceCodeSigning = true;
    config.dmg.sign = true;
  } else {
    config.mac.identity = '-';
    config.mac.notarize = false;
  }
  return config;
}
module.exports = { REQUIRED, signingMode, macBuildConfig, removeEmptySigningCredentials };
