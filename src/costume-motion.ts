import type {Stage,Evolution} from './game';
import type {CostumeAction} from './costume-action';
import {outfitPettingPose,type OutfitBodyBounds} from './outfit-petting';
import {sampleSocialMotion,gesturePulse} from './social-motion';
import {sampleGentleMouth} from './item-motion';

const clamp=(n:number,min=0,max=1)=>Math.max(min,Math.min(max,n));
/** Project-authored movement of the INTACT original costume. The native
 * directional walk still comes from its SWF; missing gestures use this rig. */
export function sampleCostumeMotion(spec:CostumeAction,body:OutfitBodyBounds,elapsed:number,stage:Stage,evolution?:Evolution,reduced=false){
 const time=Math.max(0,Number.isFinite(elapsed)?elapsed:0),duration=spec.duration;
 const progress=duration===null?0:clamp(time/Math.max(1,duration));
 const envelope=duration===null?1:Math.sin(progress*Math.PI)**2;
 const centre=body.x+body.width/2,bottom=body.y+body.height,mouth:[number,number]=[centre,(body.y+body.height*.73)/108*100];
 const pose={x:0,y:0,angle:0,scaleX:1,scaleY:1,originX:centre,originY:bottom/108*100,opacity:duration!==null&&time>=duration?0:1,finished:duration!==null&&time>=duration,
  handX:centre,handY:body.y/108*100,handWidth:body.width*.8,heartX:centre+body.width*.48,heartY:body.y/108*100-8,heartSize:clamp(body.width*.3,12,20),affection:0,heartLift:0,
  ballX:centre+body.width*.75,ballY:bottom/108*100-8,ballSize:clamp(body.width*.29,12,24),ballAngle:0,contact:0,
  bookX:centre,bookY:(bottom+body.height*.05)/108*100,bookSize:clamp(body.width*.78,28,61),page:0,pageOpacity:0,
  netX:centre+body.width*.46,netY:bottom/108*100,netWidth:body.width*.78,netAngle:12,
  butterflyX:centre+body.width*.8,butterflyY:body.y/108*100-10,butterflyAngle:0,butterflyWing:1,
  propX:centre+body.width*.65,propY:(body.y+body.height*.65)/108*100,propAngle:0,propSize:clamp(body.width*.4,16,36),toyScale:1,springScale:1,ink:0,mouth};
 if(spec.kind==='social'){
  const action=spec.action as 'pet'|'play'|'focus'|'dizzy'|'watch-butterfly'|'look-around'|'wake';
  const p=sampleSocialMotion(stage,action,time,reduced,evolution);
  pose.opacity=p.opacity;
  if(action==='pet'){
   const a=outfitPettingPose(body,time,stage,evolution,reduced);
   Object.assign(pose,{x:a.pose.bodyX,y:a.pose.bodyY,angle:a.pose.bodyAngle,scaleX:a.pose.bodyScaleX,scaleY:a.pose.bodyScaleY,handX:a.handX,handY:a.handY,handWidth:a.handWidth,heartX:a.heartX,heartY:a.heartY,heartSize:a.heartSize,affection:p.affection,heartLift:p.heartY});
  }else if(action==='play'){
   Object.assign(pose,{x:p.bodyX*body.width/65,y:p.bodyY,angle:p.bodyAngle,scaleX:p.bodyScaleX,scaleY:p.bodyScaleY,ballX:centre+body.width*(.72+Math.cos(time/4200*Math.PI*4)*.15),ballY:(bottom-body.height*.08)/108*100-Math.abs(Math.sin(time/4200*Math.PI*4))*body.height*.38,ballAngle:time/12,contact:p.contact});
  }else if(action==='dizzy')Object.assign(pose,{x:Math.sin(time/210)*1.6*envelope,angle:Math.sin(time/260)*5*envelope});
  else if(action==='focus')Object.assign(pose,{angle:Math.sin(time/1900)*.5,page:p.page,pageOpacity:p.pageOpacity});
  else if(action==='wake')Object.assign(pose,{scaleX:p.bodyScaleX,scaleY:p.bodyScaleY});
  else if(action==='watch-butterfly')Object.assign(pose,{angle:p.bodyAngle,netAngle:p.netAngle,butterflyX:centre+body.width*(.7+Math.sin(time/700)*.27),butterflyY:body.y/108*100-8+Math.cos(time/530)*8,butterflyAngle:p.butterflyAngle,butterflyWing:p.butterflyWing});
  else pose.angle=p.bodyAngle*2;
 }else if(spec.kind==='care'&&spec.motion){
  const jaw=sampleGentleMouth(spec.motion,time,reduced)/7;
  pose.scaleX=1+jaw*.008;pose.scaleY=1-jaw*.012;pose.angle=spec.motion.body==='wash'?Math.sin(time/280)*1.5*envelope:jaw*.8;
 }else if(spec.kind==='toy'){
  if(spec.toy==='180023'){
   const bounce=Math.sin(progress*Math.PI*6),lift=Math.max(0,bounce);
   pose.y=-lift*body.height*.32*envelope;pose.scaleX=1+Math.max(0,-bounce)*.035*envelope;pose.scaleY=1-Math.max(0,-bounce)*.04*envelope;pose.springScale=.5+lift*.8;pose.propX=centre;pose.propY=bottom/108*100+6;
  }else if(spec.toy==='180097'){
   pose.propX=centre;pose.propY=mouth[1];pose.toyScale=.1+Math.sin(progress*Math.PI)**2*1.5;pose.angle=Math.sin(time/480)*2*envelope;
  }else if(spec.toy?.startsWith('tuya')){
   pose.propX=centre+body.width*.52;pose.propY=mouth[1]+Math.sin(time/290)*5;pose.propAngle=Math.sin(time/280)*24;pose.ink=clamp((progress-.16)/.65);pose.angle=Math.sin(time/290)*1.5*envelope;
  }else{
   pose.propX=centre+body.width*(.48+Math.sin(time/440)*.22);pose.propY=body.y/108*100-3+Math.cos(time/510)*10;pose.propAngle=Math.sin(time/360)*28;
   pose.angle=Math.sin(time/440)*3*envelope;pose.y=spec.toy==='180026'?0:-gesturePulse(time,(duration??4400)*.55,600)*5;
  }
 }else if(spec.kind==='emotion'){
  if(['mood-joy','happy','reward','waving','review','catch'].includes(spec.action)){pose.y=-Math.abs(Math.sin(progress*Math.PI*3))*4*envelope;pose.angle=Math.sin(progress*Math.PI*4)*3*envelope;pose.affection=envelope;}
  else if(['mood-grumpy','failed'].includes(spec.action))pose.angle=Math.sin(time/130)*2*envelope;
  else if(spec.action==='sleep'||spec.action==='mood-dozy'||spec.action==='tired'){pose.scaleY=1-Math.sin(time/1400)**2*.008;pose.angle=spec.action==='sleep'?0:Math.sin(time/700)*1.2*envelope;}
 }else if(spec.kind==='natural'){
  pose.angle=Math.sin(time/(spec.natural==='music'?150:500))*2*envelope;
  if(spec.natural==='music')pose.y=-Math.abs(Math.sin(time/190))*2*envelope;
  if(spec.natural==='study'){const p=sampleSocialMotion(stage,'focus',time,reduced,evolution);pose.page=p.page;pose.pageOpacity=p.pageOpacity;}
  pose.propAngle=Math.sin(time/200)*20;pose.propY=mouth[1]+6+Math.sin(time/260)*2;
 }else if(spec.kind==='school'){
  if(spec.action==='restaurant')pose.x=Math.sin(time/3000*Math.PI*2)*8;
  else pose.angle=Math.sin(time/900)*.8;
 }
 if(reduced){Object.assign(pose,{x:0,y:0,angle:0,scaleX:1,scaleY:1,propAngle:0,page:0,pageOpacity:0,ballAngle:0,contact:0,affection:0,heartLift:0,butterflyAngle:0,butterflyWing:1,toyScale:1,springScale:1});}
 return pose;
}
