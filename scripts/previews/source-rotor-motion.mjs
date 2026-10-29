/** Preview only. Source frame scripts: Timeline_315.frame9 gotoAndPlay(3).
 * Advance the six original frames in order. A cycle is NOT a measured 360deg
 * physical revolution, so rate is a playback multiplier, never an RPM claim. */
export const SOURCE_ROTOR_FRAMES = Object.freeze([3,4,5,6,7,8]);
export const SOURCE_ROTOR_FPS = 24;
export const ROTOR_IDLE_RATE = .65;
export const ROTOR_MAX_RATE = 1.65;
export function createSourceRotor() { return {phase:0,rate:ROTOR_IDLE_RATE}; }
export function sampleSourceRotor(state,reduced=false) {
  const index=reduced?0:Math.floor(state.phase)%SOURCE_ROTOR_FRAMES.length;
  return {index,sourceFrame:SOURCE_ROTOR_FRAMES[index],phase:state.phase,rate:state.rate};
}
/** Speed is the absolute motion in logical px/s. Moving left never reverses
 * the source timeline; direction changes never restart its phase. */
export function stepSourceRotor(state,elapsedMs,speed,reduced=false) {
  if(reduced) return {...sampleSourceRotor(state,true),rate:0};
  const dt=Math.max(0,Math.min(100,Number.isFinite(elapsedMs)?elapsedMs:0))/1000;
  const motion=Number.isFinite(speed)?Math.min(3000,Math.abs(speed)):0;
  const target=ROTOR_IDLE_RATE+(ROTOR_MAX_RATE-ROTOR_IDLE_RATE)*Math.min(1,motion/360);
  const tau=target>state.rate ? .14 : .65,change=1-Math.exp(-dt/tau);
  // Integrate the exponential speed exactly. Frame rate changes must not
  // change where a fast swipe ends, or skip/reset the first pose on reversal.
  const integral=target*dt+(state.rate-target)*tau*change;
  state.phase+=SOURCE_ROTOR_FPS*Math.max(0,integral);
  state.rate+=(target-state.rate)*change;
  return sampleSourceRotor(state);
}
