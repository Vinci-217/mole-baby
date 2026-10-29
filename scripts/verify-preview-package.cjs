const assert=require('node:assert/strict'),path=require('node:path');
const{verifyApplication}=require('./package-smoke.cjs');
async function main(){
 assert.ok(process.argv[2],'Pass the packaged preview executable');
 const executable=path.resolve(process.argv[2]);
 const archive=process.platform==='darwin'
  ?path.resolve(path.dirname(executable),'../Resources/app.asar')
  :path.resolve(path.dirname(executable),'resources/app.asar');
 await verifyApplication({executable,archive,screenshot:`preview-${process.platform==='darwin'?'mac':'windows'}-${process.arch}.png`});
}
main().catch(error=>{console.error(error);process.exitCode=1});
