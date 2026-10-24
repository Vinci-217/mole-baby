import {describe,it,expect} from 'vitest'
import {createPet,parseSave} from './game'
import {claimDailyCheckIn,checkedInToday,localDay} from './daily-check-in'

const NOW=new Date(2026,9,24,12).getTime()
const pet=()=>({...createPet('小叶','blue',NOW-86400000),lastTick:NOW,growth:180})
describe('daily local-calendar beans',()=>{
  it('awards exactly 1000 once, including rapid repeated clicks and reloads',()=>{
    const first=claimDailyCheckIn(pet(),NOW);expect(first.ok).toBe(true);expect(first.state.coins).toBe(1100)
    expect(first.state.stats).toEqual(pet().stats);expect(first.state.growth).toBe(180)
    expect(claimDailyCheckIn(first.state,NOW).state).toBe(first.state)
    const restored=parseSave(JSON.stringify(first.state),NOW)!;expect(checkedInToday(restored,NOW)).toBe(true)
    expect(claimDailyCheckIn(restored,NOW+1000).ok).toBe(false)
  })
  it('uses the next local midnight, continues consecutive days and resets a skipped streak',()=>{
    const first=claimDailyCheckIn(pet(),NOW).state
    const tomorrow=new Date(2026,9,25,0,0,0).getTime()
    expect(claimDailyCheckIn(first,tomorrow-1).ok).toBe(false)
    const second=claimDailyCheckIn(first,tomorrow).state;expect(second.checkIn).toMatchObject({day:localDay(tomorrow),streak:2,total:2});expect(second.coins).toBe(2100)
    const skipped=claimDailyCheckIn(second,new Date(2026,9,27,0).getTime()).state
    expect(skipped.checkIn).toMatchObject({streak:1,total:3});expect(skipped.coins).toBe(3100)
  })
  it('does not reopen a claim when the clock goes backwards and preserves a sleeping pet',()=>{
    const first=claimDailyCheckIn({...pet(),sleeping:true},NOW).state;expect(first.sleeping).toBe(true)
    expect(claimDailyCheckIn(first,NOW-86400000).ok).toBe(false)
    expect(checkedInToday(first,NOW-86400000)).toBe(true)
  })
  it('does not consume the reward when the bean bag cannot hold all 1000',()=>{
    const full={...pet(),coins:999999500};expect(claimDailyCheckIn(full,NOW)).toMatchObject({ok:false,state:full})
    expect(claimDailyCheckIn({...full,coins:999999000},NOW).state.coins).toBe(1000000000)
  })
  it('migrates old saves and discards corrupt optional claim data without losing the pet',()=>{
    for(const checkIn of [undefined,{day:'2026-99-99',claimedAt:NOW,streak:1,total:1},{day:localDay(NOW),claimedAt:NOW,streak:-1,total:1}]){
      const restored=parseSave(JSON.stringify({...pet(),checkIn}),NOW)!;expect(restored.name).toBe('小叶');expect(restored.checkIn).toBeUndefined();expect(restored.coins).toBe(100)
    }
  })
})
