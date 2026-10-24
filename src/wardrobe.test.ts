import {describe,it,expect} from 'vitest'
import {createPet,parseSave,changePetStage} from './game'
import {OUTFITS,buyOutfit,wearOutfit,normalizeWardrobe} from './wardrobe'
const NOW=Date.UTC(2026,9,24,8)
const pet=()=>createPet('小叶','blue',NOW)
describe('a real owned wardrobe',()=>{
  it('buys one permanent accessory, charges once and leaves all needs, growth and consumables alone',()=>{
    const before=pet(),result=buyOutfit(before,'party-cap')
    expect(result.ok).toBe(true);expect(result.state.coins).toBe(70);expect(result.state.wardrobe).toEqual(['party-cap']);expect(result.state.wearing).toBeUndefined()
    expect(result.state.stats).toEqual(before.stats);expect(result.state.growth).toBe(before.growth);expect(result.state.inventory).toEqual(before.inventory)
    const again=buyOutfit(result.state,'party-cap');expect(again.ok).toBe(false);expect(again.state).toBe(result.state);expect(before.coins).toBe(100)
  })
  it('rejects unknown, unaffordable and unowned equipment without partial writes',()=>{
    for(const result of [buyOutfit(pet(),'unknown'),buyOutfit({...pet(),coins:29},'party-cap'),wearOutfit(pet(),'party-cap')]){expect(result.ok).toBe(false);expect(result.state.wardrobe).toBeUndefined();expect(result.state.wearing).toBeUndefined()}
  })
  it('wears, swaps and removes owned accessories without consuming them or tinting the pet',()=>{
    let saved=pet()
    for(const item of OUTFITS.slice(0,2))saved=buyOutfit(saved,item.id).state
    saved=wearOutfit(saved,'party-cap').state;expect(saved.wearing).toBe('party-cap');expect(wearOutfit(saved,'party-cap').ok).toBe(false)
    saved=wearOutfit(saved,'gold-feather').state;saved=wearOutfit(saved).state
    expect(saved.wearing).toBeUndefined();expect(saved.wardrobe).toEqual(['party-cap','gold-feather']);expect(saved.color).toBe('blue');expect(saved.coins).toBe(25)
  })
  it('keeps wardrobe and wearing through parsing, backup-style serialization and stage changes',()=>{
    const dressed=wearOutfit(buyOutfit(pet(),'wizard-cap').state,'wizard-cap').state
    for(const stage of [0,1,2,3,4] as const){const changed=changePetStage(dressed,stage,stage===4?'water':undefined,NOW).state;const loaded=parseSave(JSON.stringify(changed),NOW)!;expect(loaded.wearing).toBe('wizard-cap');expect(loaded.wardrobe).toEqual(['wizard-cap']);expect(loaded.name).toBe('小叶');expect(loaded.color).toBe('blue')}
  })
  it('migrates old saves and safely drops unknown/duplicate/unowned imported outfits',()=>{
    expect(parseSave(JSON.stringify(pet()),NOW)?.wardrobe).toBeUndefined()
    expect(normalizeWardrobe(['party-cap','party-cap','unknown'],'wizard-cap')).toEqual({wardrobe:['party-cap']})
    const loaded=parseSave(JSON.stringify({...pet(),wardrobe:['party-cap','unknown'],wearing:'unknown'}),NOW)!
    expect(loaded.wardrobe).toEqual(['party-cap']);expect(loaded.wearing).toBeUndefined();expect(loaded.coins).toBe(100)
    expect(pet().wearing).toBeUndefined()
  })

})
