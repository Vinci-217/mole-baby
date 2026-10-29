import {test} from 'node:test';
import assert from 'node:assert/strict';
import {SOURCE_ROTOR_FRAMES,createSourceRotor,sampleSourceRotor,stepSourceRotor,ROTOR_IDLE_RATE,ROTOR_MAX_RATE} from './source-rotor-motion.mjs';

test('obeys the original frame9 gotoAndPlay(3), including the loop seam',()=>{
  const state=createSourceRotor(),frames=[];
  for(let i=0;i<18;i++){state.phase=i+.01;frames.push(sampleSourceRotor(state).sourceFrame)}
  assert.deepEqual(frames,[...SOURCE_ROTOR_FRAMES,...SOURCE_ROTOR_FRAMES,...SOURCE_ROTOR_FRAMES]);
  assert.ok(!frames.includes(1)&&!frames.includes(2)&&!frames.includes(9));
});
test('fast swipes visibly accelerate and coast back to idle after release',()=>{
  const idle=createSourceRotor(),drag=createSourceRotor();
  for(let i=0;i<50;i++){stepSourceRotor(idle,20,0);stepSourceRotor(drag,20,800)}
  assert.ok(drag.rate>idle.rate*2.4);assert.ok(drag.rate<=ROTOR_MAX_RATE);
  const before=drag.rate,phase=drag.phase;stepSourceRotor(drag,20,0);
  assert.ok(drag.rate<before&&drag.rate>ROTOR_IDLE_RATE*2);assert.ok(drag.phase>phase);
  for(let i=0;i<300;i++)stepSourceRotor(drag,20,0);
  assert.ok(Math.abs(drag.rate-ROTOR_IDLE_RATE)<.001);
});
test('left and right swipes keep the same forward sequence and phase at a reversal',()=>{
  const a=createSourceRotor(),b=createSourceRotor();
  for(let i=0;i<80;i++){
    const pa=stepSourceRotor(a,20,400),pb=stepSourceRotor(b,20,i<40?400:-400);
    assert.deepEqual(pa,pb);
  }
});
test('constant-speed integration agrees at 25, 50 and 100Hz and respects reduced motion',()=>{
  const states=[25,50,100].map(hz=>{const s=createSourceRotor();for(let i=0;i<hz;i++)stepSourceRotor(s,1000/hz,450);return s});
  for(const s of states.slice(1)){assert.ok(Math.abs(s.phase-states[0].phase)<1e-9);assert.ok(Math.abs(s.rate-states[0].rate)<1e-9)}
  const state=states[0],before={...state};const reduced=stepSourceRotor(state,20,2000,true);
  assert.deepEqual(state,before);assert.equal(reduced.sourceFrame,3);assert.equal(reduced.rate,0);
  stepSourceRotor(state,NaN,NaN);assert.ok(Number.isFinite(state.phase));
});
