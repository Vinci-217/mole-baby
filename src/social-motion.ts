import type { Evolution, Stage } from './game';
export type SocialAction = 'pet' | 'play' | 'focus' | 'dizzy' | 'watch-butterfly' | 'look-around' | 'wake';
export const SOCIAL_DURATIONS = { pet: 2400, play: 4200, dizzy: 3200, 'watch-butterfly':6500, 'look-around':3600, wake:1800 } as const;
export const BALL_CONTACTS = [1050, 3150] as const;
const smooth = (x:number) => { const t=Math.max(0,Math.min(1,x));return t*t*(3-2*t); };
/** A bell with zero velocity at either end; contact, body and sound share time. */
export function gesturePulse(time:number,centre:number,width:number):number {
  return smooth(1-Math.abs(time-centre)/width);
}
const profiles = [
  { head: 20, contactX: 88, contact: 48, bookX: 76, bookY: 87, sway: 4, lift: 0, phase: .1 },
  { head: 30, contactX: 100, contact: 58, bookX: 50, bookY: 83, sway: 2, lift: 3, phase: .3 },
  { head: 17, contactX: 95, contact: 69, bookX: 50, bookY: 88, sway: 4, lift: 1.5, phase: .5 },
  { head: 22, contactX: 87, contact: 81, bookX: 49, bookY: 94, sway: 2.5, lift: .7, phase: .7 },
  { head: 18, contactX: 94, contact: 75, bookX: 49, bookY: 93, sway: 3, lift: 1, phase: .9 },
] as const;
export function isSocialAction(action: string): action is SocialAction { return ['pet','play','focus','dizzy','watch-butterfly','look-around','wake'].includes(action); }
/** One event clock drives prop contact and the pet reaction. Stage 0 never
 * lifts the pot; its transform is applied to the independently layered body. */
