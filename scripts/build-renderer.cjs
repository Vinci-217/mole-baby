/** Let Vite release its heap before decoding the offline asset library. */
const {spawnSync}=require('node:child_process');
const {mkdtemp,readFile,rm}=require('node:fs/promises');
const {tmpdir}=require('node:os');
const path=require('node:path');

async function main(args){
 const temp=await mkdtemp(path.join(tmpdir(),'mole-asset-build-'));
 try{
  const plan=path.join(temp,'output.json');
  const vite=path.join(path.dirname(require.resolve('vite/package.json')),'bin','vite.js');
  const renderer=spawnSync(process.execPath,[vite,'build',...args],{
   stdio:'inherit',env:{...process.env,MOLE_ASSET_BUILD_PLAN:plan},
  });
  if(renderer.error)throw renderer.error;
  if(renderer.signal)throw Error(`Renderer build stopped by ${renderer.signal}`);
  if(renderer.status!==0){process.exitCode=renderer.status;return;}

  const {output,sharedFrameAtlases,webPanelFiles}=JSON.parse(await readFile(plan,'utf8'));
  const {loadConfigFromFile}=await import('vite');
  const {config}=await loadConfigFromFile({command:'build',mode:'production'});
  const assets=config.plugins.find(plugin=>plugin.name==='compact-original-assets');
  await assets.api.finishAssets(output,sharedFrameAtlases,webPanelFiles);
 }finally{await rm(temp,{recursive:true,force:true});}
}
main(process.argv.slice(2)).catch(error=>{console.error(error);process.exitCode=1});
