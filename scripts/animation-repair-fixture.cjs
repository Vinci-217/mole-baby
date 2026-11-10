const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const root=path.resolve(__dirname,'..');
const compiled=require('esbuild').buildSync({stdin:{contents:"export {createPet,parseSave} from './src/game';export {createMemory,recordEvent} from './src/companion-memory';",resolveDir:root},bundle:true,platform:'node',format:'cjs',write:false}).outputFiles[0].text;
const name=path.join(__dirname,'qa-fixture-bundle.cjs'),bundle=new Module(name);bundle.paths=module.paths;bundle._compile(compiled,name);
const {createPet,parseSave,createMemory,recordEvent}=bundle.exports;
module.exports=function loadFixture(out){
 const file=path.join(out,'qa-storage.json');fs.mkdirSync(out,{recursive:true});
 if(!fs.existsSync(file)){
  const now=Date.now(),pet={...createPet('动画回归测试','blue',now),color:'#9c5fd4',growth:840,evolution:'super',naturalGrowth:420,highestGrowth:420,growthLocked:true,wardrobe:['warm-scarf','magic-book','party-cap'],wearing:'warm-scarf',coins:1800,education:{lessons:{magic:1,'element-fire':1,'element-water':1,'element-wood':1},graduated:{magic:now,'element-fire':now,'element-water':now,'element-wood':now}},stats:{hunger:95,thirst:95,cleanliness:95,happiness:95,health:100,energy:95}};
  const memory=recordEvent(createMemory(pet),{kind:'qa-record',detail:'动画回归固定测试记录，下次继续复用。',at:now});
  fs.writeFileSync(file,JSON.stringify({'ramu-house-save-v1':JSON.stringify(pet),['ramu-companion-memory-v1:'+pet.createdAt]:JSON.stringify(memory),'ramu-house-preferences-v2':JSON.stringify({lively:false,presence:false,sound:false,gameSound:false,roomWander:false})},null,2));
 }
 const snapshot=JSON.parse(fs.readFileSync(file,'utf8'));
 // Compare the application's ordinary normalized save, not inconsistent raw
 // legacy fields. Never rewrite the persisted fixture or a player's profile.
 const pet=parseSave(snapshot['ramu-house-save-v1'],Date.now());if(!pet)throw Error('Invalid QA fixture');
 return {snapshot,pet};
};
