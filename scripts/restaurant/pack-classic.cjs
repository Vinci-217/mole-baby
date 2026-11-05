const fs=require('fs'),path=require('path'),sharp=require('sharp');
const root=path.resolve(__dirname,'../..'),cache=path.join(root,'local-assets/research/restaurant-port/classic-ui'),out=path.join(root,'public/assets/original/restaurant/classic');
const files=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(f=>f.isDirectory()?files(path.join(dir,f.name)):[path.join(dir,f.name)]);
(async()=>{
 const specs={},layout=JSON.parse(fs.readFileSync(path.join(cache,'layouts.json')));
 const lines=['geometry.tsv','extra-geometry.tsv'].filter(f=>fs.existsSync(path.join(cache,f))).flatMap(f=>fs.readFileSync(path.join(cache,f),'utf8').trim().split('\n'));
 for(const line of lines){const[key,sid,x0,y0,x1,y1]=line.split('\t');if(!sid)continue;const rect={x:+x0/20,y:+y0/20,w:(x1-x0)/20,h:(y1-y0)/20};
  if(key.startsWith('geometry/')){const[,room,name]=key.match(/^geometry\/(\d+)-(.+)$/);const pos=layout[room][name];const source=fs.readFileSync(path.join(cache,'room-'+room+'.xml'),'utf8');
   const match=source.match(new RegExp('name="'+name+'"[^>]*>\\s*<matrix[^>]*>'));if(match){const number=k=>Number(match[0].match(new RegExp(k+'="([^"]+)"'))?.[1]??(k.startsWith('scale')?1:0));pos.x=number('translateX')/20;pos.y=number('translateY')/20;pos.sx=number('scaleX');pos.sy=number('scaleY');}
   pos.rect=rect;continue;
  }
  specs[key]={...rect,sprite:+sid,frames:0};if(!fs.existsSync(path.join(cache,key)))continue;
  const images=files(path.join(cache,key)).filter(p=>p.endsWith('.png')).sort((a,b)=>Number(path.basename(a,'.png'))-Number(path.basename(b,'.png')));fs.mkdirSync(path.join(out,key),{recursive:true});
  for(let i=0;i<images.length;i++)await sharp(images[i]).webp({lossless:true}).toFile(path.join(out,key,i+'.webp'));specs[key].frames=images.length;
  if(images.length>1){const m=await sharp(images[0]).metadata();await sharp({create:{width:m.width*images.length,height:m.height,channels:4,background:'#00000000'}}).composite(images.map((input,i)=>({input,left:i*m.width,top:0}))).webp({lossless:true}).toFile(path.join(out,key,'sheet.webp'));specs[key].sheet=true;}
 }
 const rawRoomFiles=files(path.join(root,'local-assets/research/restaurant-port/rendered/room')).filter(p=>p.endsWith('source.xml'));
 for(const file of rawRoomFiles){const id=path.basename(path.dirname(file));const xml=fs.readFileSync(file,'utf8');
  for(const[name,p]of Object.entries(layout[id])){
   const node=xml.match(new RegExp('name="'+name+'"[^>]*>\\s*<matrix[^>]*>'));if(node){const n=k=>Number(node[0].match(new RegExp(k+'="([^"]+)"'))?.[1]??(k.startsWith('scale')?1:0));p.x=n('translateX')/20;p.y=n('translateY')/20;p.sx=n('scaleX');p.sy=n('scaleY');}
  }
 }
 const recipes=require('../../src/restaurant-data.json').recipes;fs.mkdirSync(path.join(out,'menu-icons'),{recursive:true});
 for(const r of recipes)await sharp(path.join(root,'local-assets/research/restaurant-port/rendered/icon',String(r.id),'1.png')).webp({lossless:true}).toFile(path.join(out,'menu-icons',r.id+'.webp'));
 const transforms=JSON.parse(require('child_process').execFileSync('python3',[path.join(root,'scripts/restaurant/classic-geometry.py')],{encoding:'utf8'}));
 for(const[id,points]of Object.entries(transforms))for(const[name,p]of Object.entries(points))if(layout[id][name])Object.assign(layout[id][name],p);
 fs.writeFileSync(path.join(root,'src/restaurant-classic-art.json'),JSON.stringify({specs,layouts:layout},null,2)+'\n');
 console.log('Packed original menu, native HUD, stove stage art and original hit bounds:',Object.keys(specs).length);
})().catch(e=>{console.error(e);process.exitCode=1});
