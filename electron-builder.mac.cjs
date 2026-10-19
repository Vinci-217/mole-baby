const { build } = require('./package.json');
const { macBuildConfig, removeEmptySigningCredentials } = require('./scripts/mac-signing-policy.cjs');
removeEmptySigningCredentials(process.env);
module.exports = macBuildConfig(build);
