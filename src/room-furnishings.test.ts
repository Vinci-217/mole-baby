import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {createPet,parseSave} from './game';
import {buyFurniture,placeFurniture,duplicateFurniture,removeFurniture,placementKey,normalizeRoom,canOwn,isRoomInteractiveFurniture,hasPlacedMusicBox,MAX_PLACED_FURNITURE,MUSIC_BOX_ID} from './room-furnishings';
import {furnitureById,furnitureImage,furniturePixelWidth,FURNITURE} from './furniture-catalog';
import {roomFurnitureAction} from './room-furniture-actions';
import {RAM_BOOKS,READING_SHELF_ID} from './reading-books';
import {FURNITURE_PRICE} from './economy';
import {furnitureArt,furnitureHit} from './furniture-art';
const now=1_700_000_000_000,p=()=>({...createPet('叶叶','blue',now),coins:1000});
describe('independent furniture copies and free layout',()=>{
 it('unlocks a design once and places multiple copies without charging or replacing earlier copies',()=>{
  const bought=buyFurniture(p(),'plant');expect(bought.state.coins).toBe(920);expect(buyFurniture(bought.state,'plant').ok).toBe(false);
  const one=placeFurniture(bought.state,'plant',20,12),two=placeFurniture(one,'plant',70,87);
  expect(two.coins).toBe(920);expect(two.room!.placed).toHaveLength(2);expect(two.room!.placed[0]).toEqual(one.room!.placed[0]);expect(new Set(two.room!.placed.map(placementKey)).size).toBe(2);
 });
 it('duplicates a placed piece with its size and contents, and returns just that copy to storage',()=>{
  const original={id:READING_SHELF_ID,x:100,y:5,scale:1.4,order:7,shelfPage:1};
  const saved={...p(),room:{owned:[],placed:[original]}};
  const duplicated=duplicateFurniture(saved,READING_SHELF_ID);
  const [first,copy]=duplicated.room!.placed;
  expect(first).toEqual(original);
  expect(copy).toMatchObject({id:READING_SHELF_ID,x:94,y:9,scale:1.4,order:8,shelfPage:1});
  expect(placementKey(copy)).not.toBe(placementKey(first));
  expect(duplicated.coins).toBe(saved.coins);
  expect(removeFurniture(duplicated,placementKey(copy)).room).toEqual(saved.room);
 });
 it('keeps the room intact when a duplicate cannot be placed',()=>{
  const occupied=Array.from({length:MAX_PLACED_FURNITURE},(_,i)=>({id:'plant',instanceId:`piece-${i}`,x:50,y:56}));
  const saved={...p(),room:{owned:['plant'],placed:occupied}};
  expect(duplicateFurniture(saved,'piece-0')).toBe(saved);
  expect(duplicateFurniture(saved,'missing-piece')).toBe(saved);
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
 it('requires purchasing and placing the music box and drops only unowned legacy boxes',()=>{
  const initial=p(),legacy={...initial,room:{owned:[],placed:[{id:MUSIC_BOX_ID,x:72,y:65},{id:'message-board',x:5,y:40}]}},
   restored=parseSave(JSON.stringify(legacy),now)!;
  expect(restored.room?.placed).toEqual([{id:'message-board',x:5,y:40}]);
  expect(canOwn(initial,MUSIC_BOX_ID)).toBe(false);
  expect(hasPlacedMusicBox(restored)).toBe(false);
  expect(placeFurniture(restored,MUSIC_BOX_ID,72,65)).toBe(restored);
  expect(buyFurniture({...restored,coins:0},MUSIC_BOX_ID).ok).toBe(false);
  const purchase=buyFurniture(restored,MUSIC_BOX_ID);
  expect(purchase.ok).toBe(true);
  expect(purchase.state.coins).toBe(initial.coins-FURNITURE_PRICE);
  expect(hasPlacedMusicBox(purchase.state)).toBe(false);
  const musicBox=placeFurniture(purchase.state,MUSIC_BOX_ID,72,65);
  const saved=parseSave(JSON.stringify(musicBox),now)!;
  const piece=saved.room?.placed.find(piece=>piece.id===MUSIC_BOX_ID)!;
  expect(piece).toMatchObject({x:72,y:65});
  expect(furnitureById(MUSIC_BOX_ID)).toMatchObject({price:FURNITURE_PRICE,sourceId:'160169'});
  expect(saved.coins).toBe(purchase.state.coins);
  expect(hasPlacedMusicBox(saved)).toBe(true);
  expect(hasPlacedMusicBox(removeFurniture(saved,placementKey(piece)))).toBe(false);
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
 it('reopens a large valid room with its notes, reading progress and furniture intact',()=>{
  const ids=FURNITURE.map(item=>item.id);
  const room={owned:ids,placed:ids.slice(0,MAX_PLACED_FURNITURE).map((id,index)=>({
   id,instanceId:`room-piece-${index}`.padEnd(100,'x'),x:50.12345678901234,y:60.23456789123456,scale:1.15,order:index,
  }))};
  const notes=Array.from({length:40},(_,index)=>({id:`note-${index}`,text:'叶'.repeat(240),reply:'好'.repeat(240),createdAt:now,done:false}));
  const statHistory=Array.from({length:40},()=>({at:now,reason:'日'.repeat(100),delta:{hunger:-1,thirst:-1,happiness:1,cleanliness:-1,health:-1,energy:-1}}));
  const reading={pages:Object.fromEntries(RAM_BOOKS.map(book=>[book.id,book.pages.length-1]))};
  const save=JSON.stringify({...p(),room,notes,statHistory,reading});
  expect(save.length).toBeGreaterThan(100_000);
  expect(parseSave(save,now)).toMatchObject({room,notes,statHistory,reading});
 });
 it('places archived small-house and garden designs through the existing warehouse and save workflow',()=>{
  const chair='original-160002', garden='original-1220005', wall='original-160012';
  expect(furnitureById(chair)).toMatchObject({name:'木制方椅',originalArea:'house',surface:'floor'});
  expect(furnitureById(garden)).toMatchObject({name:'树根木椅',originalArea:'garden',surface:'floor'});
  expect(furnitureById(wall)).toMatchObject({name:'绿色蘑菇壁灯',surface:'wall'});
  expect(furniturePixelWidth(chair)).toBeCloseTo(furnitureById(chair)!.pixelWidth!*.68);
  let pet=p();
  for(const id of [chair,garden,wall]){
   pet=placeFurniture(buyFurniture(pet,id).state,id,40,65);
  }
  expect(pet.room?.placed.map(piece=>piece.id)).toEqual([chair,garden,wall]);
  expect(parseSave(JSON.stringify(pet),now)?.room).toEqual(pet.room);
  expect(buyFurniture(pet,'original-161447').ok).toBe(false);
  expect(furnitureById('original-1220429')).toBeUndefined();
 });
 it('validates identities and imported numeric bounds without collapsing different copies of the same design',()=>{
  const room=normalizeRoom({owned:['plant','plant','unknown'],placed:[{id:'plant',x:500,y:10},{id:'plant',x:30,y:70},{id:'plant',instanceId:'piece-2',x:20,y:30,scale:9},{id:'leaf-clock',x:50,y:90},{id:'plant',instanceId:'piece-2',x:80,y:50},{id:'plant',instanceId:'bad/key',x:40,y:80},{id:'plant',x:NaN,y:NaN}]})!;
  expect(room.owned).toEqual(['plant']);expect(room.placed).toEqual([{id:'plant',x:100,y:10},{id:'plant',instanceId:'piece-2',x:20,y:30,scale:3},{id:'leaf-clock',x:50,y:90}]);
  const bought=buyFurniture(p(),'plant').state;for(const [x,y,scale]of [[NaN,40,1],[40,Infinity,1],[-1,20,1],[10,20,0],[10,20,4]])expect(placeFurniture(bought,'plant',x,y,undefined,scale)).toBe(bought);
  expect(placeFurniture(bought,'plant',20,20,'missing')).toBe(bought);
  const full={...bought,room:{...bought.room!,placed:Array.from({length:MAX_PLACED_FURNITURE},(_,i)=>({id:'plant',instanceId:`piece-${i}`,x:40,y:50}))}};expect(placeFurniture(full,'plant',40,50)).toBe(full);
 });
 it('uses close visible bounds for every artwork and rejects transparent gaps when picking an object',()=>{
  const source=JSON.parse(readFileSync('public/assets/original/furniture/bounds.json','utf8'));
  source['reading-shelf']=JSON.parse(readFileSync('public/assets/original/reading-books/shelf-bounds.json','utf8'));
  for(const item of FURNITURE){
   const a=furnitureArt(item.id);
   expect(a.width).toBeGreaterThan(0);expect(a.height).toBeGreaterThan(0);
   expect(a.left+a.width).toBeLessThanOrEqual(a.imageWidth);expect(a.top+a.height).toBeLessThanOrEqual(a.imageHeight);
   expect(Buffer.from(a.mask!,'base64').toString('hex')).toBe(source[item.id].mask.join(''));
  }
  const id='original-160221';
  for(let row=0;row<32;row++)for(let column=0;column<32;column++){
   const hit=Boolean(parseInt(source[id].mask[row],16)&(1<<column));
   expect(furnitureHit(id,(column+.5)/32,(row+.5)/32)).toBe(hit);
  }
  expect(furnitureHit('plant',-1,.5)).toBe(false);expect(furnitureHit('plant',.5,1.1)).toBe(false);
 });
 it('activates archived pet furniture using its saved placement and normal ownership',()=>{
  const swing='original-160206';
  expect(isRoomInteractiveFurniture(swing)).toBe(true);
  expect(canOwn(p(),swing)).toBe(false);
  expect(placeFurniture(p(),swing,50,60)).toEqual(p());
  const first=placeFurniture(buyFurniture(p(),swing).state,swing,50,60);
  expect(parseSave(JSON.stringify(first),now)?.room).toEqual(first.room);
  expect(furnitureImage(swing)).toBe('./assets/original/furniture-actions/160206/idle.webp');
  const clip=roomFurnitureAction(swing)!;
  expect(clip.frames).toBe(38);
  expect(clip.durationMs).toBeGreaterThan(0);
  expect(roomFurnitureAction('original-160688')).toBeUndefined();
 });
});
