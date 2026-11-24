import { getCompanionMood } from './companion-memory'
import type { CompanionMemory } from './companion-memory'
import { getStage } from './game'
import {ramForm} from './original-actions'
import type { GameState } from './game'
import { getRamActionDuration } from './components/ram-animation'
import {mayPlay, PASTIMES} from './pet-pastimes'
import {autonomousMagicActions,chooseAutonomousOriginal,drawAutonomousAction,isAutonomousMagic} from './pet-original-actions'
import {chooseNeedGesture} from './need-gesture'
import {isAmbientAction} from './ram-action'

/** Finite gestures and self-directed pastimes; no automatic user hand or focus timer. */
export const IDLE_ACTIONS = ['look-around', 'watch-butterfly', 'happy', 'waving','mood-joy','mood-content','mood-dozy','mood-grumpy',...PASTIMES] as const
export type IdleAction = typeof IDLE_ACTIONS[number]
export const isIdlePerformance = (action: string) => isAmbientAction(action) || IDLE_ACTIONS.some(candidate => candidate === action)
export interface IdleBehavior { action: IdleAction; duration: number }
interface Candidate { action: IdleAction; weight: number }
const stageWeights = [
  [5, 3, 2, 1], // A seed mostly observes from its fixed pot.
  [3, 4, 3, 2],
  [3, 3, 2, 4],
  [4, 3, 3, 2], // Flight keeps running under each small gesture.
  [3, 4, 2, 3],
] as const
const whole = (value: number) => Number.isFinite(value) ? Math.abs(Math.floor(value)) : 0

export const DEFAULT_IDLE_INTERVAL_SECONDS = 120
export const MIN_IDLE_INTERVAL_SECONDS = 10
export const MAX_IDLE_INTERVAL_SECONDS = 3600

export function validIdleIntervalSeconds(value: unknown): number {
  return typeof value === 'number' && Number.isInteger(value) && value >= MIN_IDLE_INTERVAL_SECONDS && value <= MAX_IDLE_INTERVAL_SECONDS
    ? value : DEFAULT_IDLE_INTERVAL_SECONDS
}

export function canShowIdleGesture(pet: GameState): boolean {
  // Being hungry or tired changes which gesture fits. Only states that take
  // the pet out of idle prevent the scheduler from showing a gesture at all.
  return !pet.sleeping && !pet.activity && !pet.outing
}

/** Re-evaluate live stats and surviving memories at the moment of the gesture.
 * Concern is a quieter expression, never a claim to see the user's screen. */
export function idleCandidates(pet: GameState, memory?: CompanionMemory, now = Date.now()): Candidate[] {
  if (!canShowIdleGesture(pet)) return []
  const ownMemory = memory?.petId === String(pet.createdAt) ? memory : undefined
  const concerned = ownMemory && getCompanionMood(ownMemory, pet, now).id === 'concerned'
  if(pet.stats.happiness<40)return [{action:'mood-grumpy',weight:5},{action:'mood-content',weight:3},{action:'look-around',weight:2}]
  if(pet.stats.energy<45)return [{action:'mood-dozy',weight:6},{action:'mood-content',weight:3},{action:'look-around',weight:2}]
  if(concerned)return [{action:'mood-content',weight:6},{action:'look-around',weight:3}]
  if (!mayPlay(pet)) return [{action:'mood-content',weight:5},{action:'look-around',weight:4},{action:'waving',weight:2}]
  const weights: number[] = [...stageWeights[getStage(pet.growth, pet.evolution)]]
  if (ownMemory && /慢热|安静/.test(ownMemory.personality)) { weights[0] += 3; weights[2] = 1; weights[3] = 1 }
  if (ownMemory && /好奇|故事/.test(ownMemory.personality)) weights[1] += 3
  if (ownMemory && getCompanionMood(ownMemory, pet, now).id === 'cheerful') weights[2] += 4
  return [...IDLE_ACTIONS.slice(0,4).map((action, index) => ({ action, weight: weights[index] })),
    {action:'mood-joy' as const,weight:pet.stats.happiness>=80?7:3},{action:'mood-content' as const,weight:4},
    {action:'read-alone' as const,weight:5},{action:'play-alone' as const,weight:pet.stats.happiness>=70?5:2}]
}

/** A deterministic weighted draw makes each pet varied and testable; the last
 * gesture is excluded, rather than replayed when a new mood changes weights. */
export function chooseIdleBehavior(pet: GameState, memory: CompanionMemory | undefined, sequence: number, previous?: string, now = Date.now()): IdleBehavior | null {
  const candidates = idleCandidates(pet, memory, now).filter(entry => entry.action !== previous)
  if (!candidates.length) return null
  let hash = (whole(pet.createdAt / 1000) ^ Math.imul(whole(sequence) + 1, 0x9e3779b9)) >>> 0
  hash = Math.imul(hash ^ hash >>> 16, 0x21f0aaad) >>> 0
  hash = Math.imul(hash ^ hash >>> 15, 0x735a2d97) >>> 0
  const total = candidates.reduce((sum, candidate) => sum + candidate.weight, 0)
  let draw = ((hash ^ hash >>> 15) >>> 0) / 0x1_0000_0000 * total
  for (const candidate of candidates) {
    draw -= candidate.weight
    if (draw < 0) return { action: candidate.action, duration: getRamActionDuration(candidate.action, ramForm(getStage(pet.growth,pet.evolution),pet.evolution))! }
  }
  return null
}

/** Choose the actual performance so the repeat check also covers originals. */
export function chooseScheduledIdleAction(pet: GameState, memory: CompanionMemory | undefined, sequence: number, previous?: string, random = Math.random, now = Date.now(), randomMagic = false): string | undefined {
  if (!canShowIdleGesture(pet)) return undefined
  const need=chooseNeedGesture(pet.stats,previous)
  if(need)return need
  const mood = memory?.petId === String(pet.createdAt) ? getCompanionMood(memory,pet,now).id : undefined
  if(pet.stats.happiness<40 && previous!=='mood-grumpy')return 'mood-grumpy'
  if(pet.stats.energy<45 && previous!=='mood-dozy' && pet.stats.happiness>=40)return 'mood-dozy'
  if((pet.stats.happiness>=80||mood==='cheerful') && previous!=='mood-joy' && random()<.55)return 'mood-joy'
  const content=pet.stats.happiness>=40&&pet.stats.energy>=45&&mood!=='unwell'&&mood!=='concerned'
  const spells = content && randomMagic && !isAutonomousMagic(previous) ? autonomousMagicActions(pet) : []
  if(spells.length && random() < .15)return drawAutonomousAction(spells,random)
  const original = content && random() < .7 ? chooseAutonomousOriginal(pet, previous, random) : undefined
  return original ?? chooseIdleBehavior(pet, memory, sequence, previous, now)?.action
}
