const FRAME={left:25,top:65,width:110,height:120};
const CORNERS=new Set(['nw','ne','sw','se']);
function resizeScale(scale,corner,dx,dy){
 if(!CORNERS.has(corner)||![scale,dx,dy].every(Number.isFinite))throw new TypeError('Invalid pet resize');
 const x=corner.includes('e')?FRAME.width:-FRAME.width,y=corner.includes('s')?FRAME.height:-FRAME.height;
 return Math.max(.5,Math.min(3,scale+(dx*x+dy*y)/(x*x+y*y)));
}
function resizeAnchor(bounds,scale,corner){
 if(!CORNERS.has(corner))throw new TypeError('Invalid pet corner');
 const local={x:corner.includes('e')?FRAME.left:FRAME.left+FRAME.width,y:corner.includes('s')?FRAME.top:FRAME.top+FRAME.height};
 return {x:bounds.x+local.x*scale,y:bounds.y+local.y*scale,local};
}
function anchoredPetBounds(anchor,scale,size){return {x:Math.round(anchor.x-anchor.local.x*scale),y:Math.round(anchor.y-anchor.local.y*scale),width:size.width,height:size.height}}
module.exports={FRAME,resizeScale,resizeAnchor,anchoredPetBounds};
