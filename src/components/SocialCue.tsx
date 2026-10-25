import type { Evolution, Stage } from '../game';
import { isSocialAction, sampleSocialMotion } from '../social-motion';

export function paintSocialCue(canvas: HTMLCanvasElement, stage: Stage, action: string, elapsed: number, reduced: boolean, evolution?: Evolution) {
  const root=canvas.closest<HTMLElement>('.ram-sprite'); if(!root||!isSocialAction(action)) return;
  const pose=sampleSocialMotion(stage,action,elapsed,reduced,evolution);
  const values={opacity:String(pose.opacity),angle:`${pose.bodyAngle}deg`,lift:`${pose.bodyY}%`,x:`${pose.bodyX}%`,scaleX:String(pose.bodyScaleX),scaleY:String(pose.bodyScaleY),contact:String(pose.contact),affection:String(pose.affection),heartY:`${pose.heartY}%`,bx:`${pose.ballX}%`,by:`${pose.ballY}%`,spin:`${pose.ballAngle}deg`,hx:`${pose.handX}%`,hy:`${pose.handY}%`,handwidth:`${pose.handWidth}%`,bookx:`${pose.bookX}%`,booky:`${pose.bookY}%`,page:`${pose.page}deg`,pageOpacity:String(pose.pageOpacity),readTilt:`${pose.readTilt}deg`};
  for(const [key,value] of Object.entries(values)) root.style.setProperty(`--social-${key}`,value);
  for(const [key,value] of Object.entries({x:`${pose.butterflyX}%`,y:`${pose.butterflyY}%`,angle:`${pose.butterflyAngle}deg`,wing:String(pose.butterflyWing)}))root.style.setProperty(`--butterfly-${key}`,value);
  for(const [key,value] of Object.entries({x:`${pose.netX}%`,y:`${pose.netY}%`,angle:`${pose.netAngle}deg`,width:`${pose.netWidth}%`}))root.style.setProperty(`--net-${key}`,value);
  root.querySelectorAll<HTMLElement>('.social-dizzy-stars>i').forEach((star,i)=>{
    const p=pose.orbit[i];star.style.left=`${p.x}%`;star.style.top=`${p.y}%`;star.style.opacity=String(p.opacity);star.style.transform=`translate(-50%,-50%) scale(${p.scale}) rotate(${p.angle}deg)`;
  });
}
export default function SocialCue({action,originalFootball=false}:{action:string;originalFootball?:boolean}) {
  if(!isSocialAction(action)||originalFootball) return null;
  return <span className={`ram-social social-${action}`} data-social-action={action} aria-hidden="true">
    {action==='play'&&<><img className="social-ball" src="./assets/original/items/180004.png" alt="" draggable={false}/><span className="social-ball-contact"><img src="./assets/generated/v12-dizzy-star.png" alt="" draggable={false}/></span></>}
    {action==='pet'&&<><img className="social-hand" src="./assets/generated/v9-petting-hand.png" alt="" draggable={false}/><img className="social-affection" src="./assets/original/ui/icon-happy.png" alt="" draggable={false}/></>}
    {action==='watch-butterfly'&&<><span className="social-butterfly-net care-prop-sheet"/><span className="social-butterfly"><img src="./assets/generated/v15-butterfly.png" alt="" draggable={false}/></span></>}
    {action==='focus'&&<span className="social-book"><img src="./assets/generated/v9-study-book.png" alt="" draggable={false}/><span className="social-book-page"><img src="./assets/generated/v12-turning-page.png" alt="" draggable={false}/></span></span>}
    {action==='dizzy'&&<span className="social-dizzy-stars">{[0,1,2].map(i=><i key={i}><img src="./assets/generated/v12-dizzy-star.png" alt="" draggable={false}/></i>)}</span>}
  </span>;
}
