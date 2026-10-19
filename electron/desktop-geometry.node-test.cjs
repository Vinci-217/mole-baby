const test = require('node:test');
const assert = require('node:assert/strict');
const { fitPetBounds, cornerSide, cornerBounds, canAnimateDesktop } = require('./desktop-geometry.cjs');

test('new pet starts at the bottom right of the usable desktop, above the taskbar', () => {
  assert.deepEqual(fitPetBounds(null, { x: 0, y: 0, width: 1920, height: 1040 }),
    { x: 1708, y: 792, width: 200, height: 240 });
});

test('negative monitor coordinates and removed monitor positions remain visible', () => {
  const area = { x: -1600, y: -300, width: 1600, height: 900 };
  assert.deepEqual(fitPetBounds({ x: 900, y: 1200 }, area), { x: -200, y: 360, width: 200, height: 240 });
  assert.deepEqual(fitPetBounds({ x: -3000, y: -2000 }, area), { x: -1600, y: -300, width: 200, height: 240 });
});

test('either vertical edge can hide a manually placed pet without changing its height', () => {
  const area = { x: 0, y: 0, width: 1920, height: 1040 };
  assert.equal(cornerSide({ x: 0, y: 40, width: 200, height: 240 }, area), 'left');
  assert.equal(cornerSide({ x: 500, y: 800, width: 200, height: 240 }, area), null);
  assert.equal(cornerSide({ x: 30, y: 750, width: 200, height: 240 }, area), 'left');
  assert.equal(cornerSide({ x: 1680, y: 770, width: 200, height: 240 }, area), 'right');
  assert.deepEqual(cornerBounds({ y: 320 }, area, 'right'), { x: 1720, y: 320, width: 200, height: 240 });
});

test('seed, sleep, panel, held pet and tray-hidden windows cannot autonomously wander', () => {
  const active = { visible: true, petMode: true, petCanMove: true, panel: false, dragging: false };
  assert.equal(canAnimateDesktop(active), true);
  for (const patch of [{ visible: false }, { petMode: false }, { petCanMove: false }, { panel: true }, { dragging: true }, { interacting: true }]) {
    assert.equal(canAnimateDesktop({ ...active, ...patch }), false);
  }
});
