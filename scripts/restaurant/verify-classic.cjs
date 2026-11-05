const fs=require('fs'),path=require('path'),assert=require('assert/strict'),sharp=require('sharp');
const root=path.resolve(__dirname,'../..'),base=path.join(root,'public/assets/original/restaurant/classic'),art=require('../../src/restaurant-classic-art.json'),data=require('../../src/restaurant-data.json'),original=require('../../research/references/restaurant/port-feasibility.json');
(async()=>{
 let states=0,hotspots=0,sheets=0;
 for(const r of data.recipes){const raw=original.recipes.find(a=>a.ID===r.id);assert.equal(r.cookMs,raw.NeedTimer*1000);assert.equal(r.freshMs,raw.Timeout*1000);assert.equal(art.specs['states/'+r.id].frames,6);
  for(let frame=0;frame<6;frame++){const bytes=await sharp(path.join(base,'states',String(r.id),frame+'.webp')).ensureAlpha().raw().toBuffer();let alpha=0;for(let i=3;i<bytes.length;i+=4)if(bytes[i]>30)alpha++;assert(alpha>100,'Empty original stove state '+r.id+'/'+frame);states++;}
 }
 for(const r of data.interiors){const l=art.layouts[r.id];for(let i=1;i<=r.stoves;i++){const h=l['zaoBtn'+i];assert(h&&h.rect.w>0&&h.rect.h>0);assert(h.x>=0&&h.x<960&&h.y>=0&&h.y<560);assert(l['foodTable'+i]);hotspots++;}assert(l.myNameMc.text);}
 for(const[key,s]of Object.entries(art.specs)){if(!s.sheet)continue;const m=await sharp(path.join(base,key,'sheet.webp')).metadata();assert(m.width<=16384&&m.height<=16384);sheets++;}
 assert.equal(art.specs.prepare.frames,50);assert.equal(art.specs['clock-steps'].frames,37);assert(art.specs['menu-clean-frame'].w>800);
 const result={passed:true,originalStoveStateFrames:states,originalStoveHotspots:hotspots,packedAnimationSheets:sheets,originalRecipeTimers:true};fs.mkdirSync(path.join(root,'artifacts/original-restaurant-ui'),{recursive:true});fs.writeFileSync(path.join(root,'artifacts/original-restaurant-ui/asset-checks.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
})().catch(e=>{console.error(e);process.exitCode=1});
