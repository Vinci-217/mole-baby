import {describe,it,expect} from 'vitest'
import {createPet,parseSave,care,buyItem,changePetStage,tick} from './game'
import {mixColour,colourRecipe,brewColourPotion} from './color-mixing'
import {customPotionId,petColorOffsets,MAX_CUSTOM_POTION_COLORS} from './pet-color'
const NOW=1800000000000
const pet=()=>createPet('小调色师','red',NOW)
describe('original RGB mixing adapted to bottled pet colours',()=>{
 it('mixes exact RGB including black and white, and rejects invalid values',()=>{
  expect(mixColour([0,127,255])).toBe('#007fff');expect(mixColour([0,0,0])).toBe('#000000');expect(mixColour([255,255,255])).toBe('#ffffff');expect(colourRecipe('#38A0FA')).toEqual([56,160,250]);expect(colourRecipe('javascript:alert(1)')).toBeNull()
  for(const recipe of [[-1,0,0],[256,0,0],[1.2,0,0],[NaN,0,0]])expect(()=>mixColour(recipe as [number,number,number])).toThrow()
 })
 it('bottles a colour without changing appearance or awarding coins; consumption changes colour once and persists it',()=>{
  const before=pet(),made=brewColourPotion(before,'#45ba87',NOW),id=customPotionId('#45ba87')
  expect(made.ok).toBe(true);expect(made.state.color).toBe('red');expect(made.state.coins).toBe(before.coins);expect(made.state.growth).toBe(before.growth);expect(made.state.inventory[id]).toBe(1)
  expect(buyItem(before,id).ok).toBe(false)
  const drank=care(made.state,'use',id,NOW);expect(drank.ok).toBe(true);expect(drank.state.color).toBe('#45ba87');expect(drank.state.inventory[id]).toBe(0)
  expect(care(drank.state,'use',id,NOW).ok).toBe(false);const restored=parseSave(JSON.stringify(drank.state),NOW)!;expect(restored.color).toBe('#45ba87')
  const base={...restored,inventory:{...restored.inventory,'recolor-blue':1}};expect(care(base,'use','recolor-blue',NOW).state.color).toBe('blue')
  expect(()=>createPet('还只能选四色','#45ba87',NOW)).toThrow()
 })
 it('stacks the same recipe and bounds distinct colours and forged saves',()=>{
  let p=pet();for(let i=0;i<MAX_CUSTOM_POTION_COLORS;i++)p=brewColourPotion(p,mixColour([i,0,255]),NOW).state
  expect(brewColourPotion(p,'#ffffff',NOW).ok).toBe(false);expect(brewColourPotion(p,'#0000ff',NOW).state.inventory['mix-0000ff']).toBe(2)
  const consumed=care(p,'use','mix-0000ff',NOW).state;expect(brewColourPotion(consumed,'#ffffff',NOW).ok).toBe(true)
  expect(parseSave(JSON.stringify({...p,color:'#bad'}),NOW)).toBeNull();expect(parseSave(JSON.stringify({...p,inventory:{...p.inventory,'mix-<script>':1}}),NOW)).toBeNull()
 })
 it('preserves legacy palettes and supplies bounded custom body offsets',()=>{
  expect(petColorOffsets('red')).toEqual([255,-199,-250]);expect(petColorOffsets('#45ba87')).toEqual([-186,-69,-120]);expect(petColorOffsets('#000000')).toEqual([-255,-255,-255])
 })
 it('keeps a crafted body colour through every growth form, save reload and normal clock ticks',()=>{
  let p=care(brewColourPotion(pet(),'#14ad73',NOW).state,'use','mix-14ad73',NOW).state
  for(const stage of [0,1,2,3,4]as const){
   for(const evolution of stage===4?['super','classic','water','wood','fire']as const:[undefined]){
    p=changePetStage(p,stage,evolution,NOW).state
    expect(parseSave(JSON.stringify(p),NOW)?.color).toBe('#14ad73')
    expect(tick({...p,growthLocked:false},NOW+60000).color).toBe('#14ad73')
   }
  }
 })
})
