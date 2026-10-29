const fs=require('node:fs'),fsp=fs.promises,path=require('node:path'),crypto=require('node:crypto');
const {buildBlockMap}=require('app-builder-lib/out/targets/blockmap/blockmap');
const {releaseBlockmaps}=require('./update-metadata.cjs');

/** Run after signing/notarization and checksum verification. It only produces
 * sidecars from the exact final downloads; it never changes an installer. */
async function prepareUpdateBlockmaps(directory,version){
 const sumsFile=path.join(directory,'SHA256SUMS.txt');
 const lines=(await fsp.readFile(sumsFile,'utf8')).split(/\r?\n/).filter(Boolean);
 const entries=new Map(lines.map(line=>{const match=/^([a-f0-9]{64})  ([^/\\]+)$/.exec(line);if(!match)throw Error('Invalid release checksum');return[match[2],match[1]]}));
 for(const name of releaseBlockmaps(version)){
  const source=name.slice(0,-'.blockmap'.length),file=path.join(directory,source);
  const digest=crypto.createHash('sha256');for await(const chunk of fs.createReadStream(file))digest.update(chunk);
  if(digest.digest('hex')!==entries.get(source))throw Error(`Cannot map an unchecked installer: ${source}`);
  await buildBlockMap(file,'gzip',path.join(directory,name));
  entries.set(name,crypto.createHash('sha256').update(await fsp.readFile(path.join(directory,name))).digest('hex'));
 }
 await fsp.writeFile(sumsFile,[...entries].map(([name,hash])=>`${hash}  ${name}`).join('\n')+'\n');
 console.log('PASS: seven blockmaps generated from checked final Windows/Mac packages');
}
if(require.main===module)prepareUpdateBlockmaps(path.resolve(__dirname,'../release'),require('../package.json').version).catch(error=>{console.error(error);process.exitCode=1});
module.exports={prepareUpdateBlockmaps};
