const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const SAVE_LIMIT=1_000_000;
function validBackup(text){
 if(typeof text!=='string'||Buffer.byteLength(text)>SAVE_LIMIT)throw Error('存档内容过大或无效');
 const pet=JSON.parse(text);
 if(!pet||Array.isArray(pet)||!Number.isFinite(pet.createdAt)||pet.createdAt<=0||typeof pet.name!=='string'||!pet.stats||typeof pet.stats!=='object'||!Number.isFinite(pet.growth))throw Error('无法识别拉姆存档');
 return pet;
}
// Archives are named `${ISO time with ':' → '-'}-${reason}-${uuid}.json`, so a
// plain string sort is chronological. Anything else in the folder is left alone.
const ARCHIVE_NAME=/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.\d{3}Z-(automatic|before-update|before-import)-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.json$/;
const ARCHIVE_LIMITS={automatic:30,'before-update':10,'before-import':10};
function archivedPetId(file){try{const id=JSON.parse(fs.readFileSync(file,'utf8'))?.createdAt;return Number.isFinite(id)?id:null}catch{return null}}
/** Keep the newest archives of each kind, plus the newest archive of every pet
 * that ever had one, so a farewelled or replaced companion is never lost. */
function pruneArchives(backups,limits=ARCHIVE_LIMITS){
 let names;try{names=fs.readdirSync(backups)}catch{return}
 const archives=names.filter(name=>ARCHIVE_NAME.test(name)).sort().reverse();
 const kept={},pets=new Set();
 for(const name of archives){
  const reason=ARCHIVE_NAME.exec(name)[1],file=path.join(backups,name),petId=archivedPetId(file);
  const withinLimit=(kept[reason]??0)<limits[reason],lastOfPet=petId!==null&&!pets.has(petId);
  if(petId!==null)pets.add(petId);
  if(withinLimit||lastOfPet){kept[reason]=(kept[reason]??0)+1;continue}
  try{fs.unlinkSync(file)}catch{}
 }
}
function atomicWrite(file,text){
 const temporary=file+'.'+crypto.randomUUID()+'.tmp';
 try{fs.writeFileSync(temporary,text,{mode:0o600,flag:'wx'});fs.renameSync(temporary,file)}
 finally{try{fs.unlinkSync(temporary)}catch(error){if(error.code!=='ENOENT')throw error}}
}
/** Independent of Chromium's origin, install location and update cache. Only
 * the trusted application frame can write a bounded, validated pet backup. */
function createPetStorage({directory,profiles=[],version}){
 const backups=path.join(directory,'save-backups'),latest=path.join(backups,'latest.json'),forgotten=path.join(backups,'farewell.json');
 let lastText='',sessionArchived=false;
 const directories=[...new Set([directory,...profiles])].map(value=>path.resolve(value));
 function readLatest(profile=directory){
  const file=path.join(profile,'save-backups','latest.json');
  try{const text=fs.readFileSync(file,'utf8'),pet=validBackup(text);let farewell;try{farewell=JSON.parse(fs.readFileSync(path.join(profile,'save-backups','farewell.json'),'utf8'))}catch{}
   // Filesystem timestamps can be sub-millisecond or ahead of Date.now() on
   // APFS/NTFS. An explicit farewell is authoritative until a new checkpoint
   // explicitly reactivates that identity; clock comparisons can resurrect it.
   if(farewell?.petId===pet.createdAt&&farewell.at>0)return null;
   return {text,pet,file};
  }catch{return null}
 }
 function checkpoint(text,reason='automatic'){
  if(!['automatic','before-update','before-import'].includes(reason))throw Error('无效的备份类型');
  const pet=validBackup(text);fs.mkdirSync(backups,{recursive:true,mode:0o700});
  if(!sessionArchived||reason!=='automatic'){
   // Even an unreadable previous snapshot is evidence worth preserving. Never
   // overwrite the only copy merely because validation could not parse it.
   let previous;try{previous=fs.readFileSync(latest)}catch(error){if(error.code!=='ENOENT')throw error}
   const archived=reason==='automatic'?previous:text;
   if(archived){const name=`${new Date().toISOString().replaceAll(':','-')}-${reason}-${crypto.randomUUID()}.json`;fs.writeFileSync(path.join(backups,name),archived,{mode:0o600,flag:'wx'})}
   pruneArchives(backups);sessionArchived=true;
  }
  if(text!==lastText||!fs.existsSync(latest)){atomicWrite(latest,text);lastText=text}
  // An explicit new adoption/import after farewell is a new active save.
  try{const marker=JSON.parse(fs.readFileSync(forgotten,'utf8'));if(marker.petId===pet.createdAt)atomicWrite(forgotten,JSON.stringify({...marker,at:0}))}catch{}
  return true;
 }
 function inspect(){
  return {version,profileDirectory:directory,storageDirectory:path.join(directory,'Local Storage'),backupDirectory:backups,profiles:directories.map(profile=>{
   const backup=readLatest(profile);let hasBrowserData=false;try{hasBrowserData=fs.readdirSync(path.join(profile,'Local Storage','leveldb')).some(name=>/\.(?:ldb|log)$/.test(name))}catch{}
   return {directory:profile,active:profile===path.resolve(directory),hasBrowserData,hasBackup:Boolean(backup),backupAt:backup?fs.statSync(backup.file).mtimeMs:null,backupBytes:backup?Buffer.byteLength(backup.text):0};
  })};
 }
 return {checkpoint,inspect,
  read(profile){if(profile!==undefined&&!directories.includes(profile))throw Error('无效的存档目录');return readLatest(profile??directory)?.text??null},
  folder(kind){if(!['profile','backups'].includes(kind))throw Error('无效的存档位置');const target=kind==='profile'?directory:backups;fs.mkdirSync(target,{recursive:true,mode:0o700});return target},
  forget(petId){if(!Number.isFinite(petId))throw Error('无效的拉姆身份');fs.mkdirSync(backups,{recursive:true,mode:0o700});atomicWrite(forgotten,JSON.stringify({petId,at:Date.now()}));lastText='';return true},
 };
}
module.exports={createPetStorage,validBackup,pruneArchives,ARCHIVE_LIMITS,SAVE_LIMIT};
