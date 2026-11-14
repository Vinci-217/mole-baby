import {expect,it} from 'vitest';
import {draggedRoomPetScale,roomPetMaxScale,roomPetScale} from './room-pet-size';
it('keeps legacy preferences at their original size and bounds invalid values',()=>{
 for(const value of [undefined,null,'2',NaN,Infinity])expect(roomPetScale(value)).toBe(1);
 expect(roomPetScale(.1)).toBe(.5);expect(roomPetScale(20)).toBe(3);
});
it('uses the same proportion and direction from every resize corner',()=>{
 for(const corner of ['nw','ne','sw','se']){
  const dx=150*(corner.includes('e')?1:-1),dy=163*(corner.includes('s')?1:-1);
  expect(draggedRoomPetScale(1,dx,dy,corner)).toBe(2);
  expect(draggedRoomPetScale(1,-dx,-dy,corner)).toBe(.5);
 }
 const limit=roomPetMaxScale(390);expect(limit*150).toBeLessThanOrEqual(366);
 expect(draggedRoomPetScale(1,1500,1630,'se',limit)).toBe(limit);
});
