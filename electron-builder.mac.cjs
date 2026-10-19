const { build } = require('./package.json');
const { macBuildConfig } = require('./scripts/mac-signing-policy.cjs');
module.exports = macBuildConfig(build);
