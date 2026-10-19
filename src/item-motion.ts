import { getItem } from './catalog'

export type ItemGesture = 'nibble' | 'pour-beans' | 'crunch' | 'peel' | 'slice' | 'spoon' | 'stretch' | 'glow' | 'sip' | 'gulp' | 'fizz' | 'squeeze' | 'bath' | 'scrub' | 'face-wash' | 'brush' | 'rinse' | 'medicine'
export interface ItemMotion {
  action: string
  duration: number
  label: string
  itemId: string
  image: string
  gesture: ItemGesture
  body: 'eat' | 'drink' | 'wash' | 'medical'
  beats: number
  tilt: number
  accent: string
  /** Each recipe adapts original body art; it is not an official per-item clip. */
  adaptation: true
}

type Recipe = readonly [action: string, gesture: ItemGesture, duration: number, beats: number, tilt: number, accent: string]
const RECIPES: Record<string, Recipe> = {
  berry: ['eat-cocoa', 'nibble', 1900, 3, -12, '#b4d66a'],
  biscuit: ['eat-bear-biscuit', 'crunch', 2100, 4, 9, '#e7bd70'],
  juice: ['drink-berry-juice', 'sip', 2200, 3, -18, '#ffa642'],
  '180001': ['eat-chocolate-beans', 'pour-beans', 2200, 5, -65, '#684334'],
  '180002': ['drink-malt-milk', 'gulp', 2400, 3, -32, '#fff4db'],
  '180003': ['bubble-bath', 'bath', 3400, 5, 8, '#d8f5ff'],
  '180005': ['take-magic-medicine', 'medicine', 2800, 2, -24, '#d0b9ec'],
  '180007': ['eat-leaf-dumpling', 'peel', 2500, 3, -22, '#89b94c'],
  '180009': ['wash-apple-face', 'face-wash', 3000, 5, 17, '#c9e98e'],
  '180010': ['eat-watermelon', 'slice', 2500, 4, -10, '#f7a8b0'],
  '180014': ['drink-sport-cola', 'fizz', 2400, 2, -38, '#f2cf99'],
  '180018': ['eat-mole-burger', 'crunch', 2800, 5, 6, '#efd294'],
  '180019': ['eat-crystal-cake', 'spoon', 2900, 4, -14, '#fbb8d5'],
  '180020': ['eat-ham-sandwich', 'slice', 2700, 3, 13, '#f5d59b'],
  '180021': ['drink-carrot-juice', 'sip', 2600, 4, 8, '#ffb457'],
  '180022': ['shower-fresh', 'scrub', 3200, 6, -18, '#d6f8ee'],
  '180024': ['brush-teeth', 'brush', 3600, 12, 4, '#edfaff'],
  '180025': ['eat-jumping-pudding', 'spoon', 2600, 3, 15, '#fff1c6'],
  '180028': ['drink-gugu-fruit', 'squeeze', 2000, 4, -20, '#ffda6d'],
  '180029': ['rinse-shuang-fruit', 'rinse', 2700, 4, 22, '#dbefb4'],
  '180030': ['eat-happy-fruit', 'peel', 2400, 4, 16, '#abdc79'],
  '180043': ['eat-apple-pie', 'slice', 3000, 4, -8, '#e8daac'],
  '180044': ['eat-strawberry-pie', 'spoon', 3100, 5, 11, '#ffa9b5'],
  '180045': ['eat-ram-bun', 'stretch', 2300, 3, -7, '#fff4dc'],
  '180047': ['eat-hotdog', 'slice', 2800, 6, 5, '#dfb178'],
  '180070': ['eat-cloud-bread', 'stretch', 2600, 4, -13, '#d7edff'],
  '180071': ['eat-energy-star', 'glow', 2900, 3, 25, '#ffe68c'],
  '180073': ['drink-quality-milk', 'gulp', 2900, 4, -27, '#f5ffdc'],
}
const FALLBACK: Recipe = ['eat', 'nibble', 1800, 3, 0, '#f4dcb0']
const motions = new Map<string, ItemMotion>()
for (const [id, recipe] of Object.entries(RECIPES)) {
  const item = getItem(id)!
  const [action, gesture, duration, beats, tilt, accent] = recipe
  const body = item.category === 'food' ? 'eat' : item.category === 'drink' ? 'drink' : item.category === 'clean' ? 'wash' : 'medical'
  const verb = gesture === 'brush' ? '正在刷牙' : gesture === 'face-wash' ? '正在洗脸' : gesture === 'bath' ? '正在泡泡浴' : gesture === 'scrub' ? '正在擦洗身体' : gesture === 'rinse' ? '正在清爽地冲洗' : body === 'eat' ? '正在吃' : body === 'drink' ? '正在喝' : '正在使用'
  const motion: ItemMotion = { action, duration, label: ['brush', 'face-wash', 'bath', 'scrub', 'rinse'].includes(gesture) ? verb : `${verb}${item.name}`, itemId: item.id, image: item.image, gesture, body, beats, tilt, accent, adaptation: true }
  motions.set(item.id, motion); motions.set(item.sourceId, motion)
}
const byAction = new Map([...motions.values()].map(motion => [motion.action, motion]))

