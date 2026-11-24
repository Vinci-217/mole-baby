/** Verify the installed payload without downloading or modifying any asset. */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
function verifyOfflineAssets(root){
 const index=JSON.parse(fs.readFileSync(path.join(root,'offline-resources.json')));
 if(index.schema!==1||!Array.isArray(index.files)||!index.files.length)throw Error('Invalid offline resource index');
 let bytes=0;const entries=new Map();
 for(const entry of index.files){
  if(entries.has(entry.path)||entry.path.startsWith('/')||entry.path.includes('\\')||entry.path.split('/').some(part=>part==='..'||part==='.'))throw Error('Unsafe or duplicate offline asset');
  entries.set(entry.path,entry);const file=path.join(root,entry.path),data=fs.readFileSync(file);
  if(data.length!==entry.bytes||crypto.createHash('sha256').update(data).digest('hex')!==entry.sha256)throw Error('Local asset mismatch: '+entry.path);bytes+=data.length;
 }
 if(bytes!==index.bytes)throw Error('Offline payload size mismatch');
 const original=JSON.parse(fs.readFileSync(path.join(root,'assets/original/official/manifest.json')));
 for(const clip of original.clips){const name='assets/original/official/files/'+clip.path,entry=entries.get(name);if(!entry)throw Error('Original SWF omitted: '+name);if(entry.sha256!==clip.sha256||entry.bytes!==clip.bytes)throw Error('Original source changed: '+name)}
 for(const name of ['index.html','assets/original/official/runtime.html','assets/original/official/runtime.js','assets/original/official/controller.swf','assets/original/official/ruffle/ruffle.js'])if(!entries.has(name))throw Error('Missing offline runtime: '+name);
 if(![...entries.keys()].some(name=>name.endsWith('.wasm')))throw Error('Missing bundled animation engine');
 const report=path.join(root,'asset-size-report.json');
 if(fs.existsSync(report)){
  for(const atlas of JSON.parse(fs.readFileSync(report,'utf8')).sharedFrameAtlases??[]){
   const target=entries.get(atlas.sharedWith);
   if(entries.has(atlas.file)||!target||target.sha256!==atlas.sha256||target.bytes!==atlas.bytes)throw Error('Invalid shared frame atlas: '+atlas.file);
  }
 }
 return {files:entries.size,bytes,originalSwfs:original.clips.length,revision:index.revision};
}
if(require.main===module)try{console.log(JSON.stringify(verifyOfflineAssets(path.resolve(process.argv[2]||'dist')),null,2))}catch(error){console.error(error.message);process.exitCode=1}
module.exports={verifyOfflineAssets};
