/** Source coverage locates the actual body, including squash/jump poses. */
export interface WearAnchor {x:number;y:number;bodyWidth:number;bodyHeight:number;angle:number}
export function bodyWearAnchor(mask:Uint8ClampedArray,neutral:Uint8ClampedArray,atlasWidth:number,sx:number,sy:number,width:number,height:number,seed=false):WearAnchor|null {
  let left=width,right=0,top=height,bottom=0
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const i=((sy+y)*atlasWidth+sx+x)*4
    if(mask[i]+mask[i+1]+mask[i+2]>90&&mask[i+3]>120){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y)}
  }
  if(left>right||top>bottom)return null
  const cx=(left+right)/2,bw=right-left+1,bh=bottom-top+1
  const eyes=[{x:0,y:0,n:0},{x:0,y:0,n:0}]
  for(let y=Math.max(0,top-10);y<Math.min(height,top+bh*.72);y++)for(let x=left;x<=right;x++){
    const i=((sy+y)*atlasWidth+sx+x)*4
    if(neutral[i]>240&&neutral[i+1]>240&&neutral[i+2]>240&&neutral[i+3]>220&&mask[i]+mask[i+1]+mask[i+2]<30){const e=eyes[x<cx?0:1];e.x+=x;e.y+=y;e.n++}
  }
  const angle=eyes.every(e=>e.n>8)?Math.atan2(eyes[1].y/eyes[1].n-eyes[0].y/eyes[0].n,eyes[1].x/eyes[1].n-eyes[0].x/eyes[0].n)*180/Math.PI:0
  return {x:cx,y:top+bh*(seed?-.10:.15),bodyWidth:bw,bodyHeight:bh,angle:Math.max(-40,Math.min(40,angle))}
}
