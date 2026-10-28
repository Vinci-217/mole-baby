import { getItem } from './catalog'
import gentle from '../public/assets/original/gentle-care/source.json'

export type ItemGesture = 'nibble' | 'pour-beans' | 'crunch' | 'peel' | 'slice' | 'spoon' | 'stretch' | 'glow' | 'sip' | 'gulp' | 'fizz' | 'squeeze' | 'bath' | 'scrub' | 'face-wash' | 'brush' | 'rinse' | 'medicine' | 'recolor'
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
  'recolor-red':['drink-color-red','recolor',2800,2,-24,'#ff6548'],
  'recolor-yellow':['drink-color-yellow','recolor',2800,2,-24,'#ffd438'],
  'recolor-blue':['drink-color-blue','recolor',2800,2,-24,'#48c8fa'],
  'recolor-pink':['drink-color-pink','recolor',2800,2,-24,'#fa83d5'],
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
  const [action, gesture, , , tilt, accent] = recipe
  const body = item.category === 'food' ? 'eat' : item.category === 'drink' ? 'drink' : item.category === 'clean' ? 'wash' : 'medical'
  const duration=body==='eat'?4600:body==='drink'?4000:body==='wash'?3600:2800
  const beats=body==='eat'?4:body==='drink'?3:body==='wash'?5:2
  const verb=body==='eat'?'正在吃':body==='drink'?'正在喝':body==='wash'?'泡泡洗洗，马上就干净啦':'正在使用'
  const motion:ItemMotion={action,duration,label:body==='wash'?verb:`${verb}${item.name}`,itemId:item.id,image:item.image,gesture,body,beats,tilt,accent,adaptation:true}

  motions.set(item.id, motion); motions.set(item.sourceId, motion)
}
const byAction = new Map([...motions.values()].map(motion => [motion.action, motion]))

