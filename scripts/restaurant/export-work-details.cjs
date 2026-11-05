// Derivative exports only; original SWF and classic body/masks remain unchanged.
const fs=require('node:fs'),path=require('node:path'),sharp=require('sharp');
const root=path.resolve(__dirname,'../..'),cache=path.join(root,'local-assets/research/restaurant-work-details');
const out=path.join(root,'public/assets/original/restaurant/work-details');
const palettes={blue:[-215,-57,31],pink:[51,-148,0],yellow:[0,-21,-255],red:[255,-199,-250]};
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 for(const [name,file] of Object.entries({stove:'shapes/39.png',burner:'41/DefineSprite_41/1.png',table:'74/DefineSprite_74_1330004_fla.n_uantt5jp0b4_30/1.png'}))await sharp(path.join(cache,file)).trim().webp({lossless:true}).toFile(path.join(out,name+'.webp'));
 const neutral=await sharp(path.join(root,'public/assets/classic/junior-neutral.png')).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const mask=await sharp(path.join(root,'public/assets/classic/junior-mask.png')).ensureAlpha().raw().toBuffer();
 let ground=0;
 for(const row of [1,2])for(let frame=0;frame<8;frame++)for(let y=0;y<208;y++)for(let x=0;x<192;x++){const i=((row*208+y)*neutral.info.width+frame*192+x)*4;if(neutral.data[i+3]>40)ground=Math.max(ground,y+1);}
 for(const [name,offset] of Object.entries(palettes)){
  const pixels=Buffer.from(neutral.data),clamp=n=>Math.max(0,Math.min(255,n));
  const deltas=[255,204,153].map(base=>offset.map(o=>clamp(base+o)-base));
  for(let i=0;i<pixels.length;i+=4)if(mask[i]||mask[i+1]||mask[i+2])for(let c=0;c<3;c++)pixels[i+c]=clamp(pixels[i+c]+deltas[0][c]*mask[i]/255+deltas[1][c]*mask[i+1]/255+deltas[2][c]*mask[i+2]/255);
  const frames=[];let index=0;
  for(const row of [1,2])for(let f=0;f<8;f++){
   const body=await sharp(pixels,{raw:neutral.info}).extract({left:f*192,top:row*208,width:192,height:208}).resize({width:100}).png().toBuffer();
   frames.push({input:body,left:index++*100,top:Math.round(80-ground*100/192)});
  }
  await sharp({create:{width:1600,height:112,channels:4,background:'#00000000'}}).composite(frames).webp({lossless:true}).toFile(path.join(out,'guest-'+name+'.webp'));
 }
 fs.writeFileSync(path.join(out,'sources.json'),JSON.stringify({rights:'Original artwork belongs to Taomee and the original rights holders.',props:{source:'root/resource/oneBigStree/swf/1330004.swf',stove:'DefineShape 39',burner:'DefineSprite 41',table:'DefineSprite 74'},guests:{source:'public/assets/classic/junior-neutral.png and junior-mask.png; original lamubone body',frames:'0–7 walk right; 8–15 walk left; first direction frame for standing',cell:[100,112],ground:80,colour:'Existing original additive body palette, retaining eye whites and shadows'},adaptation:'Standalone prop arrangement, routes and phase timings are local choreography.'},null,2)+'\n');
 console.log('Exported original stove, burner, table and four correctly registered walk/idle guest atlases; ground',ground);
})().catch(e=>{console.error(e);process.exitCode=1});
