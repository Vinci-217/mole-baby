export const ROOM_PET_BASE={width:150,height:163,nameOffset:20} as const;
export function roomPetScale(value:unknown):number{
 return typeof value==='number'&&Number.isFinite(value)?Math.round(Math.max(.5,Math.min(3,value))*100)/100:1;
}
export function roomPetMaxScale(width:number):number{
 return Math.max(.5,Math.min(3,Math.floor((width-32)/ROOM_PET_BASE.width*100)/100));
}
/** Project pointer travel onto one diagonal; both dimensions use one factor. */
export function draggedRoomPetScale(scale:number,dx:number,dy:number,corner:string,max=3):number{
 const x=ROOM_PET_BASE.width*(corner.includes('e')?1:-1),y=ROOM_PET_BASE.height*(corner.includes('s')?1:-1);
 return Math.min(max,roomPetScale(scale+(dx*x+dy*y)/(x*x+y*y)));
}
