import {describe,it,expect} from 'vitest';
import {createPet} from './game';
import {desktopCondition} from './desktop-condition';

const fresh=()=>({...createPet('小红','red',1800000000000),stats:{hunger:95,thirst:95,cleanliness:95,happiness:95,health:100,energy:95}});
describe('desktop condition beneath the pet name',()=>{
 it('shows the reported low-energy state instead of a reassuring mood',()=>{
  const pet={...fresh(),stats:{hunger:71,thirst:53,cleanliness:30,happiness:74,health:38,energy:27}};
  expect(desktopCondition(pet,'安心陪伴')).toMatchObject({id:'tired',label:'精神不足',attention:true});
  expect(desktopCondition({...pet,stats:{...pet.stats,cleanliness:29.99}},'安心陪伴')).toMatchObject({id:'tired',label:'精神不足 · 需要清洁'});
  expect(desktopCondition({...pet,stats:{...pet.stats,energy:45}},'安心陪伴')).toMatchObject({id:'healthy',label:'安心陪伴'});
 });
 it('prioritizes actual illness and needs over cheerful memories',()=>{
  for(const[key,value,label]of [['health',35,'生病了'],['hunger',29,'肚子饿了'],['thirst',29,'口渴了'],['cleanliness',29,'需要清洁'],['happiness',29,'有点难过']]as const){
   const pet=fresh();pet.stats[key]=value;
   expect(desktopCondition(pet,'心情雀跃')).toMatchObject({label,attention:true});
  }
 });
 it('describes sleep and real activities without pretending the pet is available',()=>{
  const pet=fresh();
  expect(desktopCondition({...pet,sleeping:true},'安心陪伴').id).toBe('sleeping');
  const activity={id:'lesson',kind:'course' as const,course:'language' as const,startedAt:pet.createdAt,endsAt:pet.createdAt+180000};
  expect(desktopCondition({...pet,activity},'安心陪伴').label).toBe('语言课 · 学习中');
  expect(desktopCondition({...pet,activity:{...activity,kind:'restaurant'}},'安心陪伴').label).toBe('餐厅打工中');
 });
});
