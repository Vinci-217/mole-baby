const EDGES=new Set(['n','ne','e','se','s','sw','w','nw']);
const ROOM_MINIMUM={width:800,height:640};
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
function resizedRoomBounds(bounds,edge,dx,dy,area){
 if(!EDGES.has(edge)||![dx,dy].every(Number.isFinite))throw new TypeError('Invalid room resize');
 const minWidth=Math.min(ROOM_MINIMUM.width,area.width),minHeight=Math.min(ROOM_MINIMUM.height,area.height);
 const width=clamp(bounds.width,minWidth,area.width),height=clamp(bounds.height,minHeight,area.height);
 let left=clamp(bounds.x,area.x,area.x+area.width-width),top=clamp(bounds.y,area.y,area.y+area.height-height);
 let right=left+width,bottom=top+height;
 if(edge.includes('e'))right=clamp(right+dx,left+minWidth,area.x+area.width);
 if(edge.includes('w'))left=clamp(left+dx,area.x,right-minWidth);
 if(edge.includes('s'))bottom=clamp(bottom+dy,top+minHeight,area.y+area.height);
 if(edge.includes('n'))top=clamp(top+dy,area.y,bottom-minHeight);
 return{x:Math.round(left),y:Math.round(top),width:Math.round(right-left),height:Math.round(bottom-top)};
}
/** Resize the existing frameless HWND without toggling CanResize/caption bits.
 * Read native DIP cursor coordinates to avoid renderer/monitor DPI drift. */
function createRoomResizer({getWindow,screen,canResize,onResize,onEnd}){
 let drag=null,timer=null;
 function end(){clearInterval(timer);timer=null;if(drag){drag=null;onEnd()}}
 function apply(bounds){getWindow().setBounds(bounds);onResize();return bounds}
 function start(edge){
  if(!EDGES.has(edge))throw new TypeError('Invalid room resize edge');
  end();if(!canResize())return false;
  const bounds=getWindow().getBounds();drag={edge,bounds,cursor:screen.getCursorScreenPoint(),area:screen.getDisplayMatching(bounds).workArea};
  timer=setInterval(()=>{if(!canResize()){end();return}const point=screen.getCursorScreenPoint();apply(resizedRoomBounds(drag.bounds,drag.edge,point.x-drag.cursor.x,point.y-drag.cursor.y,drag.area))},16);
  timer.unref?.();return true;
 }
 function adjust(dx,dy){
  if(![dx,dy].every(n=>Number.isFinite(n)&&Math.abs(n)<=200))throw new TypeError('Invalid room size adjustment');
  end();if(!canResize())return false;
  const bounds=getWindow().getBounds();apply(resizedRoomBounds(bounds,'se',dx,dy,screen.getDisplayMatching(bounds).workArea));onEnd();return true;
 }
 return{start,end,adjust};
}
module.exports={ROOM_MINIMUM,resizedRoomBounds,createRoomResizer};
