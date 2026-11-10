import clips from '../public/assets/original/element-skills/clips.json';
import visibility from '../electron/edge-visibility.json';
import type {RamForm} from './original-actions';

export const originalElementClip=(id:string)=>clips[id as keyof typeof clips];
/** Coordinates in the shared 100×108 character space, independent of host. */
export function elementEffectRect(id:string,form:RamForm){
 const clip=originalElementClip(id);if(!clip)return null;
 const r=clip.registration;
 // The source timeline already records one calibrated atlas-to-CSS scale for
 // the complete effect. Re-scaling it from the current body's width magnifies
 // large fire/water/wood canvases a second time and breaks their fixed body
 // registration. The form is retained in the signature for callers and the
 // visibility profile continues to provide the body origin.
 const body=visibility.forms[form].body;
 const k=r.cssPixelsPerAtlasPixel;
 return {x:50-r.centerX*k,y:body[3]-r.baseY*k,width:clip.width*k,height:clip.height*k};
}
export function elementDecodedBytes(id:string){
 const clip=originalElementClip(id);if(!clip)return 0;
 return clip.pages.reduce((sum,_,page)=>{
  const frames=clip.rectangles.filter(r=>r[0]===page);
  return sum+Math.max(...frames.map(r=>r[1]+r[3]+1))*Math.max(...frames.map(r=>r[2]+r[4]+1))*4;
 },0);
}
