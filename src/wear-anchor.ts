/** Source coverage locates the actual body, including squash/jump poses. */
export interface WearAnchor {x:number;y:number;bodyWidth:number;bodyHeight:number;angle:number}
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
