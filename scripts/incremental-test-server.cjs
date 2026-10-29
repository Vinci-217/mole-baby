const fs=require('node:fs'),http=require('node:http');
/** Loopback-only fixture. It cannot be selected by the production renderer. */
async function createUpdateServer(files,{version='1.0.1'}={}){
 const requests=[],behavior={range:'normal'};
 const server=http.createServer((req,res)=>{
  const pathname=new URL(req.url,'http://localhost').pathname;
  const record={path:pathname,method:req.method,range:req.headers.range??null,status:0,bodyBytes:0};requests.push(record);
  const send=(status,headers,body)=>{record.status=status;res.writeHead(status,headers);if(req.method==='HEAD'){res.end();return}record.bodyBytes=body?.length??0;res.end(body)};
  if(pathname==='/releases/latest'){send(200,{},'');return}
  const file=files.get(pathname);if(!file){send(404,{},Buffer.from('Not found'));return}
  const size=Buffer.isBuffer(file)?file.length:fs.statSync(file).size;
  let start=0,end=size-1,status=200;
  if(req.headers.range&&behavior.range!=='unsupported'){
   const match=/^bytes=(\d+)-(\d+)$/.exec(req.headers.range);
   if(!match){send(416,{},'');return}
   start=Number(match[1]);end=Number(match[2]);status=206;
   if(start>end||start<0||end>=size){send(416,{},'');return}
  }
  const headers={'Content-Length':end-start+1,'Accept-Ranges':'bytes','Content-Type':'application/octet-stream'};
  if(status===206)headers['Content-Range']=behavior.range==='wrong-header'?`bytes 0-${end}/${size}`:`bytes ${start}-${end}/${size}`;
  const stream=()=>{
   record.status=status;res.writeHead(status,headers);
   if(req.method==='HEAD'){res.end();return}
   if(Buffer.isBuffer(file)){const body=file.subarray(start,end+1);record.bodyBytes=body.length;res.end(body)}
   else{const input=fs.createReadStream(file,{start,end});input.on('data',bytes=>record.bodyBytes+=bytes.length);input.on('error',()=>res.destroy());res.on('close',()=>input.destroy());input.pipe(res)}
  };
  if(req.headers.range&&behavior.range==='wait'){behavior.onRange?.();req.on('close',()=>{});return}
  stream();
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const origin=`http://127.0.0.1:${server.address().port}`;
 return{server,origin,requests,behavior,version,async close(){server.closeAllConnections?.();await new Promise(resolve=>server.close(resolve))}};
}
function mappedFetch(origin,version,fetcher=fetch){return async(url,options)=>{
 const pathname=new URL(url).pathname.replace('/Vinci-217/mole-baby','');
 const response=await fetcher(origin+pathname,options);
 if(pathname==='/releases/latest')return{ok:response.ok,url:`https://github.com/Vinci-217/mole-baby/releases/tag/v${version}`};
 return response;
}}
module.exports={createUpdateServer,mappedFetch};
