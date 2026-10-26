import type { Stage } from './game'
export interface DragPoint {x:number;y:number;at:number}
export interface ElasticDrag {x:number;y:number;angle:number;stretch:number;skew:number;fringe:number;vx:number;vy:number;va:number;vs:number;vk:number;vf:number;targetX:number;targetY:number;targetAngle:number;targetStretch:number;targetSkew:number;targetFringe:number;last:DragPoint|null;direction:number;turns:number;turnAt:number;turnPulse:number;held:boolean;stage:Stage}
export const createElasticDrag=():ElasticDrag=>({x:0,y:0,angle:0,stretch:0,skew:0,fringe:0,vx:0,vy:0,va:0,vs:0,vk:0,vf:0,targetX:0,targetY:0,targetAngle:0,targetStretch:0,targetSkew:0,targetFringe:0,last:null,direction:0,turns:0,turnAt:0,turnPulse:0,held:false,stage:0})
const clamp=(v:number,n:number)=>Math.max(-n,Math.min(n,v))
// Seed stems bend slightly; young bodies are the softest. Flying forms have a
// longer pendulum and less squash. Faces/outfits always share the same layer.
const profiles=[
 {lag:3.8,angle:6.5,stretch:.032,skew:.9,recoil:13,grip:.18},
 {lag:10.2,angle:9,stretch:.15,skew:2.6,recoil:9.6,grip:.65},
 {lag:9,angle:8,stretch:.115,skew:2.2,recoil:10.2,grip:.52},
 {lag:11,angle:7,stretch:.09,skew:1.8,recoil:11.2,grip:.4},
 {lag:10,angle:6,stretch:.08,skew:1.5,recoil:10.8,grip:.36},
]
/** Cursor positions are screen coordinates. Only the art has inertia; the
 * native window continues to follow the grab point exactly, including HiDPI. */
export function pullElasticDrag(s:ElasticDrag,point:DragPoint,stage:Stage):'turn'|'dizzy'|null {
  const previous=s.last;s.last=point;s.held=true;s.stage=stage
  const p=profiles[stage]
  // A tiny squeeze at pickup, before the longer horizontal stretch.
  if(!previous){s.vs=clamp(s.vs-p.grip,1.5);return null}
  const dt=point.at-previous.at;if(dt<4||dt>200)return null
  const dx=point.x-previous.x,dy=point.y-previous.y,speed=clamp(dx/dt*3.6,1.4),vertical=clamp(dy/dt*2.8,1.4)
  s.targetX=-speed*p.lag;s.targetY=-vertical*(stage===0?1.4:3.2)
  s.targetAngle=-speed*p.angle;s.targetStretch=Math.min(1,Math.hypot(speed,vertical)*.65)*p.stretch
  s.targetSkew=speed*p.skew;s.targetFringe=-speed*(stage===2?6:2)
  if(Math.abs(dx)<4||Math.abs(speed)<.11)return null
  const direction=Math.sign(dx);if(point.at-s.turnAt>1000)s.turns=0
  const reversal=s.direction!==0&&direction!==s.direction;s.direction=direction
  if(!reversal)return null
  // Compress briefly when the hand changes direction, then unfold toward the
  // new target. Bounded impulses make quick repeated tugs safe and continuous.
  s.vs=clamp(s.vs-p.grip*.8,1.5);s.vk=clamp(s.vk+direction*p.skew*9,50);s.turnPulse=200
  s.turnAt=point.at;s.turns++
  if(s.turns>=3){s.turns=0;return 'dizzy'}
  return 'turn'
}
export function releaseElasticDrag(s:ElasticDrag){s.held=false;s.last=null;s.targetX=0;s.targetY=0;s.targetAngle=0;s.targetStretch=0;s.targetSkew=0;s.targetFringe=0;s.turnPulse=0}
export function elasticDragEnergy(s:ElasticDrag){return Math.abs(s.x)+Math.abs(s.y)+Math.abs(s.angle)+Math.abs(s.stretch)+Math.abs(s.skew)+Math.abs(s.fringe)+Math.abs(s.vx)+Math.abs(s.vy)+Math.abs(s.va)+Math.abs(s.vs)+Math.abs(s.vk)+Math.abs(s.vf)}
/** Damped spring, integrated in small steps so a delayed paint cannot explode. */
export function stepElasticDrag(s:ElasticDrag,elapsed:number,reduced=false){
  if(reduced){s.x=s.y=s.angle=s.stretch=s.skew=s.fringe=s.vx=s.vy=s.va=s.vs=s.vk=s.vf=0;return}
  const dt=Math.min(48,Math.max(0,elapsed))/1000,steps=Math.max(1,Math.ceil(dt/.008)),h=dt/steps
  s.turnPulse=Math.max(0,s.turnPulse-dt*1000)
  if(s.held){const decay=Math.exp(-dt*6);s.targetX*=decay;s.targetY*=decay;s.targetAngle*=decay;s.targetStretch*=decay;s.targetSkew*=decay;s.targetFringe*=decay}
  const damping=s.held?14:profiles[s.stage].recoil
  for(let i=0;i<steps;i++){
    s.vx+=(185*(s.targetX-s.x)-damping*s.vx)*h;s.x+=s.vx*h
    s.vy+=(170*(s.targetY-s.y)-(damping+1)*s.vy)*h;s.y+=s.vy*h
    s.va+=(145*(s.targetAngle-s.angle)-(damping+1)*s.va)*h;s.angle+=s.va*h
    s.vs+=(210*(s.targetStretch-s.stretch)-(damping-.6)*s.vs)*h;s.stretch+=s.vs*h
    s.vk+=(145*(s.targetSkew-s.skew)-(damping+1)*s.vk)*h;s.skew+=s.vk*h
    s.vf+=(95*(s.targetFringe-s.fringe)-11*s.vf)*h;s.fringe+=s.vf*h
  }
  s.x=clamp(s.x,17);s.y=clamp(s.y,7);s.angle=clamp(s.angle,19);s.stretch=clamp(s.stretch,profiles[s.stage].stretch*1.22);s.skew=clamp(s.skew,4.8);s.fringe=clamp(s.fringe,9)
}
