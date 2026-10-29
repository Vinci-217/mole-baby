/** Review-only release inertia, in logical desktop pixels and seconds.
 * Not imported by the app. The next integration must move the native window,
 * rather than translating a pet inside its small transparent window. */
const clamp = (v, low, high) => Math.max(low, Math.min(high, v));
export const THROW_PROFILES = Object.freeze({
  seed: { drag: 4.8, cap: 720, stop: 9, tilt: 2.5 },
  junior: { drag: 3.5, cap: 900, stop: 8, tilt: 4 },
  middle: { drag: 3.5, cap: 900, stop: 8, tilt: 4 },
  senior: { drag: 2.6, cap: 950, stop: 7, tilt: 4 },
  classic: { drag: 2.5, cap: 950, stop: 7, tilt: 3 },
  super: { drag: 2.5, cap: 950, stop: 7, tilt: 3 },
  water: { drag: 2.5, cap: 950, stop: 7, tilt: 3 },
  wood: { drag: 2.5, cap: 950, stop: 7, tilt: 3 },
  fire: { drag: 2.5, cap: 950, stop: 7, tilt: 3 },
});

/** Recent screen coordinates only. Pausing the hand before release must stop
 * the throw. Clamping vector magnitude preserves diagonal direction. */
export function releaseVelocity(samples, releasedAt, form) {
  const profile = THROW_PROFILES[form];
  if (!profile) throw new TypeError('Unknown throw form');
  const recent = samples.filter(p => [p.x,p.y,p.at].every(Number.isFinite) && p.at <= releasedAt && p.at >= releasedAt - 100)
    .sort((a,b) => a.at-b.at);
  if (recent.length < 2 || releasedAt - recent.at(-1).at > 45) return { x:0, y:0 };
  const end = recent.at(-1), start = recent[0], dt = (end.at-start.at)/1000;
  if (dt < .012) return {x:0,y:0};
  const x = (end.x-start.x)/dt, y = (end.y-start.y)/dt, speed = Math.hypot(x,y);
  if (speed < 55) return {x:0,y:0};
  const scale = Math.min(1,profile.cap/speed);
  return { x:x*scale, y:y*scale };
}

/** Analytic damped glide, independent of refresh rate. This preview stops at
 * a boundary; deciding whether to dock there belongs to native integration. */
export function sampleThrow(form, origin, velocity, elapsed, bounds={left:-Infinity,right:Infinity,top:-Infinity,bottom:Infinity}, reduced=false) {
  const p=THROW_PROFILES[form];
  if (!p) throw new TypeError('Unknown throw form');
  if (![origin.x,origin.y,velocity.x,velocity.y,elapsed].every(Number.isFinite)) throw new TypeError('Non-finite throw input');
  const speed=Math.hypot(velocity.x,velocity.y), cap=speed ? Math.min(1,p.cap/speed) : 1;
  const vx=velocity.x*cap, vy=velocity.y*cap, initial=speed*cap;
  const stopTime=reduced||initial<=p.stop ? 0 : Math.min(2.2, Math.log(initial/p.stop)/p.drag);
  const t=clamp(elapsed,0,stopTime), decay=Math.exp(-p.drag*t), distance=(1-decay)/p.drag;
  const rawX=origin.x+vx*distance, rawY=origin.y+vy*distance;
  const x=clamp(rawX,bounds.left,bounds.right), y=clamp(rawY,bounds.top,bounds.bottom);
  const stopped=elapsed>=stopTime;
  const speedX=stopped||x!==rawX ? 0 : vx*decay, speedY=stopped||y!==rawY ? 0 : vy*decay;
  return {x,y,vx:speedX,vy:speedY,done:stopped||speedX===0&&speedY===0,stopTime,
    tilt:clamp(speedX/260,-1,1)*p.tilt};
}

export const REVIEW_DURATION=6.8;
/** Two scripted hand releases: right, then left. A stopped hand marker makes
 * the pet's actual travel after release easy to distinguish from body sway. */
export function reviewMotion(form,time) {
  const rightAt=1.25, leftAt=4.5, origin={x:110,y:0};
  const rightVelocity={x:250/(rightAt-.55),y:0};
  const rightStop=sampleThrow(form,{x:235,y:0},rightVelocity,10);
  if(time<.55) return {...origin,vx:0,vy:0,tilt:0,held:false,phase:'ready',handX:110,handY:0};
  if(time<rightAt){const t=(time-.55)/(rightAt-.55);return {x:110+125*t*t,y:0,vx:250*t/(rightAt-.55),vy:0,tilt:-3*t,held:true,phase:'drag-right',handX:110+125*t*t,handY:0}}
  if(time<3.7){const p=sampleThrow(form,{x:235,y:0},rightVelocity,time-rightAt);return {...p,held:false,phase:p.done?'settled':'release-right',handX:235,handY:0}}
  if(time<leftAt){const t=(time-3.7)/(leftAt-3.7);return {x:rightStop.x-100*t*t,y:rightStop.y,vx:-200*t/(leftAt-3.7),vy:0,tilt:3*t,held:true,phase:'drag-left',handX:rightStop.x-100*t*t,handY:rightStop.y}}
  const p=sampleThrow(form,{x:rightStop.x-100,y:rightStop.y},{x:-200/(leftAt-3.7),y:0},time-leftAt);
  return {...p,held:false,phase:p.done?'settled':'release-left',handX:rightStop.x-100,handY:rightStop.y};
}

if (process.argv[1] && import.meta.url === new URL('file://'+process.argv[1]).href) {
  const fps=30;
  process.stdout.write(JSON.stringify({fps,duration:REVIEW_DURATION,forms:Object.fromEntries(Object.keys(THROW_PROFILES).map(form=>[form,
    Array.from({length:Math.ceil(REVIEW_DURATION*fps)},(_,i)=>({time:i/fps,...reviewMotion(form,i/fps)}))]))}));
}
