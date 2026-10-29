import {createSourceRotor,stepSourceRotor} from './source-rotor-motion.mjs';
import {reviewMotion,REVIEW_DURATION} from './throw-motion.mjs';
const fps=Number(process.argv[2]||30);
if(!Number.isFinite(fps)||fps<20||fps>100)throw new RangeError('Invalid preview fps');
const state=createSourceRotor();
const frames=Array.from({length:Math.ceil(REVIEW_DURATION*fps)},(_,i)=>{
  const time=i/fps,motion=reviewMotion('senior',time);
  return {...motion,time,rotor:stepSourceRotor(state,i?1000/fps:0,motion.vx)};
});
process.stdout.write(JSON.stringify({fps,duration:REVIEW_DURATION,frames}));
