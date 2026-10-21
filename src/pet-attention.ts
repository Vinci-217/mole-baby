export interface PetGaze { x:number; y:number }
const clamp=(value:number)=>Number.isFinite(value)?Math.max(-1,Math.min(1,value)):0
/** A local pointer glance, confined to the pet window. No global mouse hook. */
export function pointerGaze(x:number,y:number,box:{left:number;top:number;width:number;height:number}):PetGaze {
 const dx=x-box.left-box.width/2,dy=y-box.top-box.height/2
 return Math.hypot(dx,dy)>170?{x:0,y:0}:{x:clamp(dx/Math.max(40,box.width/2)),y:clamp(dy/Math.max(40,box.height/2))}
}
export function easeGaze(current:PetGaze,target:PetGaze,delta:number):PetGaze {
 const amount=1-Math.exp(-Math.max(0,Math.min(100,Number.isFinite(delta)?delta:0))/150)
 return {x:current.x+(clamp(target.x)-current.x)*amount,y:current.y+(clamp(target.y)-current.y)*amount}
}
