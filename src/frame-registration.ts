export interface FrameRegistration {
  scaleX: number
  scaleY: number
  x: number
  y: number
}

const identity: FrameRegistration = { scaleX: 1, scaleY: 1, x: 0, y: 0 }

/** Registration is fixed for a source sheet/row, never fitted to each frame.
 * Side loops are calibrated over the complete sampled cycle. In particular,
 * middle's first pose is the crouch before a hop, not its standing height.
 * Fitting that crouch to the front height almost doubled every later leap.
 * One uniform scale preserves the source poses and their original floor.
 */
function sideRegistration(form: 'junior' | 'middle', row: 1 | 2): FrameRegistration {
  const target = form === 'junior'
    ? { center: 95, height: 107, bottom: 154 }
    : { center: 100, height: 87, bottom: 171 }
  const [left, right, bottom, cycleHeight] = form === 'junior'
    ? row === 1 ? [27, 142, 144, 98] : [50, 165, 144, 98]
    : row === 1 ? [61, 132, 189, 95] : [58, 129, 189, 95]
  const scale = target.height * (form === 'middle' ? 1.3 : 1.12) / cycleHeight
  return {
    scaleX: scale,
    scaleY: scale,
    x: target.center - (left + right) / 2 * scale,
    y: target.bottom - bottom * scale,
  }
}

/** Keep the resting, care, sleep and walking sheets in one body coordinate
 * system. Props and clothing must receive this same registration as the body.
 * Football, drag and original finite emotion/affection clips have their own
 * registration and deliberately retain their source poses.
 */
export function bodyFrameRegistration(form: string, sheet: string, row = 0): FrameRegistration {
  if (form === 'junior' && ['grounded', 'slumber', 'gentle'].includes(sheet)) {
    const scaleY = 107 / 127
    return { scaleX: 1, scaleY, x: 0, y: 154 - 154 * scaleY }
  }
  if ((form === 'junior' || form === 'middle') && sheet === 'classic' && (row === 1 || row === 2)) {
    return sideRegistration(form, row)
  }
  return identity
}
