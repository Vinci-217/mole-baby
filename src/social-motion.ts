import type { Evolution, Stage } from './game';
export type SocialAction = 'pet' | 'play' | 'focus' | 'dizzy';
export const SOCIAL_DURATIONS = { pet: 2400, play: 4200, dizzy: 3200 } as const;
const profiles = [
  { head: 20, contactX: 88, contact: 48, bookX: 76, bookY: 87, sway: 4, lift: 0, phase: .1 },
  { head: 30, contactX: 100, contact: 58, bookX: 50, bookY: 83, sway: 2, lift: 3, phase: .3 },
  { head: 17, contactX: 95, contact: 69, bookX: 50, bookY: 88, sway: 4, lift: 1.5, phase: .5 },
  { head: 22, contactX: 87, contact: 81, bookX: 49, bookY: 94, sway: 2.5, lift: .7, phase: .7 },
  { head: 18, contactX: 94, contact: 75, bookX: 49, bookY: 93, sway: 3, lift: 1, phase: .9 },
] as const;
export function isSocialAction(action: string): action is SocialAction { return ['pet','play','focus','dizzy'].includes(action); }
/** One event clock drives prop contact and the pet reaction. Stage 0 never
 * lifts the pot; its transform is applied to the independently layered body. */
export function sampleSocialMotion(stage: Stage, action: SocialAction, elapsed: number, reduced = false, evolution?: Evolution) {
  const p=profiles[stage], duration=action==='focus'?Infinity:SOCIAL_DURATIONS[action];
  const ended=elapsed>=duration;
  const time=reduced?0:Math.max(0,elapsed);
  const progress=action==='focus'?(time%8000)/8000:Math.min(1,time/duration);
  const enter=action==='focus'?1:Math.min(1,progress*7,(1-progress)*7);
  const rhythm=Math.sin(progress*Math.PI*(stage===0?4:stage===1?6:stage===2?4:8));
  const contact=action==='play'?Math.max(0,1-Math.abs((progress*2%1)-.5)*7):0;
  const formFactor=evolution==='water'?.65:evolution==='fire'?1.3:evolution==='wood'?.85:1;
  const contactX=stage===4 ? evolution==='super'?82:evolution==='wood'?87:evolution==='water'?92:94 : p.contactX;
  return {
    finished:ended, opacity:ended?0:reduced?1:Math.max(0,enter),
    bodyAngle:reduced?0:action==='dizzy'?Math.sin(time/125)*p.sway:action==='play'?rhythm*p.sway*contact*formFactor:action==='pet'?rhythm*p.sway*.35:Math.sin(time/1300)*.5,
    bodyY:reduced||stage===0?0:action==='play'?-contact*p.lift:action==='pet'?Math.max(0,rhythm)*.7:0,
    ballX:reduced?contactX:115-Math.sin(progress*Math.PI*2)**2*(115-contactX),
    ballY:reduced?p.contact:p.contact-Math.abs(Math.sin(progress*Math.PI*4))*(stage===0?9:stage===1?20:stage===2?14:10)*formFactor,
    ballAngle:time/(stage===0?22:12),
    handX:reduced?62:62+Math.sin(progress*Math.PI*(stage===0?4:6))*(stage===0?5:9)+(1-enter)*27,
    handY:p.head-(1-enter)*17+(reduced?0:Math.abs(rhythm)*1.5),
    bookX:p.bookX, bookY:p.bookY,
    page:reduced?1:Math.cos(Math.max(0,(progress-.65)/.15)*Math.PI),
    stars:time/12,
  };
}
