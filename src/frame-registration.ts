export interface FrameRegistration {
  scaleX: number
  scaleY: number
  x: number
  y: number
}

const identity: FrameRegistration = { scaleX: 1, scaleY: 1, x: 0, y: 0 }
const middleSideScale = Math.sqrt(7044 / 2563)
const middleSideFloor = 189
// The highest visible leaf in the two eight-frame neutral source rows is y=13.
export const MIDDLE_WALK_RISE = (middleSideFloor - 13) * middleSideScale / 208

/** Place a whole source timeline against the body baseline in 100 × 108 space. */
export function registeredFrameRect(
  {width, height, registration}: {width: number; height: number; registration: {centerX: number; baseY: number}},
  bodyBaseline: number,
  scale: number,
) {
  return {
    x: 50 - registration.centerX * scale,
    y: bodyBaseline - registration.baseY * scale,
    width: width * scale,
    height: height * scale,
  }
}

/** Each direction keeps one uniform transform and a fixed floor anchor.
 * The middle side atlas was exported smaller than the grounded front atlas.
 * Match body ink area between the front pose and the neutral side pose, before
 * the source's takeoff and landing. The original hop changes pose and height.
 */
function sideRegistration(form: 'junior' | 'middle', row: 1 | 2): FrameRegistration {
  const target = form === 'junior'
    ? { center: 95, bottom: 154 }
    : { center: 99, bottom: 171 }
  const source = form === 'junior'
    ? { center: row === 1 ? 84.5 : 107.5, bottom: 144, scale: 107 / 98 }
    : { center: row === 1 ? 96.5 : 93.5, bottom: middleSideFloor, scale: middleSideScale }
  return {
    scaleX: source.scale,
    scaleY: source.scale,
    x: target.center - source.center * source.scale,
    y: target.bottom - source.bottom * source.scale,
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
