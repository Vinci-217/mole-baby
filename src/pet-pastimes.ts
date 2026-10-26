import { getStage } from './game'
import type { GameState } from './game'
import type { OutfitId } from './wardrobe'
import {learned} from './pet-school'

export const PASTIMES = ['read-alone','play-alone','spell','balance'] as const
export type Pastime = typeof PASTIMES[number]
export const isPastime = (action: string): action is Pastime => (PASTIMES as readonly string[]).includes(action)
export const pastimeBody = (action: string) => action==='read-alone'?'focus':action==='play-alone'?'play':action==='balance'?'look-around':action==='spell'?'idle':action
export const PASTIME_LABELS: Record<Pastime,string> = {'read-alone':'翻翻书','play-alone':'自己玩球',spell:'魔法变装',balance:'顶书练习'}
export const PASTIME_LINES: Record<Pastime,string> = {
  'read-alone':'我翻几页书，你忙你的。读到有趣的再告诉你。',
  'play-alone':'小球滚过来啦！我自己玩一会儿，也给你留个位置。',
  spell:'变身术练习！咕噜咕噜……这次会变出什么装扮呢？',
  balance:'把小书顶稳……哎呀，差一点！我再慢慢试一次。',
}
export const PASTIME_MEMORIES: Record<Pastime,string> = {
  'read-alone':'我自己翻了几页书，把喜欢的那页多看了一会儿。',
  'play-alone':'我在桌边自己玩了一会儿小球。',
  spell:'我练习了短暂的魔法变装，最后变回了熟悉的样子。',
  balance:'我顶着小书练平衡，摇摇晃晃也没有放弃。',
}
export function mayPlay(pet: GameState): boolean {
  return !pet.sleeping && !pet.outing && !pet.activity && pet.stats.health>35 && pet.stats.hunger>=30 && pet.stats.thirst>=30 && pet.stats.cleanliness>=30 && pet.stats.energy>=30
}
/** A local illusion uses original clothes; it never buys, unlocks or overwrites the wardrobe. */
export function spellCostume(petId: number, now = Date.now()): OutfitId {
  const date=new Date(now), day=Math.floor(Date.UTC(date.getFullYear(),date.getMonth(),date.getDate())/86400000)
  return (['wizard-cap','rabbit-hood','leaf-hood','warm-scarf'] as const)[(Math.abs(Math.floor(petId/1000))+day)%4]
}
export interface PetOuting { id: string; place: string; startedAt: number; returnsAt: number; story: string }
const MINUTE=60000
const PLACES=[
  {place:'浆果林',stage:1,story:'我去浆果林看了看，发现树荫下的叶子也有好多种绿。没带回食物，倒是带回了好心情。'},
  {place:'拉姆学院 · 音乐课',stage:1,story:'今天的音乐课我拍错了一小节，后来跟着节奏慢慢找回来了。下次还想试试！'},
  {place:'拉姆学院 · 魔法课',stage:2,story:'魔法课练了小小的旋风术，纸页呼啦翻过去了。我记住啦：先把书按稳，再念咒语。'},
  {place:'拉姆学院 · 搬运课',stage:2,story:'搬运课最难的是把东西放稳。我练了好几次平衡，最后让小书安安稳稳待住啦。'},
  {place:'拉姆学院 · 飞行课',stage:3,story:'飞行课练习了慢慢转弯。绕了一圈以后，最想停下来的地方还是你旁边。'},
] as const
export function beginOuting(pet: GameState, sequence=0, now=Date.now(), manual=false): GameState | null {
  if (!mayPlay(pet) || getStage(pet.growth,pet.evolution)===0 || !Number.isSafeInteger(now) || now<pet.lastTick) return null
  if (!manual && now-(pet.lastOutingAt??pet.createdAt)<90*MINUTE) return null
  const choices=PLACES.filter(p=>getStage(pet.growth,pet.evolution)>=p.stage&&(p.place!=='拉姆学院 · 魔法课'||learned(pet,'wind')))
  const seed=Math.abs(Math.floor(pet.createdAt/1000)+Math.floor(now/86400000)+sequence),choice=choices[seed%choices.length]
  const outing:PetOuting={id:`${pet.createdAt}:${now}`,place:choice.place,startedAt:now,returnsAt:now+(2+seed%4)*MINUTE,story:choice.story}
  return {...pet,outing,lastOutingAt:now}
}
export function normalizeOuting(value: unknown, now: number,petId?:number): PetOuting | undefined {
  if (!value || typeof value!=='object') return
  const o=value as Partial<PetOuting>
  if (typeof o.id!=='string'||o.id.length>80||!PLACES.some(p=>p.place===o.place&&p.story===o.story)) return
  if (!Number.isSafeInteger(o.startedAt)||o.startedAt!<0||o.startedAt!>now+300000||!Number.isSafeInteger(o.returnsAt)||o.returnsAt!<=o.startedAt!||o.returnsAt!-o.startedAt!>5*MINUTE) return
  if(petId!==undefined&&(o.id!==`${petId}:${o.startedAt}`||o.startedAt!<petId))return
  return o as PetOuting
}
export function finishOuting(pet:GameState):GameState {
  if(!pet.outing)return pet
  const next={...pet};delete next.outing;return next
}
