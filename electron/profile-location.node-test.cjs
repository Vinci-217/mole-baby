const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {selectProfile}=require('./profile-location.cjs');
test('settings-only directories cannot hide an existing old pet profile, and the selected path stays pinned',t=>{
 const appData=fs.mkdtempSync(path.join(os.tmpdir(),'ram-profiles-'));t.after(()=>fs.rmSync(appData,{recursive:true,force:true}));
 const modern=path.join(appData,'mole-baby'),old=path.join(appData,'拉姆陪伴'),original=path.join(appData,'拉姆');fs.mkdirSync(modern);fs.writeFileSync(path.join(modern,'window-state.json'),'{}');fs.mkdirSync(path.join(old,'Local Storage'),{recursive:true});fs.writeFileSync(path.join(old,'Local Storage','record'),'never delete');
 const settings={appData,original,packaged:true};assert.equal(selectProfile(settings),old);fs.mkdirSync(path.join(modern,'Local Storage'));assert.equal(selectProfile(settings),old);assert.equal(fs.readFileSync(path.join(old,'Local Storage','record'),'utf8'),'never delete');
 assert.equal(selectProfile({...settings,explicit:path.join(appData,'isolated')}),path.join(appData,'isolated'));assert.equal(selectProfile({...settings,legacyName:'mole-baby-legacy'}),path.join(appData,'mole-baby-legacy'));assert.equal(selectProfile({...settings,packaged:false}),original);
});
