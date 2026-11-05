const fs=require('fs'),path=require('path'),assert=require('assert/strict'),sharp=require('sharp');
const root=path.resolve(__dirname,'../..'),base=path.join(root,'public/assets/original/restaurant'),data=require('../../src/restaurant-data.json'),workers=require('../../src/restaurant-worker-art.json'),layouts=require('../../src/restaurant-layouts.json');
(async()=>{
 let checked=0;
 for(const r of data.recipes)for(const dir of ['icons','dishes']){
  const file=path.join(base,dir,r.id+'.webp'),{data:bytes,info}=await sharp(file).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  let alpha=0;for(let i=3;i<bytes.length;i+=4)if(bytes[i]>30)alpha++;assert(alpha>100,'Empty original food art '+file);assert(info.width<=144);checked++;
 }
 for(const r of data.interiors){const m=await sharp(path.join(base,'rooms',r.id+'.webp')).metadata();assert.equal(m.width,960);assert.equal(m.height,560);for(let i=0;i<r.tables;i++)assert(layouts[r.id]['tablePoint'+(101+i)]);for(let i=0;i<r.stoves;i++)assert(layouts[r.id]['foodTable'+(1+i)]);checked++;}
 let moving=0;
 for(const[name,spec]of Object.entries(workers))for(const frame of spec.moving){
  const bytes=await sharp(path.join(base,'workers',name+'.webp')).extract({left:frame*spec.width,top:0,width:spec.width,height:spec.height}).ensureAlpha().raw().toBuffer();let alpha=0;for(let i=3;i<bytes.length;i+=4)if(bytes[i]>30)alpha++;assert(alpha>100,'Blank transition frame in moving cycle '+name+'/'+frame);moving++;
 }
 for(const color of ['pink','yellow','blue','red'])for(let frame=0;frame<16;frame++){
  const bytes=await sharp(path.join(base,'guests',color+'.webp')).extract({left:frame*100,top:0,width:100,height:96}).ensureAlpha().raw().toBuffer();let alpha=0;for(let i=3;i<bytes.length;i+=4)if(bytes[i]>30)alpha++;assert(alpha>100,'Incomplete eating frame '+color+'/'+frame);
 }
 const report={passed:true,originalFoodAndRoomImages:checked,visibleWorkerCycleFrames:moving,originalEatingFrames:64,sourceSwfs:159};console.log(JSON.stringify(report));fs.mkdirSync(path.join(root,'artifacts/playable-restaurant'),{recursive:true});fs.writeFileSync(path.join(root,'artifacts/playable-restaurant/asset-checks.json'),JSON.stringify(report,null,2)+'\n');
})().catch(error=>{console.error(error);process.exitCode=1});
