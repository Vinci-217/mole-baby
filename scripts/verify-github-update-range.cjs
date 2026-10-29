// Run with Electron: verify real HTTPS redirects preserve a single Range.
const {app,net}=require('electron'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const scriptIndex=process.argv.findIndex(arg=>arg.endsWith('verify-github-update-range.cjs'));
const version=process.argv[scriptIndex+1]??'0.31.3';assert.match(version,/^\d+\.\d+\.\d+$/);
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'mole-range-probe-'));app.setPath('userData',profile);
app.whenReady().then(async()=>{
 try{
  const results=await Promise.all([`mole-baby-${version}-Setup.exe`,`mole-baby-${version}-mac-arm64.dmg`].map(async name=>{
   const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),45000);
   try{
    const url=`https://github.com/Vinci-217/mole-baby/releases/download/v${version}/${name}`;
    const response=await net.fetch(url,{headers:{Range:'bytes=0-1023'},cache:'no-store',signal:controller.signal});
    assert.equal(response.status,206);assert.match(response.headers.get('content-range'),/^bytes 0-1023\/\d+$/);
    const bytes=Buffer.from(await response.arrayBuffer());assert.equal(bytes.length,1024);
    return{name,url,status:response.status,contentRange:response.headers.get('content-range'),bodyBytes:bytes.length,responseUrlAvailable:Boolean(response.url),finalHost:response.url?new URL(response.url).hostname:null};
   }finally{clearTimeout(timer)}
  }));
  const report={runtime:process.versions.electron,platform:process.platform,results};
  fs.mkdirSync(path.join(__dirname,'../artifacts'),{recursive:true});fs.writeFileSync(path.join(__dirname,'../artifacts/github-update-range.json'),JSON.stringify(report,null,2)+'\n');console.log('GITHUB_RANGE_REPORT '+JSON.stringify(report));
 }catch(error){console.error(error);process.exitCode=1}finally{fs.rmSync(profile,{recursive:true,force:true,maxRetries:2});app.exit(process.exitCode??0)}
});
