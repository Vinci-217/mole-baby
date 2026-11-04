import {describe,it,expect} from 'vitest';
import {createPet,parseSave} from './game';
import {buyFurniture,placeFurniture,removeFurniture,placementKey,normalizeRoom,canOwn,FURNITURE,MAX_PLACED_FURNITURE} from './room-furnishings';
import {furnitureArt,furnitureHit} from './furniture-art';
const now=1_700_000_000_000,p=()=>({...createPet('叶叶','blue',now),coins:1000});
describe('independent furniture copies and free layout',()=>{
 it('unlocks a design once and places multiple copies without charging or replacing earlier copies',()=>{
  const bought=buyFurniture(p(),'plant');expect(bought.state.coins).toBe(840);expect(buyFurniture(bought.state,'plant').ok).toBe(false);
  const one=placeFurniture(bought.state,'plant',20,12),two=placeFurniture(one,'plant',70,87);
  expect(two.coins).toBe(840);expect(two.room!.placed).toHaveLength(2);expect(two.room!.placed[0]).toEqual(one.room!.placed[0]);expect(new Set(two.room!.placed.map(placementKey)).size).toBe(2);
 });
 it('allows every owned type anywhere, including wall decorations on open scenes, while respecting unlocks',()=>{
  expect(placeFurniture(p(),'plant',40,32)).toEqual(p());
  const owned=buyFurniture(p(),'plant').state;
  for(const y of [0,15,50,100])expect(placeFurniture(owned,'plant',40,y).room!.placed[0].y).toBe(y);
  expect(placeFurniture(p(),'message-board',2,95).room!.placed).toHaveLength(1);
  expect(canOwn(p(),'certificate-language')).toBe(false);
  const graduate={...p(),education:{lessons:{language:3},graduated:{language:now}}};
  expect(placeFurniture(graduate,'certificate-language',10,85).room!.placed).toHaveLength(1);
 });
 it('moves, scales and removes only the selected instance, and retains the others through a save round trip',()=>{
  const first=placeFurniture(buyFurniture(p(),'plant').state,'plant',40,20),two=placeFurniture(first,'plant',70,75),a=two.room!.placed[0],b=two.room!.placed[1];
  const changed=placeFurniture(two,'plant',12,95,placementKey(a),.42,5);
  expect(changed.room!.placed[0]).toMatchObject({x:12,y:95,scale:.42,order:5});expect(changed.room!.placed[1]).toEqual(b);
  const restored=parseSave(JSON.stringify(changed),now+1)!;expect(restored.room).toEqual(changed.room);expect(restored.createdAt).toBe(two.createdAt);expect(restored.color).toBe(two.color);expect(restored.inventory).toEqual(two.inventory);
  expect(removeFurniture(restored,placementKey(a)).room!.placed).toEqual([b]);
 });
 it('keeps legacy furniture keys and coordinates and permits updates without reinitializing the room',()=>{
  const legacy={...p(),room:{owned:['plant','picture'],placed:[{id:'plant',x:40,y:72},{id:'picture',x:60,y:30}]}};
  const loaded=parseSave(JSON.stringify(legacy),now)!;expect(loaded.room).toEqual(legacy.room);
  const changed=placeFurniture(loaded,'picture',50,80,'picture',.7);expect(changed.room!.placed[0]).toEqual(legacy.room.placed[0]);expect(changed.room!.placed[1]).toEqual({id:'picture',x:50,y:80,scale:.7});
  expect(removeFurniture(changed,'picture').room!.placed).toHaveLength(1);
 });
 it('validates identities and imported numeric bounds without collapsing different copies of the same design',()=>{
  const room=normalizeRoom({owned:['plant','plant','unknown'],placed:[{id:'plant',x:500,y:10},{id:'plant',x:30,y:70},{id:'plant',instanceId:'piece-2',x:20,y:30,scale:9},{id:'leaf-clock',x:50,y:90},{id:'plant',instanceId:'piece-2',x:80,y:50},{id:'plant',instanceId:'bad/key',x:40,y:80},{id:'plant',x:NaN,y:NaN}]})!;
  expect(room.owned).toEqual(['plant']);expect(room.placed).toEqual([{id:'plant',x:100,y:10},{id:'plant',instanceId:'piece-2',x:20,y:30,scale:3},{id:'leaf-clock',x:50,y:90}]);
  const bought=buyFurniture(p(),'plant').state;for(const [x,y,scale]of [[NaN,40,1],[40,Infinity,1],[-1,20,1],[10,20,0],[10,20,4]])expect(placeFurniture(bought,'plant',x,y,undefined,scale)).toBe(bought);
  expect(placeFurniture(bought,'plant',20,20,'missing')).toBe(bought);
  const full={...bought,room:{...bought.room!,placed:Array.from({length:MAX_PLACED_FURNITURE},(_,i)=>({id:'plant',instanceId:`piece-${i}`,x:40,y:50}))}};expect(placeFurniture(full,'plant',40,50)).toBe(full);
 });
 it('uses close visible bounds for every artwork and rejects transparent gaps when picking an object',()=>{
  for(const item of FURNITURE){const a=furnitureArt(item.id);expect(a.width).toBeGreaterThan(0);expect(a.height).toBeGreaterThan(0);expect(a.left+a.width).toBeLessThanOrEqual(a.imageWidth);expect(a.top+a.height).toBeLessThanOrEqual(a.imageHeight);expect(a.mask).toHaveLength(32)}
  const a=furnitureArt('original-160221'),cells=Array.from({length:1024},(_,n)=>({x:(n%32+.5)/32,y:(Math.floor(n/32)+.5)/32}));
  expect(cells.some(c=>furnitureHit('original-160221',c.x,c.y))).toBe(true);expect(cells.some(c=>!furnitureHit('original-160221',c.x,c.y))).toBe(true);expect(a.mask.some(row=>row!=='ffffffff')).toBe(true);
  expect(furnitureHit('plant',-1,.5)).toBe(false);expect(furnitureHit('plant',.5,1.1)).toBe(false);
 });
});