/** Stable save IDs and original numeric IDs resolve to the same recipe. */
export function getItemMotion(id: string | undefined): ItemMotion {
  const found = id ? motions.get(id) : undefined
  if (found) return found
  const item=id?getItem(id):undefined
  if(item){
    const body=item.category==='food'?'eat':item.category==='drink'?'drink':item.category==='clean'?'wash':'medical'
    const duration=body==='eat'?4600:body==='drink'?4000:body==='wash'?3600:2800
    const motion:ItemMotion={action:item.changesColor?'drink-custom-color':`original-use-${item.id}`,duration,label:`正在使用${item.name}`,itemId:item.id,image:item.image,gesture:item.changesColor?'recolor':body==='eat'?'nibble':body==='drink'?'gulp':body==='wash'?'bath':'medicine',body,beats:body==='eat'?4:body==='drink'?3:body==='wash'?5:2,tilt:-12,accent:item.changesColor??'#e9ca88',adaptation:true}
    motions.set(item.id,motion);byAction.set(motion.action,motion)
    return motion
  }
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
  if(form&&Object.hasOwn(gentle.forms,form)){
    const p=gentle.forms[form as keyof typeof gentle.forms].mouthPoint
    return form==='seed'?[26.56+p[0]*.5,17.31+p[1]*.476]:[p[0],p[1]]
  }
  if (form === 'seed') return [50, 48]
  const anchor = MOUTH_ANCHORS[`${form}:${motion.body}`]?.[frame]
  if (anchor) return [anchor[0] / 192 * 100, anchor[1] / 208 * 100]
  if (form && ['super', 'water', 'wood', 'fire'].includes(form)) return [48, form === 'super' || form === 'wood' ? 80 : 77]
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
/** Actual mouth contacts also drive foley and the final food approach. */
export function careContactFractions(motion:ItemMotion):number[]{
 return motion.body==='eat'?[.43,.55,.67,.79]:motion.body==='drink'?[.32,.50,.68]:motion.body==='wash'?[.25,.36,.47,.58,.69]:[.31,.65]
}
export function sampleGentleMouth(motion:ItemMotion,elapsed:number,reduced=false):number {
 if(reduced||motion.body==='wash'||elapsed<0||elapsed>=motion.duration)return 0
 const p=elapsed/motion.duration
 // Open just before contact; close around the bite / nipple, then swallow.
 const wave=Math.max(0,...careContactFractions(motion).map(at=>Math.sin(Math.PI*clamp((p-(at-.055))/.055))*(p<at?1:0)))
 return Math.round(wave*7)
}
export function sampleItemMotion(motion:ItemMotion,elapsed:number,reduced=false):ItemMotionPose {
 const progress=clamp(elapsed/motion.duration),finished=elapsed>=motion.duration,activity=clamp((progress-.18)/.65)
 const enter=clamp(progress/.14),exit=clamp((progress-.86)/.14)
 const beat=Math.max(0,...careContactFractions(motion).map(at=>Math.max(0,1-Math.abs(progress-at)/.05)))
 const fixed=motion.body==='drink'||motion.body==='medical'
 return {progress,finished,activity,bodyFrame:Math.min(15,Math.floor(activity*16)),
  x:reduced?0:fixed?(1-enter)*27+exit*40:0,y:reduced?0:fixed?(1-enter)*18+exit*14:0,
  angle:reduced?0:fixed?-24-beat*4+exit*125:0,scaleX:1,scaleY:1,
  opacity:finished?0:reduced?1:Math.min(1,enter*3)*(1-exit)}
}
export interface CarePiece {x:number;y:number;angle:number;scale:number;opacity:number}
/** Food falls into one plate, rests, then travels to the registered tiny mouth.
 * The four drawn bites represent ONE consumed inventory portion. */
export function sampleCareRoutine(motion:ItemMotion,elapsed:number,mouth:readonly[number,number],seed=false,reduced=false){
 const pose=sampleItemMotion(motion,elapsed,reduced),p=reduced?.5:pose.progress
 const smooth=(v:number)=>{const t=clamp(v);return t*t*(3-2*t)}
 const trayX=seed?78:Math.min(88,mouth[0]+15),trayY=seed?76:Math.min(94,mouth[1]+17)
 const pieces:CarePiece[]=careContactFractions(motion).map((at,i)=>{
   const start=.10+i*.035,land=start+.15,feed=at-.075,travel=smooth((p-feed)/.075)
   const drop=clamp((p-start)/.15),x=trayX+(i-1.5)*6,y=trayY-5-Math.sin(i)*1.5
   return {x:x+(mouth[0]-x)*travel,y:p<land?-42+(y+42)*drop*drop:y+(mouth[1]-y)*travel-Math.sin(travel*Math.PI)*10,
     angle:reduced?0:(1-drop)*(i%2?45:-45)+travel*(i%2?18:-18),scale:reduced?.7:.78*(1-smooth((p-(at-.018))/.035)),
     opacity:pose.finished?0:reduced?i===0?1:0:p<start||p>at+.017?0:1}
 })
 return {...pose,trayX,trayY,trayOpacity:pose.finished?0:reduced?1:smooth(p/.11)*(1-smooth((p-.87)/.13)),
   trayLift:reduced?0:(1-smooth(p/.11))*14,
   bottleX:mouth[0]+pose.x,bottleY:mouth[1]+pose.y,bottleAngle:pose.angle,
   // Drain the drawn milk during the three visible swallowing beats.
   milk:reduced?1:1-smooth((p-.22)/.54),pieces,
   cleanOpacity:pose.finished?0:reduced?1:smooth(p/.18)*(1-smooth((p-.76)/.17)),
   rinse:reduced?0:smooth((p-.59)/.12)*(1-smooth((p-.80)/.09)),
   sparkle:pose.finished?0:reduced?0:smooth((p-.79)/.07)*(1-smooth((p-.94)/.06)),
 }
}

/** State is saved immediately; only the original body tint blends after sipping. */
export function colorBlend(elapsed: number, duration: number, reduced = false): number {
  if (reduced) return 1;
  const t=Math.max(0,Math.min(1,(elapsed/duration-.42)/.18));
  return t*t*(3-2*t);
}
