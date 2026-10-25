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
function edgeOffset(side,pose,form='junior') {
 if(pose==='visible'||!['tucking','hidden','peek'].includes(pose))return{x:0,y:0};
 const profile=require('./edge-visibility.json').forms[form]??require('./edge-visibility.json').forms.junior;
 const amount=profile[pose==='peek'?'peek':'hidden'][side];if(!Number.isFinite(amount))return{x:0,y:0};
 return {x:side==='left'?-amount:side==='right'?amount:0,y:side==='top'?-amount:side==='bottom'?amount:0};
}

function canAnimateDesktop(state) {
  return state.visible && state.petMode && state.petCanMove && !state.panel && !state.dragging && !state.interacting;
}

/** Deliberate roaming in a wider, bounded area around the last manual placement. */
function nearbyWanderTarget(bounds,area,anchor=bounds,random=Math.random){
 const start=fitPetBounds(bounds,area),home=fitPetBounds(anchor,area);
 const distance=28+Math.round(random()*36),angle=random()*Math.PI*2;
 const x=Math.max(home.x-150,Math.min(home.x+150,start.x+Math.cos(angle)*distance));
 const y=Math.max(home.y-100,Math.min(home.y+100,start.y+Math.sin(angle)*distance*.65));
 return fitPetBounds({...start,x,y},area);
}

module.exports = { PET_SIZE, PET_PADDING, fitPetBounds, cornerSide, cornerBounds, edgeOffset, canAnimateDesktop, nearbyWanderTarget };

/** A 216px pocket follows the pet without changing its physical anchor. */
function compactPanelBounds(base, area) {
  const width=212,height=216,gap=20,margin=4;
  const right=base.x+PET_PADDING.left+100+gap,left=base.x+PET_PADDING.left-width-gap;
  const side=right+width<=area.x+area.width-margin?'right':'left';
  const x=Math.round(Math.max(area.x+margin,Math.min(side==='right'?right:left,area.x+area.width-width-margin)));
  const y=Math.round(Math.max(area.y+margin,Math.min(base.y+PET_PADDING.top-54,area.y+area.height-height-margin)));
  const hostX=Math.min(base.x,x),hostY=Math.min(base.y,y);
  return {bounds:{x:hostX,y:hostY,width:Math.max(base.x+PET_SIZE.width,x+width)-hostX,height:Math.max(base.y+PET_SIZE.height,y+height)-hostY},panelSide:side,geometry:{petX:base.x-hostX,petY:base.y-hostY,panelX:x-hostX,panelY:y-hostY,panelWidth:width,panelHeight:height,scale:1}};
}
module.exports.compactPanelBounds=compactPanelBounds;
