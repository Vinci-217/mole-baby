import type { Stage } from './game'
export interface DragPoint {x:number;y:number;at:number}
export interface ElasticDrag {x:number;y:number;angle:number;stretch:number;vx:number;vy:number;va:number;vs:number;targetX:number;targetY:number;targetAngle:number;targetStretch:number;last:DragPoint|null;direction:number;turns:number;turnAt:number;held:boolean}
export const createElasticDrag=():ElasticDrag=>({x:0,y:0,angle:0,stretch:0,vx:0,vy:0,va:0,vs:0,targetX:0,targetY:0,targetAngle:0,targetStretch:0,last:null,direction:0,turns:0,turnAt:0,held:false})
const clamp=(v:number,n:number)=>Math.max(-n,Math.min(n,v))
const profiles=[{lag:3.5,angle:8,stretch:.026},{lag:8,angle:14,stretch:.105},{lag:7,angle:12,stretch:.075},{lag:9,angle:11,stretch:.06},{lag:8,angle:10,stretch:.055}]
/** Cursor positions are screen coordinates. Only the art has inertia; the
 * native window continues to follow the grab point exactly, including HiDPI. */
export function pullElasticDrag(s:ElasticDrag,point:DragPoint,stage:Stage):'turn'|'dizzy'|null {
  const previous=s.last;s.last=point;s.held=true
  if(!previous)return null
  const dt=point.at-previous.at;if(dt<4||dt>200)return null
  const dx=point.x-previous.x,dy=point.y-previous.y,speed=clamp(dx/dt*3.6,1.4),vertical=clamp(dy/dt*2.8,1.4),p=profiles[stage]
  s.targetX=-speed*p.lag;s.targetY=-vertical*(stage===0?1.4:3.2)
  s.targetAngle=-speed*p.angle;s.targetStretch=Math.min(1,Math.hypot(speed,vertical)*.65)*p.stretch
  if(Math.abs(dx)<4||Math.abs(speed)<.11)return null
  const direction=Math.sign(dx);if(point.at-s.turnAt>1000)s.turns=0
  const reversal=s.direction!==0&&direction!==s.direction;s.direction=direction
  if(!reversal)return null
  s.turnAt=point.at;s.turns++
  if(s.turns>=3){s.turns=0;return 'dizzy'}
  return 'turn'
}
export function releaseElasticDrag(s:ElasticDrag){s.held=false;s.last=null;s.targetX=0;s.targetY=0;s.targetAngle=0;s.targetStretch=0}
/** Damped spring, integrated in small steps so a delayed paint cannot explode. */
export function stepElasticDrag(s:ElasticDrag,elapsed:number,reduced=false){
  if(reduced){s.x=s.y=s.angle=s.stretch=s.vx=s.vy=s.va=s.vs=0;return}
  const dt=Math.min(48,Math.max(0,elapsed))/1000,steps=Math.max(1,Math.ceil(dt/.008)),h=dt/steps
  if(s.held){const decay=Math.exp(-dt*6);s.targetX*=decay;s.targetY*=decay;s.targetAngle*=decay;s.targetStretch*=decay}
  for(let i=0;i<steps;i++){
    s.vx+=(155*(s.targetX-s.x)-17*s.vx)*h;s.x+=s.vx*h
    s.vy+=(170*(s.targetY-s.y)-18*s.vy)*h;s.y+=s.vy*h
    s.va+=(145*(s.targetAngle-s.angle)-16*s.va)*h;s.angle+=s.va*h
    s.vs+=(180*(s.targetStretch-s.stretch)-19*s.vs)*h;s.stretch+=s.vs*h
  }
  s.x=clamp(s.x,17);s.y=clamp(s.y,7);s.angle=clamp(s.angle,25);s.stretch=clamp(s.stretch,.13)
}
