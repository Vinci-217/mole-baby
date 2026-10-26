import {describe,it,expect} from 'vitest'
import {createPet,parseSave} from './game'
import {buyFurniture,placeFurniture,normalizeRoom,canOwn,hasRoomWall} from './room-furnishings'
const now=1_700_000_000_000,p=()=>({...createPet('叶叶','blue',now),coins:1000})
describe('wall and floor placement',()=>{
 it('does not invent walls in the picnic ground or open observatory',()=>{expect(hasRoomWall('berry-picnic')).toBe(false);expect(hasRoomWall('sky-observatory')).toBe(false);expect(hasRoomWall('morning')).toBe(true)})
 it('charges once and preserves ownership',()=>{const r=buyFurniture(p(),'plant');expect(r.state.coins).toBe(840);expect(buyFurniture(r.state,'plant').ok).toBe(false)})
 it('only places owned furniture on its allowed surface',()=>{
  const pet=buyFurniture(p(),'plant').state;expect(placeFurniture(pet,'plant',40,32)).toBe(pet);expect(placeFurniture(pet,'plant',40,72).room!.placed).toHaveLength(1);expect(placeFurniture(p(),'plant',40,72).room).toBeUndefined()
 })
 it('keeps certificates on walls and requires graduation',()=>{
  const pet={...p(),education:{lessons:{language:3},graduated:{language:now}}};expect(canOwn(p(),'certificate-language')).toBe(false);expect(canOwn(pet,'certificate-language')).toBe(true)
  expect(placeFurniture(pet,'certificate-language',40,72)).toBe(pet);expect(placeFurniture(pet,'certificate-language',40,32).room!.placed).toHaveLength(1)
 })
 it('clamps imported items to their surface and rejects duplicates/invalid positions',()=>{
  const room=normalizeRoom({owned:['plant','plant','unknown'],placed:[{id:'plant',x:500,y:10},{id:'plant',x:30,y:70},{id:'leaf-clock',x:50,y:90},{id:'plant',x:NaN,y:NaN}]})!
  expect(room.owned).toEqual(['plant']);expect(room.placed).toEqual([{id:'plant',x:90,y:66},{id:'leaf-clock',x:50,y:40}])
 })
 it('preserves purchased objects and placement through export/import',()=>{
  const pet=placeFurniture(buyFurniture(p(),'plant').state,'plant',70,74),saved=parseSave(JSON.stringify(pet),now+1)!
  expect(saved.room).toEqual(pet.room)
 })
})
