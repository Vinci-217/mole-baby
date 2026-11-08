import {sampleSocialMotion,SOCIAL_DURATIONS} from './social-motion';
import type {Stage,Evolution} from './game';

/** Current source-body rectangle in the shared 100 × 108 character space.
 * It excludes separate hats/flags/wings where the source exposes a body rig. */
export interface OutfitBodyBounds{x:number;y:number;width:number;height:number}
export const OUTFIT_PETTING_DURATION=SOCIAL_DURATIONS.pet;
export function validOutfitBody(value:unknown):value is OutfitBodyBounds{
 const body=value as OutfitBodyBounds|undefined;
 return Boolean(body&&[body.x,body.y,body.width,body.height].every(Number.isFinite)&&body.width>1&&body.height>1);
}
/** Project-authored petting choreography applied to the intact native costume.
 * Original SWF drawings stay together; this is not an official petting clip. */
export function outfitPettingPose(body:OutfitBodyBounds,elapsed:number,stage:Stage,evolution?:Evolution,reduced=false){
 const pose=sampleSocialMotion(stage,'pet',elapsed,reduced,evolution);
 const centre=body.x+body.width/2,base=body.y+body.height;
 const handWidth=Math.max(18,Math.min(58,body.width*.82));
 const t=Math.max(0,Math.min(1,elapsed/480)),arrive=t*t*(3-2*t);
 const stroke=reduced?0:Math.sin((elapsed-480)/490*Math.PI*2)*body.width*.055*arrive;
 const hx=centre+body.width*.2+stroke+(reduced?0:(1-arrive)*body.width*.4);
 const hy=body.y-body.width*.08-(reduced?0:(1-arrive)*body.width*.22);
 // Follow the same transform as the body, so contact remains registered while
 // the complete outfit gently nods. Prop geometry never determines body size.
 const angle=pose.bodyAngle*Math.PI/180,dx=(hx-centre)*pose.bodyScaleX,dy=(hy-base)*pose.bodyScaleY;
 return {pose,originX:centre,originY:base/108*100,
  handX:centre+dx*Math.cos(angle)-dy*Math.sin(angle)+pose.bodyX,
  handY:(base+dx*Math.sin(angle)+dy*Math.cos(angle))/108*100+pose.bodyY,
  handWidth,heartX:centre+body.width*.48,heartY:Math.max(0,body.y/108*100-8),heartSize:Math.max(12,Math.min(20,body.width*.3))};
}
