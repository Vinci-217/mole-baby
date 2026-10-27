import { describe, expect, it } from 'vitest'
import { chooseIdleBehavior, idleCandidates, idleDelay, IDLE_ACTIONS } from './idle-behavior'
import type { IdleAction } from './idle-behavior'
import {  createMemory, recordCare } from './companion-memory'
import { createPet, STAGES } from './game'
import type { Evolution, Stage } from './game'
import { getRamActionDuration, sampleFlyingPose, sampleSeedPose } from './components/ram-animation'
import { groundedMotion, usesGroundedPose } from './grounded-motion'
import { socialSoundScore } from './pet-sound-score'
import {ramForm} from './original-actions'
import {isPastime} from './pet-pastimes'
import {isEmotionClip} from './mood-motion'

const NOW = Date.UTC(2026, 9, 22, 9)
function petAt(stage: Stage) {
  return { ...createPet('团团', 'red', NOW - 86_400_000), growth: STAGES[stage].threshold, ...(stage === 4 ? { evolution: 'super' as const } : {}) }
}
function sequence(stage: Stage, count = 240) {
  const pet = petAt(stage), memory = { ...createMemory(pet), personality: '喜欢留意小细节，语气轻快' }
  let previous: IdleAction | undefined
  return Array.from({ length: count }, (_, index) => {
    const chosen = chooseIdleBehavior(pet, memory, index, previous, NOW)!
    expect(chosen.action).not.toBe(previous)
    previous = chosen.action
    return chosen
  })
}

