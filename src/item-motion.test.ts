import { describe, expect, it } from 'vitest'
import { ITEMS } from './catalog'
import { getItemMotion, getItemMotionByAction, sampleItemMotion, colorBlend } from './item-motion'
import { getRamActionDuration, sampleRamPose, sampleSeedPose } from './components/ram-animation'

describe('item-specific care animation contract', () => {
  it('resolves every owned item and numeric source alias to one finite action', () => {
    const actions = new Set<string>()
    for (const item of ITEMS) {
      const motion = getItemMotion(item.id)
      expect(motion.itemId).toBe(item.id)
      expect(getItemMotion(item.sourceId)).toBe(motion)
      expect(getItemMotionByAction(motion.action)).toBe(motion)
      expect(motion.image).toBe(item.image)
      expect(motion.duration).toBeGreaterThanOrEqual(1800)
      expect(getRamActionDuration(motion.action)).toBe(motion.duration)
      actions.add(motion.action)
    }
    expect(actions.size).toBe(ITEMS.length)
  })
  it('finishes both body forms and accessory together at the exact deadline', () => {
    for (const item of ITEMS) {
      const motion = getItemMotion(item.id)
      for (const reduced of [false, true]) {
        expect(sampleRamPose(motion.action, motion.duration - 1, reduced).finished).toBe(false)
        expect(sampleSeedPose(motion.action, motion.duration - 1, reduced).finished).toBe(false)
        for (const elapsed of [motion.duration, motion.duration * 2]) {
          expect(sampleRamPose(motion.action, elapsed, reduced)).toEqual({ row: 0, frame: 0, finished: true })
          expect(sampleSeedPose(motion.action, elapsed, reduced)).toEqual({ frame: 0, finished: true })
          expect(sampleItemMotion(motion, elapsed, reduced).opacity).toBe(0)
        }
      }
    }
  })
  it('uses prop-free source rows for food and drinks, bounded body frames throughout', () => {
    for (const item of ITEMS) {
      const motion = getItemMotion(item.id)
      for (let elapsed = 0; elapsed < motion.duration; elapsed += 17) {
        const body = sampleRamPose(motion.action, elapsed)
        const seed = sampleSeedPose(motion.action, elapsed)
        expect(body.frame).toBeGreaterThanOrEqual(0)
        expect(body.frame).toBeLessThan(16)
        expect(seed.frame).toBeGreaterThanOrEqual(0)
        expect(seed.frame).toBeLessThanOrEqual(24)
        if (item.category === 'food' || item.category === 'drink') expect(body.sheet).toBe('item')
      }
    }
  })
  it('brushes with repeated short mouth strokes, separately from face wash and bath', () => {
    const brush = getItemMotion('180024'), bath = getItemMotion('180003'), face = getItemMotion('180009')
    expect(brush.gesture).toBe('brush')
    const samples = Array.from({ length: 60 }, (_, i) => sampleItemMotion(brush, brush.duration * (.16 + i * .01)))
    expect(Math.max(...samples.map(p => p.x)) - Math.min(...samples.map(p => p.x))).toBeGreaterThan(9)
    expect(samples.every(p => Math.abs(p.y) < 2)).toBe(true)
    expect(new Set([brush.action, bath.action, face.action]).size).toBe(3)
    expect(sampleItemMotion(bath, 1200).x).toBe(sampleItemMotion(bath, 2000).x)
    expect(sampleItemMotion(face, 1200).x).not.toBe(sampleItemMotion(face, 2000).x)
  })
  it('distinguishes milk tilting, juice sipping, cola fizz and squeezed fruit', () => {
    const drinks = ['180002', 'juice', '180014', '180028'].map(getItemMotion)
    expect(new Set(drinks.map(m => m.gesture)).size).toBe(4)
    const angles = drinks.map(m => Math.min(...Array.from({ length: 50 }, (_, i) => sampleItemMotion(m, m.duration * (.16 + i * .01)).angle)))
    expect(Math.abs(angles[0])).toBeGreaterThan(Math.abs(angles[1]) + 20)
    const squeezed = getItemMotion('180028')
    expect(Math.min(...Array.from({ length: 50 }, (_, i) => sampleItemMotion(squeezed, squeezed.duration * (.16 + i * .01)).scaleX))).toBeLessThan(.8)
  })
  it('retains item identity in reduced motion without moving its tool', () => {
    for (const item of ITEMS) {
      const motion = getItemMotion(item.id)
      const first = sampleItemMotion(motion, 500, true), last = sampleItemMotion(motion, motion.duration - 1, true)
      expect([first.x, first.y, first.angle, first.scaleX, first.scaleY, first.opacity]).toEqual([last.x, last.y, last.angle, last.scaleX, last.scaleY, last.opacity])
      expect(first.opacity).toBe(1)
    }
  })
})


it('changes body colour only after the sip and finishes the blend before the bottle leaves',()=>{
 const motion=getItemMotion('recolor-blue');expect(motion.gesture).toBe('recolor');expect(colorBlend(motion.duration*.3,motion.duration)).toBe(0);expect(colorBlend(motion.duration*.51,motion.duration)).toBeCloseTo(.5,5);expect(colorBlend(motion.duration*.7,motion.duration)).toBe(1);expect(colorBlend(0,motion.duration,true)).toBe(1);
});

it('plays the body timeline forward once while props keep their individual beats',()=>{
 for(const item of ITEMS){const motion=getItemMotion(item.id);let previous=0;for(let t=0;t<motion.duration;t+=16){const frame=sampleItemMotion(motion,t).bodyFrame;expect(frame,`${item.id} at ${t}ms`).toBeGreaterThanOrEqual(previous);previous=frame}}
});
