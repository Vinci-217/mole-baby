/** Contact-sheet GIFs from recorded original frames, without redrawing the art. */
const fs=require('node:fs'),path=require('node:path'),sharp=require('sharp');sharp.concurrency(1);
const root=path.resolve(__dirname,'..'),folder=path.join(root,'artifacts/all-original-animations');
const escape=text=>text.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
(async()=>{
 const {rows}=JSON.parse(fs.readFileSync(path.join(folder,'catalog.json'),'utf8'));
 const selected=rows.filter(row=>row.newOutfit).slice(0,12),decoded=[];
 for(const row of selected){
  const file=path.join(folder,row.gif),meta=await sharp(file,{animated:true}).metadata(),{data,info}=await sharp(file,{animated:true}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const pages=[];for(let page=0;page<(meta.pages||1);page++)pages.push(await sharp(data.subarray(page*info.width*meta.pageHeight*4,(page+1)*info.width*meta.pageHeight*4),{raw:{width:info.width,height:meta.pageHeight,channels:4}}).resize(200,217).png().toBuffer());
  decoded.push({pages,delays:meta.delay||[3840]});
 }
 const width=960,height=1000,background=Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#faf5eb"/><g font-family="sans-serif" fill="#705033"><text x="24" y="38" font-size="24" font-weight="bold">拉姆 · 新增衣橱装扮</text><text x="24" y="65" font-size="13" fill="#9a7d57">12 件示例 · 完整目录收录 110 件新增装扮及全部 567 份接入素材</text>${selected.map((row,i)=>{const x=i%4*236+15,y=Math.floor(i/4)*294+88;return `<rect x="${x}" y="${y}" width="222" height="282" rx="12" fill="#fffdf8" stroke="#e5d6bc"/><text x="${x+111}" y="${y+259}" text-anchor="middle" font-size="14">${escape(row.name)}</text>`}).join('')}<text x="24" y="991" font-size="12" fill="#9a7d57">原版画面录制 · 正面、左移、右移 · 原图形和时间轴，桌宠适配播放</text></g></svg>`);
 const frames=[];
 for(let i=0;i<48;i++){
  const images=decoded.map((item,index)=>{let time=i*80,page=0;while(page<item.delays.length-1&&time>=item.delays[page])time-=item.delays[page++];return {input:item.pages[Math.min(page,item.pages.length-1)],left:index%4*236+26,top:Math.floor(index/4)*294+106};});
  frames.push(await sharp(background).composite(images).ensureAlpha().raw().toBuffer());
 }
 await sharp(Buffer.concat(frames),{raw:{width,height:height*frames.length,channels:4,pageHeight:height}}).gif({loop:0,delay:80,effort:2,dither:.4}).toFile(path.join(folder,'新增衣橱总览.gif'));
 console.log('Created recorded 12-outfit overview GIF');
})().catch(e=>{console.error(e);process.exitCode=1});