describe('stage-aware spontaneous original gestures', () => {
  it('varies every stage without successive repeats, walks, user props or indefinite actions', () => {
    const stages = ([0, 1, 2, 3, 4] as Stage[]).map(stage => sequence(stage))
    for (const [stage,entries] of stages.entries()) {
      expect(new Set(entries.map(entry => entry.action))).toEqual(new Set(IDLE_ACTIONS.filter(action=>!['mood-dozy','mood-grumpy'].includes(action)&&(stage>=2||action!=='spell'))))
      for (const entry of entries) {
        expect(entry.duration).toBe(getRamActionDuration(entry.action,ramForm(stage as Stage,stage===4?'super':undefined)))
        expect(entry.duration).toBeGreaterThan(0)
        expect(entry.duration).toBeLessThanOrEqual(18000)
        if(entry.action!=='watch-butterfly')expect(socialSoundScore(entry.action).cues).toEqual([])
      }
    }
    expect(new Set(stages.map(entries => entries.map(entry => entry.action).join(','))).size).toBe(5)
    expect(sequence(2)).toEqual(stages[2])
  })

  it('uses calmer preferences for low happiness, low energy or actual recent concern', () => {
    const pet = petAt(2), memory = createMemory(pet)
    const calm = ['mood-content','look-around']
    for (const stats of [{ ...pet.stats, happiness: 35 }, { ...pet.stats, energy: 30 }]) {
      const candidates = idleCandidates({ ...pet, stats }, memory, NOW)
      const expected=stats.happiness<40?['mood-grumpy',...calm]:['mood-dozy',...calm]
      expect(candidates.map(entry => entry.action)).toEqual(expected)
      expect(candidates[0].weight).toBeGreaterThan(candidates[1].weight)
      let previous: IdleAction | undefined
      for (let i = 0; i < 20; i++) {
        const next = chooseIdleBehavior({ ...pet, stats }, memory, i, previous, NOW)!
        expect(expected).toContain(next.action)
        expect(next.action).not.toBe(previous)
        previous = next.action
      }
    }

  })

  it('respects stable temperament and recent real care while leaving all source data unchanged', () => {
    const pet = petAt(1), initial = createMemory(pet)
    const normal = { ...initial, personality: '喜欢留意小细节，语气轻快' }
    const quiet = idleCandidates(pet, { ...normal, personality: '有点慢热，喜欢安静陪伴' }, NOW)
    const curious = idleCandidates(pet, { ...normal, personality: '好奇又爱听故事' }, NOW)
    const weight = (candidates: ReturnType<typeof idleCandidates>, action: IdleAction) => candidates.find(entry => entry.action === action)!.weight
    expect(weight(quiet, 'happy')).toBeLessThan(weight(idleCandidates(pet, normal, NOW), 'happy'))
    expect(weight(curious, 'watch-butterfly')).toBeGreaterThan(weight(idleCandidates(pet, normal, NOW), 'watch-butterfly'))
    const cheerfulPet = { ...pet, stats: { ...pet.stats, happiness: 90 } }
    const cared = recordCare(normal, 'pet', undefined, NOW - 1000)
    expect(weight(idleCandidates(cheerfulPet, cared, NOW), 'happy')).toBeGreaterThan(weight(idleCandidates(cheerfulPet, normal, NOW), 'happy'))
    const before = JSON.stringify({ pet: cheerfulPet, memory: cared })
    for (let i = 0; i < 30; i++) chooseIdleBehavior(cheerfulPet, cared, i, undefined, NOW)
    expect(JSON.stringify({ pet: cheerfulPet, memory: cared })).toBe(before)
  })

  it('never starts a gesture while asleep or when critical care should remain visible', () => {
    const pet = petAt(0), memory = createMemory(pet)
    expect(chooseIdleBehavior({ ...pet, sleeping: true }, memory, 0, undefined, NOW)).toBeNull()
    for (const [key, value] of [['health', 35], ['hunger', 29], ['thirst', 29], ['cleanliness', 29], ['energy', 24]] as const) {
      expect(chooseIdleBehavior({ ...pet, stats: { ...pet.stats, [key]: value } }, memory, 0, undefined, NOW)).toBeNull()
    }
  })

  it('keeps the existing 2–4 minute cadence finite and deterministic for every pet', () => {
    const delays = Array.from({ length: 200 }, (_, index) => idleDelay(NOW, index))
    expect(Math.min(...delays)).toBeGreaterThanOrEqual(120_000)
    expect(Math.max(...delays)).toBeLessThanOrEqual(240_000)
    expect(new Set(delays).size).toBe(delays.length)
    expect(idleDelay(NOW, 5)).toBe(delays[5])
    expect(idleDelay(NaN, Infinity)).toBe(120_000)
  })

  it('uses bounded original seed/grounded expressions and completes them instead of moving the pot', () => {
    for (const action of IDLE_ACTIONS.filter(action=>!isPastime(action))) {
      const duration = getRamActionDuration(action,'seed')!
      const frames = new Set(Array.from({ length: 20 }, (_, i) => sampleSeedPose(action, i * duration / 20).frame))
      expect(frames.size).toBeGreaterThan(1)
      expect(Math.max(...frames)).toBeLessThanOrEqual(action.startsWith('mood-')?7:2)
      expect(sampleSeedPose(action, duration).finished).toBe(true)
      for (const form of ['junior', 'middle']) expect(usesGroundedPose(form, action)).toBe(!isEmotionClip(action))
    }
    expect(groundedMotion('junior', 'happy', 800, 800).frame).toBe(2)
    const left = groundedMotion('middle', 'waving', 500, 500), right = groundedMotion('middle', 'waving', 1500, 1500)
    expect(left.eyeX).toBeGreaterThan(0)
    expect(right.eyeX).toBeLessThan(0)
    expect(groundedMotion('junior', 'happy', 800, 800, true)).toEqual({ frame: 0, eyeX: 0, eyeY: 0, leafAngle: 0 })
  })

  it('keeps the same continuous original flight frame under every spontaneous gesture', () => {
    for (const form of ['senior', 'super', 'water', 'wood', 'fire'] as Array<'senior' | Evolution>) {
      for (const action of IDLE_ACTIONS.filter(action=>!action.startsWith('mood-')&&!isPastime(action))) {
        const duration = getRamActionDuration(action,form)!
        for (const flightTime of [137, 420, 951, 1500]) {
          const pose = sampleFlyingPose(action, duration / 2, false, form, flightTime)
          const idle = sampleFlyingPose('idle', duration / 2, false, form, flightTime)
          expect(pose).toEqual(idle)
          expect(pose.row).toBe(0)
        }
        expect(sampleFlyingPose(action, duration, false, form, 1981).finished).toBe(true)
      }
    }
  })
})
