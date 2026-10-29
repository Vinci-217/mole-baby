const {computeOperations,OperationKind}=require('electron-updater/out/differentialDownloader/downloadPlanBuilder');
const RANGE_OVERHEAD=64*1024,MAX_RANGES=512,FULL_RATIO=.9;
/** A difference can add, change, move or remove bytes. Always reconstruct a
 * complete new package; nothing patches the running app or save in place. */
function planUpdate(oldMap,newMap){
 const source=computeOperations(oldMap.map,newMap.map,{info(){},warn(){}}),operations=[];
 let position=0;
 for(const op of source){
  if(![OperationKind.COPY,OperationKind.DOWNLOAD].includes(op.kind)||!Number.isSafeInteger(op.start)||!Number.isSafeInteger(op.end)||op.start<0||op.end<=op.start)throw Error('Invalid update operation');
  if(op.kind===OperationKind.DOWNLOAD){
   if(op.start!==position)throw Error('Invalid update download offset');
   let gap=0,index=operations.length-1;
   while(index>=0&&operations[index].kind===OperationKind.COPY){gap+=operations[index].end-operations[index].start;if(gap>RANGE_OVERHEAD)break;index--}
   if(index>=0&&gap<=RANGE_OVERHEAD&&operations[index].kind===OperationKind.DOWNLOAD&&operations[index].end+gap===op.start){
    const start=operations[index].start;operations.splice(index,operations.length-index,{kind:OperationKind.DOWNLOAD,start,end:op.end});
   }else operations.push({...op});
  }else{if(op.end>oldMap.size)throw Error('Invalid update copy offset');operations.push({...op})}
  position+=op.end-op.start;
 }
 if(position!==newMap.size)throw Error('Update plan size mismatch');
 const downloads=operations.filter(op=>op.kind===OperationKind.DOWNLOAD),downloadBytes=downloads.reduce((n,op)=>n+op.end-op.start,0),requests=downloads.length;
 const reason=downloadBytes>=newMap.size*FULL_RATIO?'large-change':requests>MAX_RANGES?'fragmented':downloadBytes+requests*RANGE_OVERHEAD>=newMap.size*FULL_RATIO?'request-overhead':null;
 return{mode:reason?'full':'differential',reason,operations,downloadBytes,requests,fullSize:newMap.size,reusedBytes:newMap.size-downloadBytes};
}
function fullDownloadMessage(reason){return reason==='user-full'?'按你的设置下载完整更新包…':['large-change','fragmented','request-overhead'].includes(reason)?'本次变化较多，完整下载更合适…':reason==='baseline-missing'?'没有可复用的旧安装包，正在完整下载…':reason==='range-unsupported'?'当前网络不支持分段下载，正在改用完整包…':'差量暂不可用，正在改用完整更新包…'}
module.exports={planUpdate,fullDownloadMessage,RANGE_OVERHEAD,MAX_RANGES,FULL_RATIO};
