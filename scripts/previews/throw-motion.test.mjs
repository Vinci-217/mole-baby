import {test} from 'node:test';
import assert from 'node:assert/strict';
import {releaseVelocity,sampleThrow,THROW_PROFILES,reviewMotion} from './throw-motion.mjs';

test('all nine forms keep release direction, coast and settle without reversal',()=>{
  for(const form of Object.keys(THROW_PROFILES)) for(const velocity of [{x:370,y:-40},{x:-370,y:120},{x:0,y:-300}]) {
    let previous={x:0,y:0},previousSpeed=Infinity;
    for(let i=0;i<180;i++){
      const p=sampleThrow(form,{x:0,y:0},velocity,i/60);
      assert.ok((p.x-previous.x)*velocity.x>=-1e-8);
      assert.ok((p.y-previous.y)*velocity.y>=-1e-8);
      assert.ok(Math.hypot(p.vx,p.vy)<=previousSpeed+1e-8);
      previous=p;previousSpeed=Math.hypot(p.vx,p.vy);
    }
    assert.equal(previous.done,true);
    assert.deepEqual(sampleThrow(form,{x:0,y:0},velocity,4),sampleThrow(form,{x:0,y:0},velocity,10));
  }
});
test('release velocity ignores stale, paused and slow samples, and caps a diagonal as one vector',()=>{
  assert.deepEqual(releaseVelocity([{x:0,y:0,at:100},{x:100,y:0,at:120}],200,'seed'),{x:0,y:0});
  assert.deepEqual(releaseVelocity([{x:30,y:0,at:200},{x:30,y:0,at:280}],280,'middle'),{x:0,y:0});
  assert.deepEqual(releaseVelocity([{x:0,y:0,at:100},{x:1,y:0,at:180}],180,'junior'),{x:0,y:0});
  const v=releaseVelocity([{x:0,y:0,at:100},{x:1000,y:1000,at:130}],130,'senior');
  assert.ok(Math.abs(Math.hypot(v.x,v.y)-THROW_PROFILES.senior.cap)<1e-8);assert.equal(v.x,v.y);
});
test('boundaries stop the blocked axis, reduced motion stays put, invalid input is rejected',()=>{
  const p=sampleThrow('super',{x:30,y:30},{x:300,y:-300},.8,{left:0,right:50,top:0,bottom:50});
  assert.equal(p.x,50);assert.equal(p.y,0);assert.equal(p.vx,0);assert.equal(p.vy,0);assert.equal(p.done,true);
  const reduced=sampleThrow('middle',{x:40,y:30},{x:900,y:-100},.2,undefined,true);
  assert.equal(reduced.x,40);assert.equal(reduced.y,30);assert.equal(reduced.done,true);
  assert.throws(()=>sampleThrow('seed',{x:0,y:0},{x:NaN,y:0},1),TypeError);
});
test('review shows real travel after release and no vertical hop during junior/middle horizontal grabs',()=>{
  for(const form of Object.keys(THROW_PROFILES)){
    const a=reviewMotion(form,1.25),b=reviewMotion(form,1.65);
    assert.equal(a.handX,b.handX);assert.ok(b.x-a.x>45);
    const leftA=reviewMotion(form,4.5),leftB=reviewMotion(form,4.9);
    assert.equal(leftA.handX,leftB.handX);assert.ok(leftA.x-leftB.x>35);
  }
  for(const form of ['junior','middle']){
    const ys=Array.from({length:20},(_,i)=>reviewMotion(form,.55+i*.03).y);
    assert.ok(ys.every(y=>y===0));
  }
});
