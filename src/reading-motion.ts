/** Local book choreography over the unchanged source pet. A long reading
 * pause, one curved page turn, then a short settling pause; no body warping. */
export const READING_CYCLE=8000;
export function readingMotion(elapsed:number,reduced=false){
 const time=Math.max(0,elapsed)%READING_CYCLE;
 const raw=Math.max(0,Math.min(1,(time-5500)/1500)),progress=raw*raw*(3-2*raw);
 return {turning:!reduced&&time>=5500&&time<7400,progress:reduced?0:progress,fold:reduced?1:Math.cos(progress*Math.PI),lift:reduced?0:Math.sin(progress*Math.PI),opacity:reduced?0:Math.min(1,Math.max(0,(time-5500)/120),Math.max(0,(7400-time)/300))};
}
