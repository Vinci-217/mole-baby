export interface FanMotion{angle:number;speed:number}
export const createFanMotion=():FanMotion=>({angle:0,speed:.28});
/** Revolutions/second, driven by horizontal cursor speed in screen pixels/s.
 * Touching adds a short impulse; both acceleration and coasting are continuous. */
export function stepFanMotion(state:FanMotion,elapsed:number,horizontalSpeed:number,petElapsed:number|null,reduced=false){
 if(reduced){state.angle=0;state.speed=0;return state}
 const dt=Math.max(0,Math.min(100,Number.isFinite(elapsed)?elapsed:0))/1000;
 const drag=Math.max(0,Math.min(3000,Number.isFinite(horizontalSpeed)?horizontalSpeed:0));
 const touch=petElapsed!==null&&petElapsed>=0&&petElapsed<3000?2.4*Math.exp(-petElapsed/950):0;
 // Keep the eight-blade rotor below the obvious 60 Hz strobing range.
 const target=Math.min(3.2,.28+drag/330+touch);
 state.speed+=(target-state.speed)*(1-Math.exp(-dt*6));
 state.angle=(state.angle+state.speed*dt*Math.PI*2)%(Math.PI*2);
 return state;
}
