const path=require('node:path');
const{windowsRuntime}=require('../electron/windows-runtime.cjs');

/** NSIS adds/signs resources/elevate.exe. Finish that mutation before archiving
 * the same unpacked directory; parallel targets can produce different payloads. */
async function packageWindows({legacy=false,arch='x64',config:injectedConfig,outputDirectory,prepackaged,portable=true,build:injectedBuild}={}){
 windowsRuntime(legacy?{windowsEdition:'legacy'}:{},arch);
 const{build,Platform,Arch}=require('electron-builder'),run=injectedBuild??build;
 const previous=process.env.MOLE_LEGACY_ARCH;
 if(legacy)process.env.MOLE_LEGACY_ARCH=arch;
 try{
  const config=injectedConfig??(legacy?path.resolve(__dirname,'../electron-builder.legacy.cjs'):undefined);
  const common={publish:'never',...(config?{config}:{})};
  await run({...common,...(prepackaged?{prepackaged}:{}),targets:Platform.WINDOWS.createTarget('nsis',Arch[arch])});
  if(!portable)return;
  const directory=outputDirectory??(typeof config==='object'&&config.directories?.output?config.directories.output:legacy?`release/legacy-${arch}`:'release');
  const completedApplication=path.resolve(__dirname,'..',directory,arch==='ia32'?'win-ia32-unpacked':'win-unpacked');
  await run({...common,targets:Platform.WINDOWS.createTarget('zip',Arch[arch]),prepackaged:completedApplication});
 }finally{if(previous===undefined)delete process.env.MOLE_LEGACY_ARCH;else process.env.MOLE_LEGACY_ARCH=previous}
}
if(require.main===module){const args=process.argv.slice(2),index=args.indexOf('--arch');packageWindows({legacy:args.includes('--legacy'),arch:index<0?'x64':args[index+1]}).catch(error=>{console.error(error);process.exitCode=1})}
module.exports={packageWindows};
