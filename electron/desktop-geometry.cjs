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

module.exports = { PET_SIZE, fitPetBounds, cornerSide, cornerBounds, canAnimateDesktop };
