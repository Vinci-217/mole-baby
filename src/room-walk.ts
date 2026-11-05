export interface RoomPoint {x:number;y:number}
export interface RoomWalkArea {width:number;height:number;left:number;right:number;top:number;bottom:number}
const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n))
/** Pixel coordinates, shared by pointer targets, keyboard and resize handling.
 * Keep the complete 150px pet clear of walls, screen edges and the room dock. */
export function roomWalkArea(width:number,height:number,dockTop=height-145):RoomWalkArea {
 // The whole interior map is walkable. Only a small body-radius inset and the
 // fixed bottom dock are excluded, so random and manual movement can reach
 // the walls, corners and upper parts of the room as well as the floor.
 const inset=Math.min(42,Math.max(18,width*.035)),left=inset,right=Math.max(left,width-inset)
 // Leave the title/header overlay above the room surface; the remaining map
 // from this line down to the dock is fully reachable.
 const top=Math.min(140,Math.max(70,height*.17)),bottom=clamp(dockTop-18,top+44,height-12)
 return {width,height,left,right,top,bottom}
}
/**
 * The image contains a wall and furniture above the walkable floor. Keep the
 * pointer surface on the floor while the movement area remains larger for
 * autonomous travel and keyboard navigation.
 */
export function roomWalkClickTop(area:RoomWalkArea):number {
 const minimumHeight=44
 return Math.max(area.top,Math.min(area.height*.34,area.bottom-minimumHeight))
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