export function sampleSocialMotion(stage: Stage, action: SocialAction, elapsed: number, reduced = false, evolution?: Evolution) {
  const flying=stage>=3;
  const p=profiles[stage], duration=action==='focus'?Infinity:SOCIAL_DURATIONS[action];
  const ended=elapsed>=duration;
  const time=reduced?0:Math.max(0,elapsed);
  const progress=action==='focus'?(time%8000)/8000:Math.min(1,time/duration);
  const enter=action==='focus'?1:Math.min(1,progress*7,(1-progress)*7);
  const contact=action==='play'?Math.max(...BALL_CONTACTS.map(at=>gesturePulse(time,at,210))):0;
  const formFactor=evolution==='water'?.65:evolution==='fire'?1.3:evolution==='wood'?.85:1;
  const contactX=stage===4 ? evolution==='super'?82:evolution==='wood'?87:evolution==='water'?92:94 : p.contactX;
  const readingPhase=(time%8000)/8000;
  const turn=Math.max(0,Math.min(1,(readingPhase-.74)/.2));
  const arrive=smooth(time/480),leave=smooth((2400-time)/430);
  const strokes=arrive*leave;
  const stroke=Math.sin((time-480)/490*Math.PI*2);
  const ready=action==='play'?Math.max(...BALL_CONTACTS.map(at=>gesturePulse(time,at-180,175))):0;
  const follow=action==='play'?Math.max(...BALL_CONTACTS.map(at=>gesturePulse(time,at+160,260))):0;
  const cheer=action==='play'?gesturePulse(time,3800,360):0;
  const wakeStretch=action==='wake'?Math.sin(progress*Math.PI)**2:0;
  const affection=action==='pet'?smooth((time-1750)/180)*smooth((2400-time)/250):0;
  const bodyX=reduced?0:action==='play'?(stage===0?0:(flying?3.2:5.5)*contact-1.2*ready):action==='pet'?(stage===0?0:(stage===4?.8:1.6)*strokes):0;
  const bodyScaleX=reduced?1:action==='pet'?1+strokes*(stage===4?.004:flying?.018:.035):action==='play'?1+ready*.035-contact*.015-follow*.015:1-wakeStretch*.025;
  const bodyScaleY=reduced?1:action==='pet'?1-strokes*(stage===4?.005:flying?.022:.045):action==='play'?1-ready*.055+contact*.035+follow*.02:1+wakeStretch*.04;
  const haloY=stage===0?12:stage===1?18:stage===2?4:stage===3?7:3;
  const orbit=Array.from({length:3},(_,i)=>{
    const phase=time/1250*Math.PI*2+i*Math.PI*2/3,depth=Math.sin(phase);
    return {x:50+Math.cos(phase)*(stage===0?22:stage===1?27:34),y:haloY+depth*3,scale:.8+(depth+1)*.16,opacity:.65+(depth+1)*.175,angle:Math.sin(phase)*16};
  });
  const netPulse=gesturePulse(time,1700,600)-gesturePulse(time,3900,700)*.9
  const netAngle=reduced?12:12+netPulse*43
  const netX=(stage===0?78:82)+(stage===0?0:netPulse),netY=stage===0?62:p.contact+12,netWidth=stage===0?58:62
  // Hoop registration comes from the new PNG: grip (38%,90%), hoop (38%,16%).
  const radians=netAngle*Math.PI/180,hoopX=netX+netWidth*.74*Math.sin(radians),hoopY=netY-netWidth*.74*Math.cos(radians)*192/208
  const points=[[0,12,-12],[1050,5,-4],[1550,2,-2],[1850,16,-18],[2800,-12,-6],[3750,-3,-2],[4100,-16,-18],[4900,5,-8],[5600,9,-5],[6500,25,-22]]
  const segment=Math.max(0,points.findIndex((v,i)=>i<points.length-1&&time>=v[0]&&time<points[i+1][0]))
  const first=points[segment],next=points[segment+1],blend=smooth((time-first[0])/(next[0]-first[0]))
  const butterflyX=reduced?94:Math.max(28,Math.min(115,hoopX+first[1]+(next[1]-first[1])*blend))
  const butterflyY=reduced?22:Math.max(-8,hoopY+first[2]+(next[2]-first[2])*blend)
  return {
    finished:ended, opacity:ended?0:reduced?1:Math.max(0,enter),
    bodyAngle:reduced?0:action==='watch-butterfly'?netPulse*(flying?2:stage===0?4:5):action==='look-around'?Math.sin(progress*Math.PI*2)*(flying?.7:stage===0?2:2.5)*Math.sin(progress*Math.PI):action==='dizzy'?Math.sin(time/380)*.6:action==='play'?(contact*(stage===0?6:flying?3.2:6.5)-follow*(flying?1.5:3))*formFactor+cheer*Math.sin(time/110)*2:action==='pet'?strokes*((stage===0?5:stage===4?1.35:flying?2.6:3.5)+stroke*(stage===4?.2:flying?.8:1.5)):action==='wake'?0:stage===0?2+Math.sin(time/1600):Math.sin(time/1400)*1.1,
    bodyY:reduced||stage===0?0:action==='watch-butterfly'?-Math.abs(netPulse)*(flying?1.2:2):action==='play'?-contact*(flying?1.5:p.lift)-follow*(flying?.5:1.5):action==='pet'?strokes*(flying?.45:1.7):action==='wake'?-wakeStretch*(flying?1.2:2):action==='focus'?1+Math.sin(time/1800)*.5:0,
    bodyX,bodyScaleX,bodyScaleY,contact:reduced?0:contact,affection:reduced?0:affection,
    heartY:reduced?0:-smooth((time-1750)/650)*16,
    ballX:reduced?contactX:115-Math.sin(progress*Math.PI*2)**2*(115-contactX),
    ballY:reduced?p.contact:p.contact-Math.abs(Math.sin(progress*Math.PI*4))*(stage===0?9:stage===1?20:stage===2?14:10)*formFactor,
    ballAngle:time/(stage===0?22:12),
    handX:reduced?(flying?65:62):(flying?65:62)+Math.sin((time-480)/490*Math.PI*2)*(flying?3:stage===0?4:5)*strokes+(1-arrive)*27,
    handY:(stage===4?15:p.head)+(reduced?0:-(1-arrive)*17+(1-Math.cos((time-480)/490*Math.PI*2))*1.5*strokes),
    handWidth:flying?42:53,
    netX,netY,netAngle,netWidth,hoopX,hoopY,
    butterflyX,butterflyY,
    butterflyAngle:reduced?-12:Math.cos(progress*Math.PI*2)*18,
    butterflyWing:reduced?1:.42+Math.abs(Math.sin(time/85))*.58,
    bookX:p.bookX, bookY:p.bookY,
    page:reduced?0:-180*(turn*turn*(3-2*turn)),
    pageOpacity:reduced?0:readingPhase<.74||readingPhase>.98?0:Math.min(1,(readingPhase-.74)*25,(.98-readingPhase)*30),
    readTilt:reduced||action!=='focus'?0:7+Math.sin(time/1800)*2,
    stars:time/12,orbit,
  };
}
