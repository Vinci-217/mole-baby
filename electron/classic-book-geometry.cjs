const { PET_SIZE } = require('./desktop-geometry.cjs');

/** Fit the original 1200×688 book without changing the standing pet's anchor.
 * Only the transparent host window expands; closing restores the same body.
 */
function classicBookBounds(base, area, folded = false) {
  const margin = 8;
  const scale = Math.min(5 / 6, (area.width - margin * 2) / 1200, (area.height - margin * 2) / 688);
  const width = Math.floor((folded ? 520 : 1100) * scale);
  const height = Math.floor(688 * scale);
  const right = base.x + PET_SIZE.width + 8;
  const left = base.x - width - 8;
  const panelSide = right + width <= area.x + area.width - margin ? 'right' : 'left';
  const x = Math.round(Math.max(area.x + margin, Math.min(panelSide === 'right' ? right : left, area.x + area.width - width - margin)));
  const y = Math.round(Math.max(area.y + margin, Math.min(base.y + PET_SIZE.height - height, area.y + area.height - height - margin)));
  const hostX = Math.min(base.x, x), hostY = Math.min(base.y, y);
  return {
    bounds: { x: hostX, y: hostY, width: Math.max(base.x + base.width, x + width) - hostX, height: Math.max(base.y + base.height, y + height) - hostY },
    panelSide,
    geometry: { petX: base.x - hostX, petY: base.y - hostY, panelX: x - hostX, panelY: y - hostY, panelWidth: width, panelHeight: height, scale },
  };
}
module.exports = { classicBookBounds };
