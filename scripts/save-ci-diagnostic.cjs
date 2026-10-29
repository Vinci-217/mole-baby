const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{execFileSync}=require('node:child_process');

/** Save each finished platform independently, so a slow sibling job does not
 * hide its failure. A temporary index preserves the checkout and staged files. */
function saveDiagnostic({cwd=path.resolve(__dirname,'..'),env=process.env}={}){
 const {GITHUB_SHA:sha,CI_DIAGNOSTIC_PLATFORM:platform,CI_DIAGNOSTIC_STATUS:status,CI_DIAGNOSTIC_LOG:log}=env;
 if(!/^[a-f0-9]{40}$/.test(sha??'')||!/^(windows(?:-candidate)?|legacy-(x64|ia32)|mac-(arm64|x64))$/.test(platform??'')||!['success','failure','cancelled'].includes(status))throw Error('Invalid CI diagnostic identity');
 const receipt={sourceSha:sha,platform,status,runUrl:`${env.GITHUB_SERVER_URL}/${env.GITHUB_REPOSITORY}/actions/runs/${env.GITHUB_RUN_ID}`,log:fs.existsSync(path.resolve(cwd,log))?fs.readFileSync(path.resolve(cwd,log),'utf8').slice(-64000):null,recordedAt:new Date().toISOString()};
 const media=[];
 if(env.CI_DIAGNOSTIC_MEDIA_DIR){
  if(!/^artifacts\/windows-surface-(modern|candidate|legacy)$/.test(env.CI_DIAGNOSTIC_MEDIA_DIR))throw Error('Invalid diagnostic media directory');
  const directory=path.resolve(cwd,env.CI_DIAGNOSTIC_MEDIA_DIR);
  if(fs.existsSync(directory))for(const name of fs.readdirSync(directory).filter(n=>/^[a-z0-9.-]+\.png$/.test(n)).sort((a,b)=>fs.statSync(path.join(directory,b)).mtimeMs-fs.statSync(path.join(directory,a)).mtimeMs).slice(0,8)){
   const file=path.join(directory,name),stat=fs.lstatSync(file);if(!stat.isFile()||stat.size>2*1024*1024)throw Error('Invalid diagnostic image');
   const bytes=fs.readFileSync(file);if(!bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))throw Error('Invalid PNG diagnostic');
   media.push({name,path:`reports/media/${sha}/${platform}/${name}`,bytes});
  }
  receipt.screens=media.map(({name,path,bytes})=>({name,path,bytes:bytes.length}));
 }
 const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'mole-ci-index-'));
 const indexEnv={...process.env,GIT_INDEX_FILE:path.join(temporary,'index')};
 const git=(args,options={})=>execFileSync('git',args,{cwd,env:indexEnv,encoding:'utf8',stdio:['pipe','pipe','pipe'],...options}).trim();
 try{
  const blob=git(['hash-object','-w','--stdin'],{input:JSON.stringify(receipt,null,2)+'\n'});
  const images=media.map(image=>({...image,blob:git(['hash-object','-w','--stdin'],{input:image.bytes})}));
  for(let attempt=0;attempt<4;attempt++){
   git(['fetch','--depth=1','origin','refs/heads/build-reports']);const parent=git(['rev-parse','FETCH_HEAD']);
   git(['read-tree',parent]);git(['update-index','--add','--cacheinfo',`100644,${blob},reports/jobs/${sha}/${platform}.json`]);
   for(const image of images)git(['update-index','--add','--cacheinfo',`100644,${image.blob},${image.path}`]);
   const tree=git(['write-tree']),commit=git(['-c','user.name=github-actions[bot]','-c','user.email=41898282+github-actions[bot]@users.noreply.github.com','commit-tree',tree,'-p',parent,'-m',`Record ${platform} diagnostic (${status})`]);
   try{git(['push','origin',`${commit}:refs/heads/build-reports`]);return receipt}catch(error){if(attempt===3)throw error}
  }
 }finally{fs.rmSync(temporary,{recursive:true,force:true})}
}
if(require.main===module){try{saveDiagnostic();console.log('Saved platform diagnostic over Git')}catch(error){console.error(error.message);process.exitCode=1}}
module.exports={saveDiagnostic};
