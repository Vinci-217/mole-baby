import {describe,it,expect} from 'vitest'
import {ITEMS} from './catalog'
import {getItemMotion} from './item-motion'
import {itemSoundScore,socialSoundScore} from './pet-sound-score'

describe('visible contact and quiet foley',()=>{
 it('keeps every original and adapted item cue inside its finite visible action',()=>{
  for(const item of ITEMS){const motion=getItemMotion(item.id),score=itemSoundScore(motion)
   expect(score.cues.length).toBeGreaterThan(0)
   expect(score.cues.every(c=>Number.isFinite(c.at)&&c.at>0&&c.at<motion.duration&&c.strength>0&&c.strength<=1)).toBe(true)
   expect(score.cues.map(c=>c.at)).toEqual(score.cues.map(c=>c.at).sort((a,b)=>a-b))
   expect(score.loop).toBeUndefined()
  }
 })
 it('distinguishes crisp biscuits, juice, milk, bath, brushing and colour-change accents',()=>{
  const kinds=(id:string)=>itemSoundScore(getItemMotion(id)).cues.map(c=>c.kind)
  expect(kinds('biscuit')).toContain('crunch');expect(kinds('juice')).toContain('sip');expect(kinds('180002')).toContain('gulp')
  expect(kinds('180003')).toEqual(expect.arrayContaining(['water','bubble']));expect(kinds('180024').every(k=>k==='brush')).toBe(true)
  expect(kinds('recolor-blue')).toEqual(expect.arrayContaining(['gulp','magic']))
  expect(new Set(itemSoundScore(getItemMotion('180024')).cues.map(c=>c.at)).size).toBe(12)
 })
 it('places two ball sounds on the actual contacts and only one page turn per reading loop',()=>{
  expect(socialSoundScore('play').cues.map(c=>c.at)).toEqual([1050,3150])
  const book=socialSoundScore('focus');expect(book.loop).toBe(8000);expect(book.cues).toHaveLength(1)
  expect(book.cues[0].at/8000).toBeGreaterThan(.74);expect(book.cues[0].at/8000).toBeLessThan(.94)
  for(const action of ['sleep','idle','look-around','watch-butterfly','drag'])expect(socialSoundScore(action).cues).toEqual([])
 })
})
