import {describe,it,expect} from 'vitest'
import {care,createPet} from './game'
import {careGains} from './care-feedback'
const now=1_800_000_000_000
function use(id:string,stats={}){const pet=createPet('小芽','red',now);Object.assign(pet.stats,stats);pet.inventory[id]=1;return {before:pet,result:care(pet,'use',id,now)}}
describe('actual care gains',()=>{
 it('shows actual capped restoration, without inventing XP',()=>{const {before,result}=use('biscuit',{hunger:94});expect(result.ok).toBe(true);expect(careGains(before,result.state,'biscuit').map(g=>[g.key,g.amount])).toEqual([['hunger',6]]);expect(result.state.growth).toBe(before.growth)})
 it('lists every restored need of a multi-effect item in status order',()=>{const {before,result}=use('180005',{hunger:90,thirst:85,cleanliness:97,happiness:50,health:10});expect(careGains(before,result.state,'180005').map(g=>[g.key,g.amount])).toEqual([['hunger',10],['thirst',15],['cleanliness',3],['happiness',20],['health',90]])})
 it('omits full or unchanged stats and never attaches gains to another pet',()=>{const {before,result}=use('biscuit',{hunger:100});expect(careGains(before,result.state,'biscuit')).toEqual([]);expect(careGains(before,{...result.state,createdAt:now+1},'biscuit')).toEqual([]);expect(careGains(before,result.state,'missing')).toEqual([])})
 it('announces the consumed potion colour without a fake numeric reward',()=>{const {before,result}=use('recolor-blue');expect(result.ok).toBe(true);expect(careGains(before,result.state,'recolor-blue')).toEqual([expect.objectContaining({key:'color',label:'变为蓝色'})]);expect(careGains(result.state,result.state,'recolor-blue')).toEqual([])})
})
