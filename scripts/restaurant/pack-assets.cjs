const fs=require('fs'),path=require('path'),sharp=require('sharp');
const root=path.resolve(__dirname,'../..'),cache=path.join(root,'local-assets/research/restaurant-port'),out=path.join(root,'public/assets/original/restaurant');
const source=JSON.parse(fs.readFileSync(path.join(cache,'playable-assets.json')));
const files=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(f=>f.isDirectory()?files(path.join(dir,f.name)):[path.join(dir,f.name)]);
(async()=>{
 for(const dir of ['icons','dishes','rooms','audio','workers','guests'])fs.mkdirSync(path.join(out,dir),{recursive:true});
 for(const asset of source){const p=asset.path,id=path.basename(p,'.swf'),kind=p.includes('meunicon')?'icon':p.includes('oneBigStree')?'room':'model';const file=files(path.join(cache,'rendered',kind,id)).find(p=>p.endsWith('.png'));
 if(!file)throw Error('No rendered frame '+p);
 const dest=path.join(out,kind==='icon'?'icons':kind==='model'?'dishes':'rooms',id+'.webp');
 let image=sharp(file);if(kind!=='room')image=image.trim().resize({width:kind==='icon'?128:144,height:kind==='icon'?112:112,fit:'inside'});
 await image.webp({lossless:true}).toFile(dest);
 }
 const poses=JSON.parse(fs.readFileSync(path.join(root,'artifacts/restaurant-loop/poses.json'))),specs={};
 for(const[id,directions]of Object.entries(poses.actors))for(const[dir,s]of Object.entries(directions)){
  const frames=[],moving=[];const w=200,h=240;
  for(let i=1;i<=15;i++){
   const img=await sharp(path.join(s.directory,i+'.png')).resize({width:Math.round((s.boundsTwips[2]-s.boundsTwips[0])/20*3)}).png().toBuffer();
   const {data:pixels}=await sharp(img).ensureAlpha().raw().toBuffer({resolveWithObject:true});let visible=0;for(let p=3;p<pixels.length;p+=4)if(pixels[p]>30)visible++;if(i>=3&&visible>100)moving.push(i-1);
   frames.push({input:img,left:(i-1)*w+Math.round(w/2+s.boundsTwips[0]/20*3),top:Math.round(200-75+s.boundsTwips[1]/20*3)});
  }
  const name=id+'-'+dir;await sharp({create:{width:w*15,height:h,channels:4,background:'#00000000'}}).composite(frames).webp({lossless:true}).toFile(path.join(out,'workers',name+'.webp'));
  specs[name]={width:w,height:h,frames:15,ground:200,moving};
 }
 for(const color of ['pink','yellow','blue','red']){
  const layers=[];for(let i=1;i<=16;i++){
   const file=files(path.join(cache,'guests',color)).find(p=>p.endsWith('/'+i+'.png'));if(!file)throw Error('Missing original eating frame');
   layers.push({input:file,left:(i-1)*100+5,top:17});
  }
  await sharp({create:{width:1600,height:96,channels:4,background:'#00000000'}}).composite(layers).webp({lossless:true}).toFile(path.join(out,'guests',color+'.webp'));
 }
 const sounds=['foodOk','downPot','downFood','foodSuccess','foodGo','bgSound'];sounds.forEach((name,i)=>fs.copyFileSync(path.join(root,`local-assets/extracted/root/module/restaurant/restaurant.swf/sounds/${i+1}_${name}.mp3`),path.join(out,'audio',name+'.mp3')));
 fs.writeFileSync(path.join(out,'workers.json'),JSON.stringify(specs,null,2)+'\n');
 fs.writeFileSync(path.join(root,'src/restaurant-worker-art.json'),JSON.stringify(specs,null,2)+'\n');
 fs.writeFileSync(path.join(out,'sources.json'),JSON.stringify({license:'Original art and sounds belong to Taomee. See README and research/restaurant-original-assets.md.',assets:source,adaptation:'Lossless rendered original SWFs; worker uses original body colour transform GV.petColor_3. Online clocks, coin-only recipes and gameplay are a local desktop adaptation, not official server logic.'},null,2)+'\n');
 console.log('Packed',source.length,'verified SWFs, original worker poses and six original sounds');
})().catch(e=>{console.error(e);process.exitCode=1});
