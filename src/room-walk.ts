import {roomPetMaxScale, roomPetScale} from './room-pet-size'

export interface RoomPoint {x:number;y:number}
export interface RoomWalkArea {width:number;height:number;left:number;right:number;top:number;bottom:number}
const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n))
const WALK_STRIP_HEIGHT=44
const ART_MARGIN=4
const CAPTION_CLEARANCE=37
/** Pixel coordinates, shared by pointer targets, keyboard and resize handling.
 * Keep the complete 150px pet clear of walls, screen edges and the room dock. */
export function roomWalkArea(width:number,height:number,dockTop=height-145,petScale=1,captionClearance=CAPTION_CLEARANCE):RoomWalkArea {
 // Keep all travel on the middle/lower floor, below the wall decorations.
 const inset=Math.min(width/2,Math.max(Math.min(42,Math.max(18,width*.035)),75*petScale+16)),left=inset,right=Math.max(left,width-inset)
 const bottom=clamp(dockTop-captionClearance,24,height-12),top=Math.min(height*.55,Math.max(0,bottom-WALK_STRIP_HEIGHT))
 return {width,height,left,right,top,bottom}
}

/** Reserve the complete movement silhouette before drawing any pose. Both
 * idle and walking use the same room scale, including in a short window. */
export function roomWalkLayout(width:number,height:number,dockTop=height-145,requestedScale:number,headroom=0) {
 const captionClearance=Math.min(CAPTION_CLEARANCE,Math.max(18,dockTop-Math.ceil(.5*headroom)-ART_MARGIN-WALK_STRIP_HEIGHT))
 const floor=roomWalkArea(width,height,dockTop,1,captionClearance)
 const heightLimit=headroom>0?Math.max(.5,Math.floor((floor.bottom-WALK_STRIP_HEIGHT-ART_MARGIN)/headroom*100)/100):Infinity
 const maxScale=Math.min(roomPetMaxScale(width),heightLimit)
 const scale=Math.min(roomPetScale(requestedScale),maxScale)
 const area=roomWalkArea(width,height,dockTop,scale,captionClearance)
 if(headroom>0)area.top=Math.max(area.top,Math.min(area.bottom-1,Math.ceil(scale*headroom)+ART_MARGIN))
 return {area,scale,maxScale}
}
/**
 * The image contains a wall and furniture above the walkable floor. Keep the
 * pointer, autonomous and keyboard movement use the same floor boundary.
 */
export function roomWalkClickTop(area:RoomWalkArea):number {
 return area.top
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
