const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {createPetStorage,pruneArchives,ARCHIVE_LIMITS}=require('./pet-storage.cjs'),crypto=require('node:crypto');
const pet=(extra={})=>JSON.stringify({version:1,name:'旧朋友',createdAt:1700000000000,growth:840,color:'#6b399f',evolution:'super',wearing:'wizard-cap',stats:{hunger:83,energy:98},inventory:{biscuit:9},companionMemory:{events:[{detail:'以前的回忆'}]},...extra});
test('checkpoints and update/import archives survive a new process with identity, appearance and memories unchanged',t=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'ram-save-'));t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));
 const storage=createPetStorage({directory,version:'0.33.3'}),a=pet(),b=pet({growth:841});storage.checkpoint(a);storage.checkpoint(b,'before-update');
 const backupDirectory=storage.inspect().backupDirectory,archived=fs.readdirSync(backupDirectory).filter(name=>name!=='latest.json');assert.equal(archived.length,1);assert.equal(fs.readFileSync(path.join(backupDirectory,archived[0]),'utf8'),b);
 const fresh=createPetStorage({directory,version:'0.33.4'});assert.equal(fresh.read(),b);fresh.checkpoint(a,'before-import');assert.equal(fresh.read(),a);assert.equal(fs.readFileSync(path.join(backupDirectory,archived[0]),'utf8'),b);
 assert.equal(fresh.inspect().profiles[0].hasBackup,true);assert.equal(fresh.inspect().storageDirectory,path.join(directory,'Local Storage'));
});
test('invalid data, untrusted paths and unsupported operations never overwrite a valid backup',t=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'ram-save-'));t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));const storage=createPetStorage({directory,version:'test'}),a=pet();storage.checkpoint(a);
 for(const input of ['null','[]','{}','{bad','a'.repeat(1_000_001)])assert.throws(()=>storage.checkpoint(input));
 assert.throws(()=>storage.read('../secret'));assert.throws(()=>storage.folder('../secret'));assert.throws(()=>storage.checkpoint(a,'delete'));assert.equal(storage.read(),a);
});
test('an explicit farewell suppresses automatic recovery without deleting archived records',t=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'ram-save-'));t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));const storage=createPetStorage({directory,version:'test'});storage.checkpoint(pet());storage.forget(1700000000000);
 const latest=path.join(directory,'save-backups','latest.json');fs.utimesSync(latest,new Date(),new Date(Date.now()+10000));
 assert.equal(storage.read(),null);assert.ok(fs.existsSync(latest));
 storage.checkpoint(pet({createdAt:1700000001000}));assert.equal(JSON.parse(storage.read()).createdAt,1700000001000);
});
test('an unreadable previous snapshot is archived byte for byte before a new adoption writes a usable backup',t=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'ram-save-'));t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));const backups=path.join(directory,'save-backups');fs.mkdirSync(backups);fs.writeFileSync(path.join(backups,'latest.json'),'damaged old record');
 const storage=createPetStorage({directory,version:'test'});storage.checkpoint(pet());const archived=fs.readdirSync(backups).filter(name=>name!=='latest.json');assert.equal(archived.length,1);assert.equal(fs.readFileSync(path.join(backups,archived[0]),'utf8'),'damaged old record');
});
const archiveName=(index,reason='automatic')=>`${new Date(Date.UTC(2026,0,1)+index*60000).toISOString().replaceAll(':','-')}-${reason}-${crypto.randomUUID()}.json`;
const seed=(backups,index,reason,text)=>{const name=archiveName(index,reason);fs.writeFileSync(path.join(backups,name),text);return name};
test('archive pruning keeps the newest archives of each kind and leaves other files alone',t=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'ram-save-'));t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));const backups=path.join(directory,'save-backups');fs.mkdirSync(backups);
 const automatic=[],updates=[];for(let i=0;i<45;i++)automatic.push(seed(backups,i,'automatic',pet()));for(let i=0;i<15;i++)updates.push(seed(backups,100+i,'before-update',pet()));
 for(const other of ['latest.json','farewell.json','notes.txt'])fs.writeFileSync(path.join(backups,other),'keep');
 pruneArchives(backups);const left=new Set(fs.readdirSync(backups));
 assert.deepEqual(automatic.filter(name=>left.has(name)),automatic.slice(-ARCHIVE_LIMITS.automatic));
 assert.deepEqual(updates.filter(name=>left.has(name)),updates.slice(-ARCHIVE_LIMITS['before-update']));
 for(const other of ['latest.json','farewell.json','notes.txt'])assert.ok(left.has(other));
});
test('archive pruning keeps the newest archive of every earlier pet, and unreadable evidence only within the limit',t=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'ram-save-'));t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));const backups=path.join(directory,'save-backups');fs.mkdirSync(backups);
 const olderPetFirst=seed(backups,0,'automatic',pet({createdAt:1600000000000})),olderPetLast=seed(backups,1,'automatic',pet({createdAt:1600000000000})),damaged=seed(backups,2,'automatic','damaged old record');
 const current=[];for(let i=0;i<40;i++)current.push(seed(backups,10+i,'automatic',pet()));
 pruneArchives(backups);const left=new Set(fs.readdirSync(backups));
 assert.ok(left.has(olderPetLast));assert.ok(!left.has(olderPetFirst));assert.ok(!left.has(damaged));
 assert.equal(current.filter(name=>left.has(name)).length,ARCHIVE_LIMITS.automatic);
});
test('each session checkpoint prunes old automatic archives instead of growing without bound',t=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'ram-save-'));t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));const backups=path.join(directory,'save-backups');fs.mkdirSync(backups);
 for(let i=0;i<50;i++)seed(backups,i,'automatic',pet());
 createPetStorage({directory,version:'test'}).checkpoint(pet({growth:841}));
 const archived=fs.readdirSync(backups).filter(name=>name.includes('-automatic-'));assert.equal(archived.length,ARCHIVE_LIMITS.automatic);
});
