export interface FrameRegistration {
  scaleX: number
  scaleY: number
  x: number
  y: number
}

const identity: FrameRegistration = { scaleX: 1, scaleY: 1, x: 0, y: 0 }

/** Registration is fixed for a source sheet/row, never fitted to each frame.
 * These are the original atlas's first-frame tint-mask ink bounds (inclusive,
 * alpha > 40 and RGB sum > 40). Later squash and stretch must remain intact.
 * The front-body target uses the exporter's canonical baseline and height.
 */
function sideRegistration(form: 'junior' | 'middle', row: 1 | 2): FrameRegistration {
  const target = form === 'junior'
    ? { center: 95, height: 107, bottom: 154 }
    : { center: 100, height: 87, bottom: 171 }
  const [left, top, right, bottom] = form === 'junior'
    ? row === 1 ? [27, 62, 142, 144] : [50, 62, 165, 143]
    : row === 1 ? [61, 139, 132, 189] : [58, 139, 129, 189]
  const scale = target.height / (bottom - top)
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
