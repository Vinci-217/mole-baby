const test = require('node:test');
const assert = require('node:assert/strict');
const { fitPetBounds, cornerSide, cornerBounds, canAnimateDesktop, nearbyWanderTarget } = require('./desktop-geometry.cjs');

test('new pet starts at the bottom right of the usable desktop, above the taskbar', () => {
  assert.deepEqual(fitPetBounds(null, { x: 0, y: 0, width: 1920, height: 1040 }),
    { x: 1754, y: 792, width: 160, height: 240 });
});

test('negative monitor coordinates and removed monitor positions remain visible', () => {
  const area = { x: -1600, y: -300, width: 1600, height: 900 };
  assert.deepEqual(fitPetBounds({ x: 900, y: 1200 }, area), { x: -160, y: 360, width: 160, height: 240 });
  assert.deepEqual(fitPetBounds({ x: -3000, y: -2000 }, area), { x: -1600, y: -300, width: 160, height: 240 });
});

test('only touching the far right edge docks; left and near-right placements remain free', () => {
  const area = { x: 0, y: 0, width: 1920, height: 1040 };
  assert.equal(cornerSide({ x: 0, y: 40, width: 160, height: 240 }, area), null);
  assert.equal(cornerSide({ x: 500, y: 800, width: 200, height: 240 }, area), null);
  for (const gap of [2, 6, 20, 70]) assert.equal(cornerSide({ x: 1760-gap, y: 770, width: 160 }, area), null);
  assert.equal(cornerSide({ x: 1760, y: 770, width: 160 }, area), 'right');
  assert.deepEqual(cornerBounds({ y: 320 }, area, 'right'), { x: 1760, y: 320, width: 160, height: 240 });
});

test('seed, sleep, panel, held pet and tray-hidden windows cannot autonomously wander', () => {
  const active = { visible: true, petMode: true, petCanMove: true, panel: false, dragging: false };
  assert.equal(canAnimateDesktop(active), true);
  for (const patch of [{ visible: false }, { petMode: false }, { petCanMove: false }, { panel: true }, { dragging: true }, { interacting: true }]) {
    assert.equal(canAnimateDesktop({ ...active, ...patch }), false);
  }
});


test('random wandering takes small steps around placement and preserves height over many walks', () => {
  let seed=83;const random=()=>{seed=(seed*16807)%2147483647;return seed/2147483647;};
  for(const area of [{x:0,y:0,width:1920,height:1040},{x:-1600,y:-300,width:1600,height:900},{x:10,y:20,width:180,height:250}]){
    for(const anchor of [fitPetBounds({x:area.x+200,y:area.y+30},area),fitPetBounds({x:area.x+area.width-160,y:area.y+80},area)]){
      let current=anchor;const seen=new Set();
      for(let n=0;n<500;n++){
        const next=nearbyWanderTarget(current,area,anchor,random);
        assert.ok(Math.abs(next.x-current.x)<=28);assert.ok(Math.abs(next.x-anchor.x)<=48);
        assert.equal(next.y,anchor.y);assert.ok(next.x>=area.x&&next.x+next.width<=area.x+area.width);
        seen.add(next.x);current=next;
      }
      assert.ok(seen.size>3,'positions are varied rather than following one fixed route');
    }
  }
});
