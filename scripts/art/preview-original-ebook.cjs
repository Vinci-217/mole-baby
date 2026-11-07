const fs=require('node:fs'),path=require('node:path'),sharp=require('sharp'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'../..'),work=path.join(root,'artifacts/original-reading-runtime'),out=path.join(root,'artifacts/original-ebook-review'),manifest=require('../../public/assets/original/reading-book/source.json');
(async()=>{fs.mkdirSync(out,{recursive:true});const dir=path.join(out,'original-frames');fs.mkdirSync(dir,{recursive:true});const spec=manifest.forms.super;
 for(let i=0;i<spec.frames;i++){const input=path.join(work,'png-sequence/yellow/super',`${String(i+1).padStart(3,'0')}.png`);await sharp(input).flatten({background:'#fbf7ea'}).resize({width:300}).png().toFile(path.join(dir,`${String(i).padStart(3,'0')}.png`));}
 execFileSync('ffmpeg',['-y','-loglevel','error','-framerate','24','-i',path.join(dir,'%03d.png'),'-filter_complex_threads','1','-filter_complex','split[a][b];[a]palettegen[p];[b][p]paletteuse=dither=sierra2_4a','-loop','0',path.join(out,'original-ebook-super.gif')],{timeout:60000});
 const labels={junior:'初级',middle:'中级',senior:'高级',classic:'经典超拉',super:'神力超拉',water:'水系',wood:'木系',fire:'火系'},tiles=[];
 for(const[i,[form,label]]of Object.entries(labels).entries()){
  const png=await sharp(path.join(work,`png-sequence/yellow/${form}/001.png`)).resize({width:180,height:180,fit:'inside'}).extend({top:0,bottom:0,left:0,right:0}).png().toBuffer(),info=await sharp(png).metadata();
  tiles.push({input:png,left:i%4*225+Math.round((225-info.width)/2),top:Math.floor(i/4)*230+180-info.height});
  const text=Buffer.from(`<svg width="225" height="40"><text x="112.5" y="26" text-anchor="middle" font-family="sans-serif" font-size="16" fill="#735839">${label}</text></svg>`);tiles.push({input:text,left:i%4*225,top:Math.floor(i/4)*230+184});
 }
 await sharp({create:{width:900,height:460,channels:4,background:'#fbf7ea'}}).composite(tiles).png().toFile(path.join(out,'original-ebook-forms.png'));
 fs.writeFileSync(path.join(work,'png-sequence/README.txt'),'原版 Ebook 装扮正面动作，24 fps。yellow 目录中的每张 PNG 均为原 SWF 在 Ruffle 播放后的浏览器透明截图，只统一裁切，没有绘制翻页、开合或插帧。每种形态从 001.png 顺序循环。来源、哈希、循环长度见 source.json。角色与素材权利归淘米；此为离线素材播放导出，不是登录原游戏的屏幕录像。\n');
 console.log('Original source GIF and eight-form contact sheet ready.');
})().catch(e=>{console.error(e);process.exitCode=1});
