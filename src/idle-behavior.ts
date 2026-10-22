import { getCompanionMood } from './companion-memory'
import type { CompanionMemory } from './companion-memory'
import { getStage } from './game'
import type { GameState } from './game'
import { getRamActionDuration } from './components/ram-animation'

/** Original, finite gestures only: never a walk, user hand, ball or focus book. */
export const IDLE_ACTIONS = ['look-around', 'watch-butterfly', 'happy', 'waving'] as const
export type IdleAction = typeof IDLE_ACTIONS[number]
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

/** No persistence or random timers: the hook owns one 2–4 minute deadline. */
export function idleDelay(petId: number, sequence: number): number {
  return 120_000 + (whole(petId / 1000) + whole(sequence) * 73_129) % 120_001
}

/** Re-evaluate live stats and surviving memories at the moment of the gesture.
 * Concern is a quieter expression, never a claim to see the user's screen. */
export function idleCandidates(pet: GameState, memory?: CompanionMemory, now = Date.now()): Candidate[] {
  if (pet.sleeping || pet.stats.health <= 35 || pet.stats.hunger < 30 || pet.stats.thirst < 30 || pet.stats.cleanliness < 30 || pet.stats.energy < 25) return []
  const ownMemory = memory?.petId === String(pet.createdAt) ? memory : undefined
  const concerned = ownMemory && getCompanionMood(ownMemory, pet, now).id === 'concerned'
  if (concerned || pet.stats.happiness < 45 || pet.stats.energy < 45) return [
    { action: 'look-around', weight: 6 }, { action: 'watch-butterfly', weight: 2 },
  ]
  const weights: number[] = [...stageWeights[getStage(pet.growth, pet.evolution)]]
  if (ownMemory && /慢热|安静/.test(ownMemory.personality)) { weights[0] += 3; weights[2] = 1; weights[3] = 1 }
  if (ownMemory && /好奇|故事/.test(ownMemory.personality)) weights[1] += 3
  if (ownMemory && getCompanionMood(ownMemory, pet, now).id === 'cheerful') weights[2] += 4
  return IDLE_ACTIONS.map((action, index) => ({ action, weight: weights[index] }))
}

/** A deterministic weighted draw makes each pet varied and testable; the last
 * gesture is excluded, rather than replayed when a new mood changes weights. */
export function chooseIdleBehavior(pet: GameState, memory: CompanionMemory | undefined, sequence: number, previous?: IdleAction, now = Date.now()): IdleBehavior | null {
  const candidates = idleCandidates(pet, memory, now).filter(entry => entry.action !== previous)
  if (!candidates.length) return null
  let hash = (whole(pet.createdAt / 1000) ^ Math.imul(whole(sequence) + 1, 0x9e3779b9)) >>> 0
  hash = Math.imul(hash ^ hash >>> 16, 0x21f0aaad) >>> 0
  hash = Math.imul(hash ^ hash >>> 15, 0x735a2d97) >>> 0
  const total = candidates.reduce((sum, candidate) => sum + candidate.weight, 0)
  let draw = ((hash ^ hash >>> 15) >>> 0) / 0x1_0000_0000 * total
  for (const candidate of candidates) {
    draw -= candidate.weight
    if (draw < 0) return { action: candidate.action, duration: getRamActionDuration(candidate.action)! }
  }
  return null
}
