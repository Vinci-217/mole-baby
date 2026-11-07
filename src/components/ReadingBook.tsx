import {useEffect,useRef} from 'react';
import type {RamForm} from '../original-actions';
import type {PetColor} from '../pet-color';
import {petColorOffsets} from '../pet-color';
import source from '../../public/assets/original/reading-book/source.json';

type BookForm=keyof typeof source.forms;
const cache=new Map<string,Promise<HTMLCanvasElement[]>>();
function sheets(form:BookForm,color:PetColor){
 const key=`${form}:${color}`,found=cache.get(key);if(found)return found;
 const pending=Promise.all(['neutral','mask'].map(layer=>new Promise<HTMLImageElement>((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=reject;image.src=`./assets/original/reading-book/${form}-${layer}.png`;}))).then(([neutral,mask])=>{
  const canvas=document.createElement('canvas');canvas.width=neutral.naturalWidth;canvas.height=neutral.naturalHeight;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});if(!ctx)throw new Error('无法显示原版看书动画');ctx.drawImage(neutral,0,0);
  const pixels=ctx.getImageData(0,0,canvas.width,canvas.height);ctx.clearRect(0,0,canvas.width,canvas.height);ctx.drawImage(mask,0,0);const coverage=ctx.getImageData(0,0,canvas.width,canvas.height).data;
  const offsets=petColorOffsets(color),deltas=[255,204,153].map(base=>offsets.map(v=>Math.max(0,Math.min(255,base+v))-base));
  for(let i=0;i<pixels.data.length;i+=4){if(!pixels.data[i+3])continue;for(let c=0;c<3;c++)pixels.data[i+c]=Math.max(0,Math.min(255,pixels.data[i+c]+deltas[0][c]*coverage[i]/255+deltas[1][c]*coverage[i+1]/255+deltas[2][c]*coverage[i+2]/255));}
  ctx.putImageData(pixels,0,0);return [canvas];
 }).catch(error=>{cache.delete(key);throw error});
 if(cache.size>=8)cache.delete(cache.keys().next().value!);cache.set(key,pending);return pending;
}
/** Original Ebook costume, captured from its running nested SWF timelines.
 * The body, book and crown share the source frame clock; no local page turns. */
export default function ReadingBook({form,color}:{form:Exclude<RamForm,'seed'>;color:PetColor}){
 const ref=useRef<HTMLCanvasElement>(null),spec=source.forms[form];
 const width=Math.min(100,108*.92*spec.width/spec.height);
 useEffect(()=>{
  let active=true,request=0,last=-1;const media=matchMedia('(prefers-reduced-motion: reduce)'),canvas=ref.current,ctx=canvas?.getContext('2d');if(!canvas||!ctx)return;
  let draw:((now:number)=>void)|undefined;
  const redraw=()=>{cancelAnimationFrame(request);if(active&&!document.hidden&&draw)request=requestAnimationFrame(draw);};
  void sheets(form,color).then(layers=>{if(!active)return;const began=performance.now();draw=now=>{
   if(!active||document.hidden)return;
   const frame=media.matches?0:Math.floor(Math.max(0,now-began)*source.fps/1000)%spec.frames;
   if(frame!==last){ctx.clearRect(0,0,spec.width,spec.height);for(const layer of layers)ctx.drawImage(layer,frame%spec.columns*spec.width,Math.floor(frame/spec.columns)*spec.height,spec.width,spec.height,0,0,spec.width,spec.height);last=frame;canvas.dataset.loaded='true';canvas.dataset.source='1200026';canvas.dataset.sourceFrame=String(frame+1);canvas.dataset.loadedColor=color;}
   if(!media.matches)request=requestAnimationFrame(draw!);
  };redraw();}).catch(()=>{if(active)canvas.dataset.failed='true';});
  document.addEventListener('visibilitychange',redraw);media.addEventListener('change',redraw);
  return()=>{active=false;cancelAnimationFrame(request);document.removeEventListener('visibilitychange',redraw);media.removeEventListener('change',redraw);};
 },[form,color,spec]);
 return <canvas ref={ref} width={spec.width} height={spec.height} className="reading-book" aria-hidden="true" data-form={form} data-source-frames={spec.frames} style={{left:`${(100-width)/2}%`,bottom:'8%',width:`${width}%`}}/>;
}
