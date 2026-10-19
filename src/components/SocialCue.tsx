import type { Evolution, Stage } from '../game';
import { isSocialAction, sampleSocialMotion } from '../social-motion';

export function paintSocialCue(canvas: HTMLCanvasElement, stage: Stage, action: string, elapsed: number, reduced: boolean, evolution?: Evolution) {
  const root=canvas.closest<HTMLElement>('.ram-sprite'); if(!root||!isSocialAction(action)) return;
  const pose=sampleSocialMotion(stage,action,elapsed,reduced,evolution);
  const values={opacity:String(pose.opacity),angle:`${pose.bodyAngle}deg`,lift:`${pose.bodyY}%`,bx:`${pose.ballX}%`,by:`${pose.ballY}%`,spin:`${pose.ballAngle}deg`,hx:`${pose.handX}%`,hy:`${pose.handY}%`,handwidth:`${pose.handWidth}%`,bookx:`${pose.bookX}%`,booky:`${pose.bookY}%`,page:`${pose.page}deg`,pageOpacity:String(pose.pageOpacity),readTilt:`${pose.readTilt}deg`};
  for(const [key,value] of Object.entries(values)) root.style.setProperty(`--social-${key}`,value);
  root.querySelectorAll<HTMLElement>('.social-dizzy-stars>i').forEach((star,i)=>{
    const p=pose.orbit[i];star.style.left=`${p.x}%`;star.style.top=`${p.y}%`;star.style.opacity=String(p.opacity);star.style.transform=`translate(-50%,-50%) scale(${p.scale}) rotate(${p.angle}deg)`;
  });
}
export default function SocialCue({action}:{action:string}) {
  if(!isSocialAction(action)) return null;
  return <span className={`ram-social social-${action}`} data-social-action={action} aria-hidden="true">
    {action==='play'&&<img className="social-ball" src="./assets/original/items/180004.png" alt="" draggable={false}/>}
    {action==='pet'&&<img className="social-hand" src="./assets/generated/v9-petting-hand.png" alt="" draggable={false}/>}
    {action==='focus'&&<span className="social-book"><img src="./assets/generated/v9-study-book.png" alt="" draggable={false}/><span className="social-book-page"><img src="./assets/generated/v12-turning-page.png" alt="" draggable={false}/></span></span>}
    {action==='dizzy'&&<span className="social-dizzy-stars">{[0,1,2].map(i=><i key={i}><img src="./assets/generated/v12-dizzy-star.png" alt="" draggable={false}/></i>)}</span>}
  </span>;
}
