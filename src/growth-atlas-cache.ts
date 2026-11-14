import {loadOutfitPreview,rememberOutfitPreview} from './outfit-preview-cache';
import {version} from '../package.json';

const kinds=new Set(['seed','classic','grounded','flight']);
/** Only lossless, fully recoloured base atlases are persisted. Transient
 * effects never displace every stage's resting appearance from this cache. */
export function growthAtlasKey(form:string,color:string,kind:string,width:number,height:number){
 return kinds.has(kind)?`growth-atlas:v1:${version}:${kind}:${form}:${color}:${width}x${height}`:undefined;
}
export async function loadGrowthAtlas(key:string|undefined,width:number,height:number):Promise<HTMLCanvasElement|undefined>{
 if(!key)return;
 const data=await loadOutfitPreview(key);if(!data)return;
 try{
  const image=await new Promise<HTMLImageElement>((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=reject;image.src=data});
  if(image.naturalWidth!==width||image.naturalHeight!==height)return;
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
  const ctx=canvas.getContext('2d');if(!ctx)return;ctx.drawImage(image,0,0);return canvas;
 }catch{/* Optional cache corruption never prevents rebuilding the real source. */}
}
export function rememberGrowthAtlas(key:string|undefined,canvas:HTMLCanvasElement){
 if(!key)return;
 const capture=()=>{try{rememberOutfitPreview(key,canvas.toDataURL('image/png'))}catch{/* Quota/encoding failures do not affect animation or saves. */}};
 // Encode after the first paint; never block the first visible body on PNG IO.
 if('requestIdleCallback'in window)window.requestIdleCallback(capture,{timeout:2000});else setTimeout(capture,50);
}
