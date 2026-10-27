/** Build each legacy architecture independently so updater manifests cannot
 * overwrite each other. CI sets MOLE_LEGACY_ARCH and passes the matching flag. */
const{build}=require('./package.json');
const{LEGACY_ELECTRON_VERSION,windowsRuntime}=require('./electron/windows-runtime.cjs');
const arch=process.env.MOLE_LEGACY_ARCH||'x64';
const runtime=windowsRuntime({windowsEdition:'legacy'},arch);
module.exports={
 ...build,
 appId:'com.molebaby.ramuhouse.legacy',
 productName:runtime.productName,
 electronVersion:LEGACY_ELECTRON_VERSION,
 directories:{...build.directories,output:`release/legacy-${arch}`},
 extraMetadata:{name:'mole-baby-legacy',windowsEdition:'legacy',productName:runtime.productName},
 win:{...build.win,target:['nsis','zip'],artifactName:'mole-baby-${version}-legacy-${arch}.${ext}'},
 nsis:{...build.nsis,include:'electron/installer-legacy.nsh',artifactName:'mole-baby-${version}-legacy-${arch}-Setup.${ext}'},
 publish:[{provider:'generic',url:'https://github.com/Vinci-217/mole-baby/releases/latest/download/',channel:runtime.channel}],
};
