/** Source coverage locates the actual body, including squash/jump poses. */
export interface WearAnchor {x:number;y:number;bodyWidth:number;bodyHeight:number;angle:number;topContour?:readonly (number|null)[]}
export interface WearPlacement {left:number;top:number;scaleX:number;scaleY:number}
export const CONTACT_HEADWEAR=new Set(['party-cap','gold-feather','wizard-cap','warm-scarf','flower-crown','leaf-hood','sport-goggles'])
/** Bottom ink per column, rather than the lowest corner of a sloping brim. */
export function garmentBottomContour(pixels:Uint8ClampedArray,width:number,height:number):readonly (number|null)[]{
  const result:(number|null)[]=Array(width).fill(null)
  for(let x=0;x<width;x++)for(let y=height-1;y>=0;y--)if(pixels[(y*width+x)*4+3]>120){result[x]=y;break}
  return result
}
/** Measure contact across the head, excluding the far ends of a brim. A
 * median prevents a dangling ear or one flower petal from becoming the seam. */
export function headwearSurfaceGap(anchor:WearAnchor,bottom:readonly (number|null)[],placement:WearPlacement):number|null {
  if(!anchor.topContour)return null
  const gaps:number[]=[],left=anchor.x-anchor.bodyWidth*.35,right=anchor.x+anchor.bodyWidth*.35
  for(let x=Math.ceil(left);x<=Math.floor(right);x++){
    const top=anchor.topContour[x],column=Math.round((x-placement.left)/placement.scaleX),ink=bottom[column]
    if(top==null||ink==null)continue
    gaps.push(top-(placement.top+ink*placement.scaleY))
  }
  if(!gaps.length)return null
  gaps.sort((a,b)=>a-b)
  return gaps[Math.floor(gaps.length/2)]
}
/** Small overlap closes anti-aliased seams; only translate the original art. */
export function headwearContactOffset(anchor:WearAnchor,bottom:readonly (number|null)[],placement:WearPlacement):number {
  const gap=headwearSurfaceGap(anchor,bottom,placement)
  return gap===null?0:gap+Math.max(2,anchor.bodyHeight*.035)
}
/** Preserve a borrowed garment's proportions and its registration to the
 * original body's centre/floor, using the current body's actual width. */
export function borrowedBodyPlacement(anchor:WearAnchor,reference:readonly number[],placement:WearPlacement):WearPlacement {
  const scale=anchor.bodyWidth/(reference[2]-reference[0]+1),center=(reference[0]+reference[2])/2
  const bottom=anchor.y+anchor.bodyHeight*.025+anchor.bodyHeight-1
  return {left:anchor.x+(placement.left-center)*scale,top:bottom+(placement.top-reference[3])*scale,scaleX:placement.scaleX*scale,scaleY:placement.scaleY*scale}
}
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
  const topContour:(number|null)[]=Array(width).fill(null)
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const i=((sy+y)*atlasWidth+sx+x)*4
    if(mask[i]+mask[i+1]+mask[i+2]>90&&mask[i+3]>120){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);if(topContour[x]===null)topContour[x]=y}
  }
  if(left>right||top>bottom)return null
  const cx=(left+right)/2,bw=right-left+1,bh=bottom-top+1
  // Legacy headwear uses the head boundary. White footballs, teeth and blinking
  // eyes must never rotate a hat or pull it down into the face.
  return {x:cx,y:top-bh*(seed?.06:.025),bodyWidth:bw,bodyHeight:bh,angle:0,topContour}
}
