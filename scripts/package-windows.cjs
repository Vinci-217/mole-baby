const path=require('node:path');
const{windowsRuntime}=require('../electron/windows-runtime.cjs');

/** NSIS adds/signs resources/elevate.exe. Finish that mutation before archiving
 * the same unpacked directory; parallel targets can produce different payloads. */
async function packageWindows({legacy=false,arch='x64',build:injectedBuild}={}){
 windowsRuntime(legacy?{windowsEdition:'legacy'}:{},arch);
 const{build,Platform,Arch}=require('electron-builder'),run=injectedBuild??build;
 const previous=process.env.MOLE_LEGACY_ARCH;
 if(legacy)process.env.MOLE_LEGACY_ARCH=arch;
 try{
  const common={publish:'never',...(legacy?{config:path.resolve(__dirname,'../electron-builder.legacy.cjs')}:{})};
  await run({...common,targets:Platform.WINDOWS.createTarget('nsis',Arch[arch])});
  const directory=legacy?`release/legacy-${arch}`:'release';
  const prepackaged=path.resolve(__dirname,'..',directory,arch==='ia32'?'win-ia32-unpacked':'win-unpacked');
  await run({...common,targets:Platform.WINDOWS.createTarget('zip',Arch[arch]),prepackaged});
 }finally{if(previous===undefined)delete process.env.MOLE_LEGACY_ARCH;else process.env.MOLE_LEGACY_ARCH=previous}
}
if(require.main===module){const args=process.argv.slice(2),index=args.indexOf('--arch');packageWindows({legacy:args.includes('--legacy'),arch:index<0?'x64':args[index+1]}).catch(error=>{console.error(error);process.exitCode=1})}
module.exports={packageWindows};
