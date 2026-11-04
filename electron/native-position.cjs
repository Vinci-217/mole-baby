// Electron converts positions to signed native integers. Reject invalid timer,
// restored-monitor or clock data before crossing that boundary.
function nativePosition(target){
 if(!target||![target.x,target.y].every(n=>typeof n==='number'&&Number.isFinite(n)&&Math.abs(n)<0x40000000))return null;
 return {x:Math.round(target.x)||0,y:Math.round(target.y)||0};
}
function movementProgress(startedAt,duration,now=Date.now()){
 if(![startedAt,duration,now].every(Number.isFinite)||duration<=0)return null;
 if(now<startedAt)return null; // Clock correction after sleep: start a fresh walk.
 return Math.max(0,Math.min(1,(now-startedAt)/duration));
}
module.exports={nativePosition,movementProgress};
