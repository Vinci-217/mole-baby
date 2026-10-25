export const DIZZY_DURATION=3200
/** Move only the two original pupils inside their original whites. */
export function dizzyEyes(elapsed:number,reduced=false,radius:readonly number[]=[2.7,2.1]){
 const t=Math.max(0,elapsed),smooth=(v:number)=>{const q=Math.max(0,Math.min(1,v));return q*q*(3-2*q)}
 const envelope=reduced?0:smooth(t/220)*smooth((DIZZY_DURATION-t)/550),phase=t/920*Math.PI*2
 if(envelope===0)return{x:0,y:0,finished:t>=DIZZY_DURATION}
 return {x:Math.sin(phase)*radius[0]*envelope,y:Math.cos(phase)*radius[1]*envelope,finished:t>=DIZZY_DURATION}
}
