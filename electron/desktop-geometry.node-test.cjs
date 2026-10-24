const test = require('node:test');
const assert = require('node:assert/strict');
const { fitPetBounds, cornerSide, cornerBounds, edgeOffset, canAnimateDesktop, nearbyWanderTarget } = require('./desktop-geometry.cjs');

test('new pet starts at the bottom right of the usable desktop, above the taskbar', () => {
  assert.deepEqual(fitPetBounds(null, { x: 0, y: 0, width: 1920, height: 1040 }),
    { x: 1754, y: 792, width: 160, height: 240 });
});

test('negative monitor coordinates and removed monitor positions remain visible', () => {
  const area = { x: -1600, y: -300, width: 1600, height: 900 };
  assert.deepEqual(fitPetBounds({ x: 900, y: 1200 }, area), { x: -130, y: 421, width: 160, height: 240 });
  assert.deepEqual(fitPetBounds({ x: -3000, y: -2000 }, area), { x: -1630, y: -371, width: 160, height: 240 });
});

test('all four body edges dock only on contact, preserving the other coordinate', () => {
  const area = { x: 0, y: 0, width: 1920, height: 1040 };
  assert.equal(cornerSide({ x: 0, y: 40, width: 160, height: 240 }, area), null);
  assert.equal(cornerSide({ x: 500, y: 800, width: 200, height: 240 }, area), null);
  for (const [side, bounds, inward] of [
    ['left', { x: -30, y: 320 }, { x: 1, y: 0 }],
    ['right', { x: 1790, y: 320 }, { x: -1, y: 0 }],
    ['top', { x: 500, y: -71 }, { x: 0, y: 1 }],
    ['bottom', { x: 500, y: 861 }, { x: 0, y: -1 }],
  ]) {
    assert.equal(cornerSide(bounds, area), side);
    assert.deepEqual(cornerBounds({ x: 500, y: 320 }, area, side), { ...bounds, width: 160, height: 240 });
    for (const gap of [2, 6, 20, 70]) {
      assert.equal(cornerSide({ x: bounds.x + inward.x * gap, y: bounds.y + inward.y * gap }, area), null);
    }
  }
  assert.equal(cornerSide({ x: -30, y: -71 }, area), 'left', 'exact corner ties use a deterministic side');
  assert.equal(cornerSide({ x: -29, y: -71 }, area), 'top', 'the closer body edge wins');
  for(const[x,y,expected]of[[-30,-71,'left'],[1790,-71,'right'],[-30,861,'left'],[1790,861,'right']])assert.equal(cornerSide({x,y},area),expected,'corner ties have a stable horizontal preference');
});

test('a small work area keeps the native frame size and contains the body', () => {
  const area = { x: -200, y: 20, width: 180, height: 250 };
  const bounds = fitPetBounds({ x: 1000, y: -2000 }, area);
  assert.deepEqual(bounds, { x: -150, y: -51, width: 160, height: 240 });
  assert.ok(bounds.x + 30 >= area.x && bounds.x + 130 <= area.x + area.width);
  assert.ok(bounds.y + 71 >= area.y && bounds.y + 179 <= area.y + area.height);
});

test('edge poses expose finite directional translations on all four sides', () => {
  for (const [side, hidden, peek] of [
    ['left', { x: -82, y: 0 }, { x: -44, y: 0 }],
    ['right', { x: 82, y: 0 }, { x: 44, y: 0 }],
    ['top', { x: 0, y: -92 }, { x: 0, y: -50 }],
    ['bottom', { x: 0, y: 92 }, { x: 0, y: 50 }],
  ]) {
    assert.deepEqual(edgeOffset(side, 'visible'), { x: 0, y: 0 });
    assert.deepEqual(edgeOffset(side, 'tucking'), hidden);
    assert.deepEqual(edgeOffset(side, 'hidden'), hidden);
    assert.deepEqual(edgeOffset(side, 'peek'), peek);
  }
  assert.deepEqual(edgeOffset(null, 'hidden'), { x: 0, y: 0 });
  assert.deepEqual(edgeOffset('unexpected', 'hidden'), { x: 0, y: 0 });
});

test('seed, sleep, panel, held pet and tray-hidden windows cannot autonomously wander', () => {
  const active = { visible: true, petMode: true, petCanMove: true, panel: false, dragging: false };
  assert.equal(canAnimateDesktop(active), true);
  for (const patch of [{ visible: false }, { petMode: false }, { petCanMove: false }, { panel: true }, { dragging: true }, { interacting: true }]) {
    assert.equal(canAnimateDesktop({ ...active, ...patch }), false);
  }
});


test('two-dimensional roaming stays within the saved placement area and work area',()=>{
 let seed=83;const random=()=>{seed=seed*16807%2147483647;return seed/2147483647};
 const area={x:0,y:0,width:1920,height:1040},anchor={x:800,y:300,width:160,height:240};let current=anchor;const ys=new Set(),xs=new Set();
 for(let i=0;i<500;i++){const next=nearbyWanderTarget(current,area,anchor,random);assert.ok(Math.hypot(next.x-current.x,next.y-current.y)<=66);assert.ok(Math.abs(next.x-anchor.x)<=150);assert.ok(Math.abs(next.y-anchor.y)<=100);ys.add(next.y);xs.add(next.x);current=next;}
 assert.ok(ys.size>20&&xs.size>20);
});
const {compactPanelBounds}=require('./desktop-geometry.cjs');
test('216px care pocket fits each work-area corner without displacing the pet',()=>{
 for(const area of [{x:0,y:0,width:1920,height:1040},{x:-1280,y:-200,width:1280,height:720},{x:1920,y:40,width:1024,height:728}])for(const x of [area.x-30,area.x+area.width-130,area.x+300])for(const y of [area.y-71,area.y+area.height-179,area.y+200]){
  const base={x,y,width:160,height:240},result=compactPanelBounds(base,area),g=result.geometry,b=result.bounds;
  assert.equal(b.x+g.petX,x);assert.equal(b.y+g.petY,y);assert.equal(g.panelWidth,212);assert.equal(g.panelHeight,216);
  assert.ok(b.x+g.panelX>=area.x&&b.y+g.panelY>=area.y);assert.ok(b.x+g.panelX+g.panelWidth<=area.x+area.width&&b.y+g.panelY+g.panelHeight<=area.y+area.height);
 }
});
