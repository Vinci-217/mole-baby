export interface RoomPoint {x:number;y:number}
export interface RoomWalkArea {width:number;height:number;left:number;right:number;top:number;bottom:number}
const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n))
/** Pixel coordinates, shared by pointer targets, keyboard and resize handling.
 * Keep the complete 150px pet clear of walls, screen edges and the room dock. */
export function roomWalkArea(width:number,height:number,dockTop=height-145):RoomWalkArea {
 const left=Math.min(90,width/2),bottom=clamp(Math.min(height*.82,dockTop-76),0,height)
 return {width,height,left,right:Math.max(left,width-left),top:Math.min(bottom,Math.max(190,height*.52)),bottom}
}
export function roomWalkTarget(point:RoomPoint,area:RoomWalkArea):RoomPoint {
 return {x:clamp(point.x,area.left,area.right),y:clamp(point.y,area.top,area.bottom)}
}
/** Constant travel speed, normalized diagonal movement, no overshoot after a
 * slow frame. Suspension pauses travel instead of teleporting on return. */
export function stepRoomWalk(from:RoomPoint,to:RoomPoint,deltaMs:number,speed=125) {
 const dx=to.x-from.x,dy=to.y-from.y,distance=Math.hypot(dx,dy),step=Math.min(100,Math.max(0,deltaMs))*speed/1000
 if(distance<=Math.max(.25,step))return {point:to,finished:true}
 const mix=step/distance
 return {point:{x:from.x+dx*mix,y:from.y+dy*mix},finished:false}
}
