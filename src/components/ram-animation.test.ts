import { describe, expect, it } from 'vitest'
import { getRamActionDuration, sampleRamPose, sampleSeedPose, sampleEvolvedPose } from './ram-animation'

describe('original Ram care animation contract', () => {
  it.each([
    ['feed', 0, 1200], ['eat', 0, 1200], ['drink', 1, 1200],
    ['wash', 2, 1500], ['use', 3, 900], ['medical', 3, 900],
  ] as const)('%s plays its own source row once, then finishes', (action, row, duration) => {
    expect(getRamActionDuration(action)).toBe(duration)
    expect(sampleRamPose(action, 0)).toEqual({ sheet: 'care', row, frame: 0, finished: false })
    expect(sampleRamPose(action, duration - 1)).toEqual({ sheet: 'care', row, frame: 15, finished: false })
    expect(sampleRamPose(action, duration)).toEqual({ row: 0, frame: 0, finished: true })
    expect(sampleRamPose(action, 10000).finished).toBe(true)
    expect(sampleRamPose(action, duration, true).finished).toBe(true)
  })
  it('holds genuine closed-eye source frames in every motion preference', () => {
    for (const reduced of [false, true]) for (const time of [0, 400, 9000, 1e9]) {
      expect(sampleRamPose('sleep', time, reduced)).toEqual({ row: 8, frame: 0, finished: false })
      expect(sampleSeedPose('sleep', time, reduced)).toEqual({ frame: 61, finished: false })
    }
  })
  it.each(['hungry', 'thirsty', 'sick', 'tired', 'dirty', 'sad'])('%s retains a condition pose after its initial reaction', action => {
    expect(getRamActionDuration(action)).toBeNull()
    const held = sampleRamPose(action, 7000)
    expect(held.finished).toBe(false)
    expect(held.row).toBeGreaterThan(0)
    expect(sampleRamPose(action, 16000).finished).toBe(false)
  })
  it('keeps seed interaction frames bounded and finite without animating the pot', () => {
    for (const action of ['feed', 'drink', 'wash', 'use', 'pet', 'wake', 'reward']) {
      const duration = getRamActionDuration(action)!
      for (let t = 0; t < duration; t += 20) {
        const pose = sampleSeedPose(action, t)
        expect(pose.frame).toBeGreaterThanOrEqual(0)
        expect(pose.frame).toBeLessThanOrEqual(24)
      }
      expect(sampleSeedPose(action, duration)).toEqual({ frame: 0, finished: true })
    }
  })
  it('uses separate static drag and catch reactions without jumping rows', () => {
    expect(sampleRamPose('drag', 1000)).toEqual({ row: 0, frame: 0, finished: false })
    for (const time of [0, 80, 160, 240]) expect(sampleRamPose('catch', time).row).toBe(0)
    expect(sampleRamPose('catch', 249).finished).toBe(true)
  })
  it('keeps god-power care in its own nine-row atlas and ends every finite gesture', () => {
    for (const action of ['feed', 'drink', 'wash', 'medical', 'brush-teeth', 'bubble-bath']) {
      const duration = getRamActionDuration(action)!
      for (let t = 0; t < duration; t += 40) {
        const pose = sampleEvolvedPose(action, t)
        expect(pose.sheet).toBeUndefined()
        expect(pose.row).toBe(3)
        expect(pose.frame).toBeLessThan(4)
      }
      expect(sampleEvolvedPose(action, duration).finished).toBe(true)
    }
    expect(sampleSeedPose('drag', 3000)).toEqual({ frame: 0, finished: false })
  })
})
