import { describe, expect, it } from 'vitest'
import sharp from 'sharp'
import { bodyFrameRegistration } from './frame-registration'

/** Inspect the real source masks so an exporter change can invalidate these
 * calibrations instead of leaving a passing test of constants alone. */
async function inkBounds(form: string, directory: string, row = 0) {
  const { data, info } = await sharp(`public/assets/${directory}/${form}-mask.png`).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  let left = 192, top = 208, right = 0, bottom = 0
  for (let y = 0; y < 208; y++) for (let x = 0; x < 192; x++) {
    const offset = ((row * 208 + y) * info.width + x) * 4
    if (data[offset + 3] <= 40 || data[offset] + data[offset + 1] + data[offset + 2] <= 40) continue
    left = Math.min(left, x); top = Math.min(top, y)
    right = Math.max(right, x); bottom = Math.max(bottom, y)
  }
  return { left, top, right, bottom }
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

  it('keeps both walking directions at their form’s front-body height, center and baseline', async () => {
    for (const form of ['junior', 'middle']) {
      const front = await inkBounds(form, 'classic')
      for (const row of [1, 2]) {
        const side = await inkBounds(form, 'classic', row)
        const registration = bodyFrameRegistration(form, 'classic', row)
        expect(registration.scaleX).toBe(registration.scaleY)
        const height = (side.bottom - side.top) * registration.scaleY
        expect(Math.abs(height - (front.bottom - front.top))).toBeLessThanOrEqual(1.1)
        const center = (side.left + side.right) / 2 * registration.scaleX + registration.x
        expect(Math.abs(center - (front.left + front.right) / 2)).toBeLessThanOrEqual(.6)
        expect(Math.abs(side.bottom * registration.scaleY + registration.y - front.bottom)).toBeLessThanOrEqual(1.1)
      }
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
