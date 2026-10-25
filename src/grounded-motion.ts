import {sampleSocialMotion} from './social-motion'

export function usesGroundedPose(form:string,action:string):boolean {
  return ['junior','middle'].includes(form)&&['idle','waiting','pet','focus','watch-butterfly','look-around','happy','waving','dizzy','wake','drag','still','mood-content','balance'].includes(action)
}
/** Original layers, continuous small movement; no looping squash or happy jump. */
export function groundedMotion(form:string,action:string,elapsed:number,clock:number,reduced=false,gaze={x:0,y:0}) {
  if(reduced||action==='still')return {frame:0,eyeX:0,eyeY:0,leafAngle:0}
  const phase=(clock+(form==='middle'?1300:0))%5700
  let frame=phase>=5260&&phase<5410?(phase<5295||phase>=5375?1:2):0
  let eyeX=Math.sin(clock/3100)*.65+gaze.x*1.8,eyeY=Math.sin(clock/4200)*.2+gaze.y*1.1
  // Affection keeps the familiar large eyes and looks up toward the hand.
  if(action==='drag'){frame=phase>5300&&phase<5410?1:0;eyeX=Math.sin(elapsed/700)*1.1;eyeY=-.6}
  if(action==='pet'){frame=0;eyeX=.6+Math.sin(elapsed/490*Math.PI*2)*.35;eyeY=-.8}
  if(action==='happy'){frame=elapsed>250&&elapsed<1500?(elapsed<350||elapsed>1400?1:2):0;eyeX=0;eyeY=0}
  if(action==='waving'){eyeX=Math.sin(Math.min(1,elapsed/2100)*Math.PI*2)*1.7;eyeY=-.35;frame=elapsed>900&&elapsed<1100?1:0}
  if(action==='mood-content'){frame=elapsed>900&&elapsed<1030||elapsed>1850&&elapsed<1970?1:0;eyeX=Math.sin(elapsed/1800)*.45;eyeY=-.2}
  if(action==='balance'){frame=0;eyeX=Math.sin(elapsed/1200)*.5;eyeY=-1.3}
  if(action==='focus'){eyeX=Math.sin(clock/2800)*.35;eyeY=1.45}
  if(action==='play'){
    const ball=sampleSocialMotion(form==='junior'?1:2,'play',elapsed)
    eyeX=1.3+(ball.ballX-90)*.035;eyeY=(ball.ballY-60)*.035
  }
  if(action==='wake'){frame=0;eyeX=0;eyeY=0}
  if(action==='watch-butterfly'){eyeX=Math.sin(elapsed/6500*Math.PI*2)*2;eyeY=-1.1}
  if(action==='look-around'){eyeX=Math.sin(elapsed/3600*Math.PI*2)*2;eyeY=-.3}
  const reaction=action==='play'?sampleSocialMotion(form==='junior'?1:2,'play',elapsed).contact:action==='pet'?Math.sin(elapsed/490*Math.PI*2)*Math.sin(Math.min(1,elapsed/2400)*Math.PI):0
  return {frame,eyeX:Math.max(-2.4,Math.min(2.4,eyeX)),eyeY:Math.max(-1.5,Math.min(1.5,eyeY)),leafAngle:form==='middle'?Math.sin(clock/2200)*1.15+reaction*4:0}
}
