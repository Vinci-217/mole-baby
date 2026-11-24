import { describe, expect, it } from 'vitest'
import sharp from 'sharp'
import { bodyFrameRegistration, MIDDLE_WALK_RISE } from './frame-registration'

/** Inspect the real source masks so an exporter change can invalidate these
 * calibrations instead of leaving a passing test of constants alone. */
async function inkBounds(form: string, directory: string, row = 0, frame = 0) {
  const { data, info } = await sharp(`public/assets/${directory}/${form}-mask.png`).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  let left = 192, top = 208, right = 0, bottom = 0, area = 0
  for (let y = 0; y < 208; y++) for (let x = 0; x < 192; x++) {
    const offset = ((row * 208 + y) * info.width + frame * 192 + x) * 4
    if (data[offset + 3] <= 40 || data[offset] + data[offset + 1] + data[offset + 2] <= 40) continue
    area++
    left = Math.min(left, x); top = Math.min(top, y)
    right = Math.max(right, x); bottom = Math.max(bottom, y)
  }
  return { left, top, right, bottom, area }
}

describe('fixed body registration across source sheets', () => {
  it('keeps junior calm, eating and sleeping bodies at the front animation height and floor', async () => {
    const front = await inkBounds('junior', 'classic')
    for (const [sheet, directory] of [['grounded', 'grounded'], ['slumber', 'slumber'], ['gentle', 'gentle-care']]) {
      const bounds = await inkBounds('junior', `original/${directory}`)
      const registration = bodyFrameRegistration('junior', sheet)
      expect(bounds.top * registration.scaleY + registration.y).toBeCloseTo(front.top, 0)
      expect(Math.abs(bounds.bottom * registration.scaleY + registration.y - front.bottom)).toBeLessThanOrEqual(1.1)
      expect(registration.scaleX).toBe(1)
      expect(registration.x).toBe(0)
    }
  })

  it('matches the resting body size and preserves the source proportions and floor across each direction', async () => {
    for (const form of ['junior', 'middle']) {
      const front = await inkBounds(form, form==='middle'?'original/grounded':'classic')
      for (const row of [1, 2]) {
        const registration = bodyFrameRegistration(form, 'classic', row)
        const cycle = await Promise.all(Array.from({length:8},(_,frame)=>inkBounds(form,'classic',row,frame)))
        expect(registration.scaleX).toBe(registration.scaleY)
        const frontHeight = front.bottom-front.top
        const heights = cycle.map(side=>(side.bottom-side.top)*registration.scaleY)
        if(form==='middle'){
          const neutral = cycle[0]
          expect(Math.abs(neutral.area * registration.scaleX**2 - front.area)).toBeLessThan(front.area*.01)
          expect(Math.abs(heights[0]-frontHeight)).toBeLessThan(5)
          expect(Math.abs((neutral.right-neutral.left)*registration.scaleX-(front.right-front.left))).toBeLessThan(5)
          expect(Math.max(...heights)/heights[0]).toBeCloseTo(95/50,4)
        }else{
          expect(Math.abs(Math.max(...heights)-frontHeight)).toBeLessThanOrEqual(2)
          expect(Math.min(...heights)).toBeLessThan(frontHeight*.85)
        }
        const floor = Math.max(...cycle.map(side=>side.bottom*registration.scaleY+registration.y))
        expect(Math.abs(floor-front.bottom)).toBeLessThanOrEqual(1.1)
        // A leap may rise, but neither direction can sink below the floor.
        for(const side of cycle)expect(side.bottom*registration.scaleY+registration.y).toBeLessThanOrEqual(front.bottom+1.1)
      }
    }
    const {data,info}=await sharp('public/assets/classic/middle-neutral.png').ensureAlpha().raw().toBuffer({resolveWithObject:true})
    for (const row of [1, 2]) {
      let top=208
      for (let y=0;y<208;y++) for (let x=0;x<192*8;x++) {
        if(data[((row*208+y)*info.width+x)*4+3]>10) top=Math.min(top,y)
      }
      const fit=bodyFrameRegistration('middle','classic',row)
      expect((171-(top*fit.scaleY+fit.y))/208).toBeLessThanOrEqual(MIDDLE_WALK_RISE+1e-6)
    }
  })

  it('leaves source performances and other growth forms registered as authored', () => {
    for (const form of ['seed', 'senior', 'super', 'water', 'wood', 'fire']) {
      for (const sheet of ['classic', 'grounded', 'slumber', 'gentle']) {
        for (const row of [0, 1, 2]) expect(bodyFrameRegistration(form, sheet, row)).toEqual({ scaleX: 1, scaleY: 1, x: 0, y: 0 })
      }
    }
    for (const form of ['junior', 'middle']) {
      for (const sheet of ['drag', 'affection', 'football', 'emotion-joy', 'emotion-grumpy']) {
        expect(bodyFrameRegistration(form, sheet)).toEqual({ scaleX: 1, scaleY: 1, x: 0, y: 0 })
      }
      expect(bodyFrameRegistration(form, 'classic')).toEqual({ scaleX: 1, scaleY: 1, x: 0, y: 0 })
    }
  })
})
