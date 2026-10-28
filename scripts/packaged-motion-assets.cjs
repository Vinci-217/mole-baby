/** Keep full frame textures outside the core ASAR, and verify every byte. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),asar=require('@electron/asar');
const GROUPS=['uploaded-actions','daily-frames'];
function walk(root,prefix=''){return fs.readdirSync(root,{withFileTypes:true}).flatMap(e=>{const name=prefix+e.name;assert.ok(e.isDirectory()||e.isFile(),'Animation resources must be regular files');return e.isDirectory()?walk(path.join(root,e.name),name+'/'):[name]})}
async function hash(file){const h=crypto.createHash('sha256');for await(const b of fs.createReadStream(file))h.update(b);return h.digest('hex')}
async function verifyMotionResources(archive,dist=path.resolve(__dirname,'../dist')){
 assert.ok(fs.statSync(archive).size<=512*1024*1024,'Core ASAR exceeds the portable archive single-file limit');
 const packed=new Set(asar.listPackage(archive).map(f=>f.replace(/\\/g,'/').replace(/^\//,'')));let files=0,bytes=0;
 for(const group of GROUPS){
  const relative=`dist/assets/original/${group}/`,source=path.join(dist,'assets/original',group),expected=walk(source).sort(),actual=[...packed].filter(f=>f.startsWith(relative)&&!asar.statFile(archive,f).files).map(f=>f.slice(relative.length)).sort();assert.ok(expected.length>0,group+' missing');assert.deepEqual(actual,expected,group+' packaged file list');
  for(const name of expected){const entry=relative+name,info=asar.statFile(archive,entry);assert.equal(info.unpacked,true,entry+' must stay outside the core ASAR');const physical=path.join(archive+'.unpacked',...entry.split('/'));assert.ok(fs.statSync(physical).isFile(),entry);assert.equal(await hash(physical),await hash(path.join(source,...name.split('/'))),entry+' packaged bytes differ');files++;bytes+=fs.statSync(physical).size}
 }
 return{files,bytes,coreAsarBytes:fs.statSync(archive).size};
}
module.exports={verifyMotionResources};
if(require.main===module)verifyMotionResources(process.argv[2],process.argv[3]).then(result=>console.log('PASS installed split animation payload',JSON.stringify(result))).catch(error=>{console.error(error);process.exitCode=1});
