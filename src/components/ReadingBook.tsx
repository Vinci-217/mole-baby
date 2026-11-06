import {useEffect,useRef} from 'react';
import type {RamForm} from '../original-actions';
import {readingMotion} from '../reading-motion';
import {createPetSoundClock} from '../pet-audio';
import {socialSoundScore} from '../pet-sound-score';
import source from '../../public/assets/original/reading-book/source.json';

/** Original purple-book artwork. The open/hold/turn/close sequence is a local
 * reading adaptation; the original costume SWF is not a full read action. */
export default function ReadingBook({form,sound,duration}:{form:RamForm;sound:boolean;duration?:number}){
 const ref=useRef<HTMLCanvasElement>(null),voice=useRef(sound);voice.current=sound;
 const width=form==='seed'?50:100;
 useEffect(()=>{
  const canvas=ref.current,ctx=canvas?.getContext('2d');if(!canvas||!ctx)return;
  let active=true,request=0,last=-1;const began=performance.now(),media=matchMedia('(prefers-reduced-motion: reduce)'),book=new Image(),audio=createPetSoundClock(socialSoundScore('focus'),()=>voice.current);
  function draw(now:number){
   if(!active||document.hidden)return;
   const elapsed=now-began,frame=Math.floor(elapsed*24/1000),motion=readingMotion(elapsed,media.matches);
   if(frame!==last||media.matches){
    const w=source.width,h=source.height,cx=w/2;
    const opening=media.matches?1:Math.min(1,elapsed/650),closing=media.matches||!duration?1:Math.min(1,Math.max(0,(duration-elapsed)/650));
    const spread=Math.sin(Math.min(opening,closing)*Math.PI/2);
    ctx!.clearRect(0,0,w,h+32);ctx!.save();ctx!.translate(cx,32);ctx!.scale(Math.max(.035,spread),1);ctx!.translate(-cx,0);
    // Use a stable original spread for reading. The source's 15-frame flex
    // belongs to its walking costume; running it continuously looks like a
    // bouncing book. Page turns sample its real page shapes instead.
    const originalFrame=motion.turning?Math.min(14,Math.floor(motion.progress*14)):0;
    const sx=originalFrame%source.columns*w,sy=Math.floor(originalFrame/source.columns)*h;
    ctx!.drawImage(book,sx,sy,w,h,0,0,w,h);
    if(motion.turning){
     // Turn a texture from the original paper about its spine. Small strips
     // describe the curve without stretching/rotating the character itself.
     ctx!.globalAlpha=motion.opacity;
     for(let i=0;i<48;i++){
      const u=i/48,next=(i+1)/48,fold=motion.fold,x=cx+u*cx*fold,nx=cx+next*cx*fold;
      const lift=Math.sin(u*Math.PI)*motion.lift*24;
      const paperX=motion.progress<.5?cx+u*cx:cx-next*cx;
      ctx!.drawImage(book,paperX,0,cx/48+1,h*.83,Math.min(x,nx),-lift,Math.max(1,Math.abs(nx-x)+.5),h*.83);
     }
    }
    ctx!.restore();canvas!.dataset.loaded='true';canvas!.dataset.source='1200026:13';canvas!.dataset.pagePhase=opening<1?'opening':closing<1?'closing':motion.turning?'turning':'reading';canvas!.dataset.pageProgress=String(motion.progress);last=frame;
   }
   if(!media.matches)audio.tick(elapsed);
   if(!media.matches)request=requestAnimationFrame(draw);
  }
  const redraw=()=>{cancelAnimationFrame(request);if(!document.hidden)request=requestAnimationFrame(draw)};
  book.src='./assets/original/reading-book/pages.png';void book.decode().then(()=>{if(active)redraw()}).catch(()=>{});
  document.addEventListener('visibilitychange',redraw);media.addEventListener('change',redraw);
  return()=>{active=false;cancelAnimationFrame(request);document.removeEventListener('visibilitychange',redraw);media.removeEventListener('change',redraw);audio.stop()};
 },[form,duration]);
 return <canvas ref={ref} width={source.width} height={source.height+32} className="reading-book" aria-hidden="true" style={{left:`${form==='seed'?46:50-width/2}%`,top:`${((form==='seed'?82:63)-32*width/source.width)/108*100}%`,width:`${width}%`}}/>;
}
