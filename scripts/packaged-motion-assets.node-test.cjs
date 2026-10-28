const{test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),asar=require('@electron/asar');
const{verifyMotionResources}=require('./packaged-motion-assets.cjs');
async function fixture(t,unpacked){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'mole-motion-package-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));const app=path.join(root,'app'),archive=path.join(root,'app.asar');
 for(const group of ['uploaded-actions','daily-frames']){const folder=path.join(app,'dist/assets/original',group,'sample');fs.mkdirSync(folder,{recursive:true});fs.writeFileSync(path.join(folder,'mask.webp'),Buffer.from('verified original texture '+group))}
 fs.writeFileSync(path.join(app,'package.json'),'{"name":"mole-baby"}');await asar.createPackageWithOptions(app,archive,unpacked?{unpack:'**/assets/original/{uploaded-actions,daily-frames}/**/*'}:{});return{app,archive};
}
test('split motion payload keeps the complete ASAR namespace and validates its external texture bytes',async t=>{
 const f=await fixture(t,true),result=await verifyMotionResources(f.archive,path.join(f.app,'dist'));assert.equal(result.files,2);assert.ok(result.bytes>0);
 fs.writeFileSync(path.join(f.archive+'.unpacked','dist/assets/original/uploaded-actions/sample/mask.webp'),'corrupt');await assert.rejects(verifyMotionResources(f.archive,path.join(f.app,'dist')),/packaged bytes differ/);
});
test('motion verification refuses packed textures instead of weakening the ZIP single-file limit',async t=>{
 const f=await fixture(t,false);await assert.rejects(verifyMotionResources(f.archive,path.join(f.app,'dist')),/must stay outside the core ASAR/);
});