/** Stable save IDs and original numeric IDs resolve to the same recipe. */
export function getItemMotion(id: string | undefined): ItemMotion {
  const found = id ? motions.get(id) : undefined
  if (found) return found
  return { action: FALLBACK[0], duration: FALLBACK[2], label: '正在吃东西', itemId: '', image: '', gesture: FALLBACK[1], body: 'eat', beats: FALLBACK[3], tilt: FALLBACK[4], accent: FALLBACK[5], adaptation: true }
}
export function getItemMotionByAction(action: string): ItemMotion | undefined { return byAction.get(action) }

// Source-space mouth registrations, reviewed against the prop-free original
// cells. The original junior turns its face across the viewport while eating;
// anchoring every item at 50% would put it beside its face or over its eyes.
const MOUTH_ANCHORS: Record<string, readonly (readonly [number, number])[]> = {
  'junior:eat': [[51,159],[69,134],[99,141],[99,141],[151,141],[157,141],[163,145],[163,145],[163,145],[164,145],[164,145],[165,145],[171,145],[163,145],[163,145],[164,145]],
  'junior:drink': [[122,146],[123,141],[123,141],[134,141],[134,141],[123,141],[130,141],[130,141],[105,142],[64,142],[64,142],[52,142],[59,144],[59,144],[69,141],[59,141]],
  'middle:eat': [[95,143],[97,163],[95,160],[95,160],[95,160],[94,152],[92,147],[94,152],[95,160],[92,163],[92,163],[95,160],[94,152],[92,147],[94,152],[95,160]],
  'middle:drink': [[97,144],[97,144],[94,145],[96,146],[94,145],[97,144],[94,145],[96,146],[94,145],[97,144],[97,144],[94,145],[96,146],[94,145],[97,144],[94,145]],
  'senior:eat': [[92,172],[92,172],[72,178],[72,178],[85,169],[85,169],[86,183],[86,183],[84,183],[84,183],[84,183],[84,183],[84,183],[84,183],[84,183],[83,183]],
  'senior:drink': [[90,183],[90,183],[90,183],[93,183],[90,183],[89,183],[89,183],[93,183],[90,183],[89,183],[89,183],[93,183],[90,183],[89,183],[89,183],[93,183]],
}
export function getItemMouthAnchor(form: string | undefined, motion: ItemMotion, frame: number): readonly [number, number] {
  if (form === 'seed') return [50, 48]
  const anchor = MOUTH_ANCHORS[`${form}:${motion.body}`]?.[frame]
  if (anchor) return [anchor[0] / 192 * 100, anchor[1] / 208 * 100]
  return [50, form === 'senior' ? 81 : form === 'middle' ? 66 : 63]
}

export interface ItemMotionPose {
  progress: number
  x: number
  y: number
  angle: number
  scaleX: number
  scaleY: number
  opacity: number
  activity: number
  /** Original 16-frame body timeline is sampled in distinct physical rhythms. */
  bodyFrame: number
  finished: boolean
}
const clamp = (n: number, min = 0, max = 1) => Math.max(min, Math.min(max, n))

