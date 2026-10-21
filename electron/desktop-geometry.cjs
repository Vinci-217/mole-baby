const PET_SIZE = Object.freeze({ width: 160, height: 240 });

/** All native windows stay within the work area; hiding is a renderer pose. */
function fitPetBounds(bounds, area) {
  const width = Math.min(PET_SIZE.width, area.width);
  const height = Math.min(PET_SIZE.height, area.height);
  return {
    x: Math.round(Math.max(area.x, Math.min(bounds?.x ?? area.x + area.width - width - 6, area.x + area.width - width))),
    y: Math.round(Math.max(area.y, Math.min(bounds?.y ?? area.y + area.height - height - 8, area.y + area.height - height))),
    width,
    height,
  };
}

// Only the rightmost placement docks; approaching either edge is still free.
function cornerSide(bounds, area) {
  const right = area.x + area.width - bounds.x - bounds.width;
  return Math.abs(right) <= 1 ? 'right' : null;
}

function cornerBounds(bounds, area, side) {
  return fitPetBounds({
    x: side === 'left' ? area.x : area.x + area.width - PET_SIZE.width,
    y: bounds.y,
  }, area);
}

function canAnimateDesktop(state) {
  return state.visible && state.petMode && state.petCanMove && !state.panel && !state.dragging && !state.interacting;
}

/** Short random steps around the user's placement; never pull a pet to the floor. */
function nearbyWanderTarget(bounds, area, anchor = bounds, random = Math.random) {
  const start = fitPetBounds(bounds, area);
  const saved = fitPetBounds(anchor, area);
  const home = Math.abs(start.x - saved.x) <= 48 ? saved.x : start.x;
  const left = Math.max(area.x, home - 48);
  const right = Math.min(area.x + area.width - start.width, home + 48);
  const distance = 12 + Math.round(random() * 16);
  let direction = random() < 0.5 ? -1 : 1;
  if (start.x + direction * distance < left || start.x + direction * distance > right) direction *= -1;
  return { ...start, x: Math.round(Math.max(left, Math.min(right, start.x + direction * distance))) };
}

module.exports = { PET_SIZE, fitPetBounds, cornerSide, cornerBounds, canAnimateDesktop, nearbyWanderTarget };
