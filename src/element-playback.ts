import clips from '../public/assets/original/element-skills/clips.json';
import visibility from '../electron/edge-visibility.json';
import type {RamForm} from './original-actions';

export const originalElementClip=(id:string)=>clips[id as keyof typeof clips];
/** Coordinates in the shared 100×108 character space, independent of host. */
export function elementEffectRect(id:string,form:RamForm){
 const clip=originalElementClip(id);if(!clip)return null;
 const r=clip.registration,k=r.cssPixelsPerAtlasPixel;
 return {x:50-r.centerX*k,y:visibility.forms[form].body[3]-r.baseY*k,width:clip.width*k,height:clip.height*k};
}
export function elementDecodedBytes(id:string){
 const clip=originalElementClip(id);if(!clip)return 0;
 return clip.pages.reduce((sum,_,page)=>{
  const frames=clip.rectangles.filter(r=>r[0]===page);
  return sum+Math.max(...frames.map(r=>r[1]+r[3]+1))*Math.max(...frames.map(r=>r[2]+r[4]+1))*4;
 },0);
}
