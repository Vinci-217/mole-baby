export function usesGroundedPose(form:string,action:string):boolean {
  return ['junior','middle'].includes(form)&&['idle','waiting','pet','play','focus','watch-butterfly','look-around','dizzy','wake','drag','still'].includes(action)
}
/** Original layers, continuous small movement; no looping squash or happy jump. */
export function groundedMotion(form:string,action:string,elapsed:number,clock:number,reduced=false,gaze={x:0,y:0}) {
  if(reduced||action==='still'||action==='drag')return {frame:0,eyeX:0,eyeY:0,leafAngle:0}
  const phase=(clock+(form==='middle'?1300:0))%5700
  let frame=phase>=5260&&phase<5410?(phase<5295||phase>=5375?1:2):0
  let eyeX=Math.sin(clock/3100)*.65+gaze.x*1.8,eyeY=Math.sin(clock/4200)*.2+gaze.y*1.1
  if(action==='pet')frame=elapsed>350&&elapsed<1950?(elapsed<460||elapsed>1840?1:2):frame
  if(action==='focus'){eyeX=Math.sin(clock/2800)*.35;eyeY=1.45}
  if(action==='play'){eyeX=1.6;eyeY=.7}
  if(action==='watch-butterfly'){eyeX=Math.sin(elapsed/6500*Math.PI*2)*2;eyeY=-1.1}
  if(action==='look-around'){eyeX=Math.sin(elapsed/3600*Math.PI*2)*2;eyeY=-.3}
  return {frame,eyeX:Math.max(-2.4,Math.min(2.4,eyeX)),eyeY:Math.max(-1.5,Math.min(1.5,eyeY)),leafAngle:form==='middle'?Math.sin(clock/2200)*1.15:0}
}
