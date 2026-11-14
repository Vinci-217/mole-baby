/** Source-body reference for adapting existing Super clothing to classic Ram. */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),sharp=require('sharp');
const root=path.resolve(__dirname,'../..');
(async()=>{
 const result={};
 for(const [kind,file,rows] of [['classic','public/assets/classic/super-mask.png',3],['slumber','public/assets/original/slumber/super-mask.png',1]]){
  const source=fs.readFileSync(path.join(root,file)),{data,info}=await sharp(source).ensureAlpha().raw().toBuffer({resolveWithObject:true}),bounds=[];
  for(let row=0;row<rows;row++)for(let frame=0;frame<8;frame++){
   let left=192,top=208,right=0,bottom=0;
   for(let y=0;y<208;y++)for(let x=0;x<192;x++){const i=((row*208+y)*info.width+frame*192+x)*4;if(data[i+3]>120&&data[i]+data[i+1]+data[i+2]>90){left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y)}}
   bounds.push(left<=right?[left,top,right,bottom]:null);
  }
  result[kind]={source:file,sha256:crypto.createHash('sha256').update(source).digest('hex'),bounds};
 }
 fs.writeFileSync(path.join(root,'local-assets/retired/v0333-wardrobe/generated-wardrobe-motion/super-body-bounds.json'),JSON.stringify(result)+'\n');
})().catch(error=>{console.error(error);process.exitCode=1});
