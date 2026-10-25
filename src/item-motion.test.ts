import { describe, expect, it } from 'vitest'
import { ITEMS } from './catalog'
import { getItemMotion, getItemMotionByAction, sampleItemMotion, sampleCareRoutine,careContactFractions,sampleGentleMouth,colorBlend } from './item-motion'
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
  it('shares one clean routine and one bottle routine while retaining inventory identities',()=>{
    for(const category of ['food','drink','clean'] as const){const motions=ITEMS.filter(i=>i.category===category).map(i=>getItemMotion(i.id)),first=motions[0];for(const motion of motions){expect(motion.duration).toBe(first.duration);expect(careContactFractions(motion)).toEqual(careContactFractions(first));for(const t of [0,500,1500,2500])expect(sampleItemMotion(motion,t)).toEqual(sampleItemMotion(first,t))}}
  })
  it('lands all four bites on a plate before guiding each into the mouth on its audio contact',()=>{
    const m=getItemMotion('biscuit'),mouth=[50,63] as const
    const rain=sampleCareRoutine(m,m.duration*.15,mouth),rest=sampleCareRoutine(m,m.duration*.32,mouth)
    expect(rain.pieces[0].y).toBeLessThan(rest.pieces[0].y);expect(rest.pieces.every(p=>p.opacity===1)).toBe(true)
    for(const [i,at]of careContactFractions(m).entries()){const p=sampleCareRoutine(m,m.duration*at,mouth).pieces[i];expect(p.x).toBeCloseTo(mouth[0]);expect(p.y).toBeCloseTo(mouth[1]);expect(p.scale).toBeLessThan(.4)}
    expect(sampleCareRoutine(m,m.duration,mouth).pieces.every(p=>p.opacity===0)).toBe(true)
  })
  it('drains a shared bottle while sucking and tosses it only after the last swallow',()=>{
    const m=getItemMotion('juice'),mouth=[50,63]as const,full=sampleCareRoutine(m,400,mouth),sip=sampleCareRoutine(m,2800,mouth),toss=sampleCareRoutine(m,3800,mouth)
    expect(full.milk).toBe(1);expect(sip.milk).toBeLessThan(.1);expect(sip.bottleX).toBe(mouth[0]);expect(toss.bottleX).toBeGreaterThan(mouth[0]+20);expect(toss.bottleAngle).toBeGreaterThan(sip.bottleAngle+40)
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


it('opens the original tiny mouth just before the same contacts used by food and drinking',()=>{
 for(const id of ['biscuit','juice','180002','recolor-blue']){const motion=getItemMotion(id);for(const t of [0,motion.duration,motion.duration*.95])expect(sampleGentleMouth(motion,t)).toBe(0);expect(sampleGentleMouth(motion,motion.duration*.5,true)).toBe(0);for(const at of careContactFractions(motion)){expect(sampleGentleMouth(motion,motion.duration*(at-.0275))).toBe(7);expect(sampleGentleMouth(motion,motion.duration*at)).toBe(0)}}
})
it('keeps reduced-motion plates, bites and bottles stationary until completion',()=>{
 for(const id of ['biscuit','juice','180003']){const m=getItemMotion(id),a=sampleCareRoutine(m,0,[50,63],false,true),b=sampleCareRoutine(m,m.duration-1,[50,63],false,true);expect(a.pieces).toEqual(b.pieces);expect(a.trayX).toBe(b.trayX);expect(a.bottleX).toBe(b.bottleX);expect(a.bottleAngle).toBe(b.bottleAngle)}
})
