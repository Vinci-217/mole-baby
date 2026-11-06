import {useEffect,useRef} from 'react';
import type {RamForm} from '../original-actions';
import visibility from '../../electron/edge-visibility.json';
import {readingMotion} from '../reading-motion';
import {createPetSoundClock} from '../pet-audio';
import {socialSoundScore} from '../pet-sound-score';

/** The existing open-book raster stays still. Only one paper leaf turns about
 * the spine. This is a local adaptation, not a recovered official read clip. */
export default function ReadingBook({form,sound}:{form:RamForm;sound:boolean}){
 const ref=useRef<HTMLCanvasElement>(null),voice=useRef(sound);voice.current=sound;
 const width=form==='seed'?42:form==='junior'?44:48,height=width*2/3,bottom=visibility.forms[form].body[3];
 useEffect(()=>{
  const canvas=ref.current,ctx=canvas?.getContext('2d');if(!canvas||!ctx)return;
  let active=true,request=0,last=-1;const began=performance.now(),media=matchMedia('(prefers-reduced-motion: reduce)'),book=new Image(),audio=createPetSoundClock(socialSoundScore('focus'),()=>voice.current);
  function draw(now:number){
   if(!active||document.hidden)return;
   const elapsed=now-began,frame=Math.floor(elapsed*24/1000),motion=readingMotion(elapsed,media.matches);
   if(frame!==last||media.matches){
    ctx!.clearRect(0,0,384,256);ctx!.save();ctx!.scale(.25,.25);ctx!.drawImage(book,0,0,1536,1024);
    if(motion.turning){
     const spine=768,edge=spine+500*motion.fold,lift=motion.lift*75;
     ctx!.globalAlpha=motion.opacity;ctx!.beginPath();ctx!.moveTo(spine,272);
     ctx!.bezierCurveTo(spine+(edge-spine)*.35,205-lift,edge-22*motion.fold,142-lift,edge,150-lift*.7);
     ctx!.lineTo(edge+60*motion.fold,594-lift*.35);
     ctx!.bezierCurveTo(spine+(edge-spine)*.75,590-lift*.3,spine+(edge-spine)*.25,660,spine,720);ctx!.closePath();
     const gradient=ctx!.createLinearGradient(spine,0,edge||spine+1,0);gradient.addColorStop(0,'#ead5a4');gradient.addColorStop(.15,'#fff8d8');gradient.addColorStop(1,motion.progress<.5?'#fffbe8':'#f6edce');ctx!.fillStyle=gradient;ctx!.fill();ctx!.strokeStyle='#cfa873';ctx!.lineWidth=8;ctx!.stroke();
     if(Math.abs(motion.fold)>.15){ctx!.strokeStyle='#cfa76c';ctx!.lineCap='round';ctx!.lineWidth=12;for(const y of [370,470]){ctx!.beginPath();ctx!.moveTo(spine+85*motion.fold,y);ctx!.quadraticCurveTo(spine+245*motion.fold,y-45-lift*.4,spine+390*motion.fold,y-50-lift*.5);ctx!.stroke()}}
    }
    ctx!.restore();canvas!.dataset.loaded='true';canvas!.dataset.pagePhase=motion.turning?'turning':'reading';canvas!.dataset.pageProgress=String(motion.progress);last=frame;
   }
   if(!media.matches)audio.tick(elapsed);
   if(!media.matches)request=requestAnimationFrame(draw);
  }
  const redraw=()=>{cancelAnimationFrame(request);if(!document.hidden)request=requestAnimationFrame(draw)};
  book.src='./assets/generated/v9-study-book.png';void book.decode().then(()=>{if(active)redraw()}).catch(()=>{});
  document.addEventListener('visibilitychange',redraw);media.addEventListener('change',redraw);
  return()=>{active=false;cancelAnimationFrame(request);document.removeEventListener('visibilitychange',redraw);media.removeEventListener('change',redraw);audio.stop()};
 },[form]);
 // Lower the book into the hands/body area. The old top edge sat above the
 // head and read visually like a phone under a tree; this keeps the same
 // proportion while making the reading pose clear.
 const handDrop=form==='seed'?11:16
 return <canvas ref={ref} width={384} height={256} className="reading-book" aria-hidden="true" style={{left:`${form==='seed'?58:50-width/2}%`,top:`${(bottom+2-height*.85+handDrop)/108*100}%`,width:`${width}%`}}/>;
}
