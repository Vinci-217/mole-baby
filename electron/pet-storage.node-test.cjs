const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {createPetStorage}=require('./pet-storage.cjs');
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