/** One elapsed clock drives both body and prop, so hidden windows cannot leave
 * a brushing tool moving after the face has returned to idle. Coordinates are
 * percentages of the unchanged 192×208 body viewport, relative to its mouth.
 */
export function sampleItemMotion(motion: ItemMotion, elapsed: number, reduced = false): ItemMotionPose {
  const progress = clamp(elapsed / motion.duration), finished = elapsed >= motion.duration
  const activity = clamp((progress - .14) / .68)
  const cycle = activity * motion.beats, wave = Math.sin(cycle * Math.PI * 2), bite = Math.max(0, Math.sin(cycle * Math.PI))
  const approach = clamp(progress / .16), depart = clamp((progress - .86) / .14)
  let x = (1 - approach) * 28 + depart * 18, y = (1 - approach) * 10 + depart * 12
  let angle = motion.tilt, scaleX = 1, scaleY = 1
  switch (motion.gesture) {
    case 'nibble': x += wave * 2.1; y += bite * -2; scaleX = 1 - activity * .3; scaleY = scaleX; break
    case 'pour-beans': x += 15 + wave; y += 5; angle -= bite * 16; break
    case 'crunch': x += wave * 3.2; y -= bite * 3; angle += wave * 7; scaleX = 1 - activity * .4; scaleY = scaleX; break
    case 'peel': x += wave * 1.8; angle += Math.sin(activity * Math.PI * 2) * 22; y -= bite * 2.6; scaleX = 1 - activity * .32; scaleY = scaleX; break
    case 'slice': x += wave * 4; y -= bite * 1.8; scaleX = 1 - activity * .48; break
    case 'spoon': x += Math.cos(cycle * Math.PI * 2) * 3; y += Math.abs(wave) * 4 - 2; angle += wave * 12; scaleX = 1 - activity * .3; scaleY = scaleX; break
    case 'stretch': x += wave * 2; scaleX = 1 + bite * .18 - activity * .35; scaleY = 1 - bite * .12 - activity * .25; break
    case 'glow': angle += wave * 16; scaleX = 1 + bite * .09 - activity * .3; scaleY = scaleX; break
    case 'sip': x += wave * .8; y += wave * .65; angle += bite * 9; break
    case 'gulp': x -= 1.2; y += wave * 1.2; angle -= bite * 24; break
    case 'fizz': x += wave * .9; angle -= bite * 32; y -= bite * 1.5; break
    case 'squeeze': scaleX = 1 - bite * .22; scaleY = 1 + bite * .12; y -= bite * 2; angle += wave * 5; break
    case 'bath': x = 28; y = 4 + wave * 1.4; angle += wave * 5; break
    case 'scrub': x = Math.cos(cycle * Math.PI * 2) * 10; y = Math.sin(cycle * Math.PI * 2) * 6 + 6; angle += wave * 20; break
    case 'face-wash': x = wave * 8; y = Math.cos(cycle * Math.PI * 2) * 4 - 7; angle += wave * 10; break
    case 'brush': x = wave * 5.5; y = Math.sin(cycle * Math.PI * 4) * 1.1; angle += wave * 6; break
    case 'rinse': x = Math.cos(cycle * Math.PI * 2) * 15; y = Math.sin(cycle * Math.PI * 2) * 10 - 4; angle += wave * 14; break
    case 'medicine': x -= 1; y -= bite * 1.2; angle -= bite * 24; break
  }
  const bodyFrame = motion.body === 'eat'
    ? Math.min(15, Math.round((.5 - .5 * Math.cos(cycle * Math.PI * 2)) * 15))
    : motion.body === 'drink' ? Math.min(15, Math.floor(activity * 16)) : Math.min(15, Math.round((.5 - .5 * Math.cos(cycle * Math.PI * 2)) * 15))
  if (reduced) return { progress, activity: .5, x: motion.gesture === 'bath' ? 28 : 0, y: motion.gesture === 'face-wash' ? -7 : 0, angle: motion.tilt, scaleX: 1, scaleY: 1, opacity: finished ? 0 : 1, bodyFrame: motion.body === 'wash' ? 5 : 0, finished }
  return { progress, activity, x, y, angle, scaleX, scaleY, opacity: finished ? 0 : Math.min(1, approach * 3) * (1 - depart), bodyFrame, finished }
}
