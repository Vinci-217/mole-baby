/** Source coverage locates the actual body, including squash/jump poses. */
export interface WearAnchor {x:number;y:number;bodyWidth:number;bodyHeight:number;angle:number}
/** Translate an original hand-held drawing beside the current body pose. */
export function bodySideAccessoryOffset(anchor:WearAnchor,box:readonly number[],origin:readonly number[]){
  return {x:anchor.x+anchor.bodyWidth*.48-((box[0]+box[2])/2-origin[0]),y:anchor.y+anchor.bodyHeight*.68-((box[1]+box[3])/2-origin[1])}
}
/** The original side wing timeline can travel away from its replacement body.
 * Mount the original drawing on this body's back; preserve its size and shape.
 * Its uppermost ink is the halo, which stays above the face in every view. */
export function backAccessoryOffset(anchor:WearAnchor,box:readonly number[],origin:readonly number[],facing=0){
  return {x:anchor.x-facing*anchor.bodyWidth*.38-((box[0]+box[2])/2-origin[0]),y:anchor.y-anchor.bodyHeight*.36-(box[1]-origin[1])}
}
/** Mount a rigid original directional headpiece without inheriting a source
 * replacement-body jump. The body's own squash/hop remains untouched. */
export function headAccessoryOffset(anchor:WearAnchor,box:readonly number[],origin:readonly number[],id:string){
  const bottom:Record<string,number>={'wizard-cap':.13,'gold-feather':-.02,'warm-scarf':.4,'flower-crown':.12,'leaf-hood':.34,'sport-goggles':.32}
  return {x:anchor.x+(id==='gold-feather'?anchor.bodyWidth*.28:0)-((box[0]+box[2])/2-origin[0]),y:anchor.y+anchor.bodyHeight*(bottom[id]??0)-(box[3]-origin[1])}
}
export function bodyWearAnchor(mask:Uint8ClampedArray,_neutral:Uint8ClampedArray,atlasWidth:number,sx:number,sy:number,width:number,height:number,seed=false):WearAnchor|null {
  let left=width,right=0,top=height,bottom=0
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const i=((sy+y)*atlasWidth+sx+x)*4
    if(mask[i]+mask[i+1]+mask[i+2]>90&&mask[i+3]>120){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y)}
  }
  if(left>right||top>bottom)return null
  const cx=(left+right)/2,bw=right-left+1,bh=bottom-top+1
  // Legacy headwear uses the head boundary. White footballs, teeth and blinking
  // eyes must never rotate a hat or pull it down into the face.
  return {x:cx,y:top-bh*(seed?.06:.025),bodyWidth:bw,bodyHeight:bh,angle:0}
}
