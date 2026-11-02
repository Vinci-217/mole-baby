const {test}=require('node:test'),assert=require('node:assert/strict');
const {nativePosition,movementProgress}=require('./native-position.cjs');
test('native position conversion rejects nonfinite and overflowing coordinates and rounds fractional DIP positions',()=>{
 for(const value of [NaN,Infinity,-Infinity,2**40,'23',undefined])assert.equal(nativePosition({x:value,y:10}),null);
 assert.deepEqual(nativePosition({x:-318.75,y:100.49}),{x:-319,y:100});
});
test('sleep, timer delays and clock corrections never produce an invalid animation position',()=>{
 assert.equal(movementProgress(10000,3000,9999),null);
 assert.equal(movementProgress(10000,3000,10000+86400000),1);
 assert.equal(movementProgress(10000,3000,11500),.5);
 for(const value of [NaN,Infinity,0,-1])assert.equal(movementProgress(10000,value,11000),null);
});
