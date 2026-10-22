const PET_SIZE = Object.freeze({ width: 160, height: 240 });
const PET_PADDING = Object.freeze({ left: 30, right: 30, top: 71, bottom: 61 });

/** Transparent margins may leave the work area; the 100×108 pet body may not. */
function fitPetBounds(bounds, area) {
  const left = area.x - PET_PADDING.left;
  const right = area.x + area.width - PET_SIZE.width + PET_PADDING.right;
  const top = area.y - PET_PADDING.top;
  const bottom = area.y + area.height - PET_SIZE.height + PET_PADDING.bottom;
  const x = Number.isFinite(bounds?.x) ? bounds.x : area.x + area.width - PET_SIZE.width - 6;
  const y = Number.isFinite(bounds?.y) ? bounds.y : area.y + area.height - PET_SIZE.height - 8;
  return {
    x: Math.round(left <= right ? Math.max(left, Math.min(x, right)) : (left + right) / 2),
    y: Math.round(top <= bottom ? Math.max(top, Math.min(y, bottom)) : (top + bottom) / 2),
    ...PET_SIZE,
  };
}

// Only an actual body touch docks. Order resolves an exact corner tie stably.
function cornerSide(bounds, area) {
  const distances = [
    ['left', Math.abs(bounds.x + PET_PADDING.left - area.x)],
    ['right', Math.abs(area.x + area.width - bounds.x - PET_SIZE.width + PET_PADDING.right)],
    ['top', Math.abs(bounds.y + PET_PADDING.top - area.y)],
    ['bottom', Math.abs(area.y + area.height - bounds.y - PET_SIZE.height + PET_PADDING.bottom)],
  ];
  let closest = null;
  let distance = Infinity;
  for (const [side, gap] of distances) if (gap <= 1 && gap < distance) { closest = side; distance = gap; }
  return closest;
}

function cornerBounds(bounds, area, side) {
  const next = { ...bounds };
  if (side === 'left') next.x = area.x - PET_PADDING.left;
  if (side === 'right') next.x = area.x + area.width - PET_SIZE.width + PET_PADDING.right;
  if (side === 'top') next.y = area.y - PET_PADDING.top;
  if (side === 'bottom') next.y = area.y + area.height - PET_SIZE.height + PET_PADDING.bottom;
  return fitPetBounds(next, area);
}

/** Renderer target translation; native bounds remain anchored to the body edge. */
function edgeOffset(side, pose) {
  if (pose === 'visible' || !['tucking', 'hidden', 'peek'].includes(pose)) return { x: 0, y: 0 };
  const horizontal = pose === 'peek' ? 44 : 82;
  const vertical = pose === 'peek' ? 50 : 92;
  if (side === 'left') return { x: -horizontal, y: 0 };
  if (side === 'right') return { x: horizontal, y: 0 };
  if (side === 'top') return { x: 0, y: -vertical };
  if (side === 'bottom') return { x: 0, y: vertical };
  return { x: 0, y: 0 };
}

function canAnimateDesktop(state) {
  return state.visible && state.petMode && state.petCanMove && !state.panel && !state.dragging && !state.interacting;
}

/** Short random steps around the user's placement; never pull a pet to the floor. */
function nearbyWanderTarget(bounds, area, anchor = bounds, random = Math.random) {
  const start = fitPetBounds(bounds, area);
  const saved = fitPetBounds(anchor, area);
  const home = Math.abs(start.x - saved.x) <= 48 ? saved.x : start.x;
  const left = Math.max(area.x - PET_PADDING.left, home - 48);
  const right = Math.min(area.x + area.width - start.width + PET_PADDING.right, home + 48);
  const distance = 12 + Math.round(random() * 16);
  let direction = random() < 0.5 ? -1 : 1;
  if (start.x + direction * distance < left || start.x + direction * distance > right) direction *= -1;
  return { ...start, x: Math.round(Math.max(left, Math.min(right, start.x + direction * distance))) };
}

module.exports = { PET_SIZE, PET_PADDING, fitPetBounds, cornerSide, cornerBounds, edgeOffset, canAnimateDesktop, nearbyWanderTarget };
