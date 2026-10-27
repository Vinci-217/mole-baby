/** Packaging and runtime must agree about the Windows edition. Compatibility
 * builds never read the modern update channel, even when run on Windows 10+. */
const LEGACY_ELECTRON_VERSION='22.3.27';
const PRODUCT_NAMES={modern:'拉姆',legacy:'拉姆兼容版'};
function windowsRuntime(metadata={},arch=process.arch){
 if(metadata.windowsEdition!==undefined&&!['modern','legacy'].includes(metadata.windowsEdition))throw new Error('Unknown Windows edition');
 const edition=metadata.windowsEdition==='legacy'?'legacy':'modern';
 const supportedArch=edition==='legacy'?['ia32','x64']:['x64'];
 if(!supportedArch.includes(arch))throw new Error(`Unsupported ${edition} Windows architecture: ${arch}`);
 return{
  edition,arch,productName:PRODUCT_NAMES[edition],
  appId:edition==='legacy'?'com.molebaby.ramuhouse.legacy':'com.molebaby.ramuhouse',
  userDataName:edition==='legacy'?'mole-baby-legacy':'mole-baby',
  uninstallerName:`Uninstall ${PRODUCT_NAMES[edition]}.exe`,
  channel:edition==='legacy'?`legacy-${arch}`:'latest',
  minimumRelease:edition==='legacy'?[6,1,7601]:[10,0,0],
  minimumSystem:edition==='legacy'?'Windows 7 SP1':'Windows 10',
 };
}
function supportsWindowsRelease(release,metadata={},arch=process.arch){
 if(typeof release!=='string')return false;
 const match=/^(\d+)\.(\d+)(?:\.(\d+))?(?:\.\d+)?$/.exec(release);
 if(!match)return false;
 const parts=[Number(match[1]),Number(match[2]),Number(match[3]??0)];
 if(parts.some(n=>!Number.isSafeInteger(n)))return false;
 const minimum=windowsRuntime(metadata,arch).minimumRelease;
 for(let i=0;i<minimum.length;i++){if(parts[i]>minimum[i])return true;if(parts[i]<minimum[i])return false}
 return true;
}
module.exports={LEGACY_ELECTRON_VERSION,windowsRuntime,supportsWindowsRelease};
