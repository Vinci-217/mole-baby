import type { Evolution, Stage } from '../game';
import { isSocialAction, sampleSocialMotion } from '../social-motion';

export function paintSocialCue(canvas: HTMLCanvasElement, stage: Stage, action: string, elapsed: number, reduced: boolean, evolution?: Evolution) {
  const root=canvas.closest<HTMLElement>('.ram-sprite'); if(!root||!isSocialAction(action)) return;
  const pose=sampleSocialMotion(stage,action,elapsed,reduced,evolution);
  const values={opacity:String(pose.opacity),angle:`${pose.bodyAngle}deg`,lift:`${pose.bodyY}%`,bx:`${pose.ballX}%`,by:`${pose.ballY}%`,spin:`${pose.ballAngle}deg`,hx:`${pose.handX}%`,hy:`${pose.handY}%`,bookx:`${pose.bookX}%`,booky:`${pose.bookY}%`,page:String(pose.page),stars:`${pose.stars}deg`};
  for(const [key,value] of Object.entries(values)) root.style.setProperty(`--social-${key}`,value);
}
export default function SocialCue({action}:{action:string}) {
  if(!isSocialAction(action)) return null;
  return <span className={`ram-social social-${action}`} data-social-action={action} aria-hidden="true">
    {action==='play'&&<img className="social-ball" src="./assets/original/items/180004.png" alt="" draggable={false}/>}
    {action==='pet'&&<img className="social-hand" src="./assets/generated/v9-petting-hand.png" alt="" draggable={false}/>}
    {action==='focus'&&<span className="social-book"><img src="./assets/generated/v9-study-book.png" alt="" draggable={false}/><img className="social-book-page" src="./assets/generated/v9-study-book.png" alt="" draggable={false}/></span>}
    {action==='dizzy'&&<span className="social-dizzy-stars"><i>✦</i><i>✦</i><i>✦</i></span>}
  </span>;
}
