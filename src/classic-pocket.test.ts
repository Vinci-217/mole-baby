import { describe, expect, it } from 'vitest';
import { createPet, ITEMS } from './game';
import { CLASSIC_PAGE_SIZE, categoryAction, itemUseReason, pocketItems } from './classic-pocket';

describe('original twelve-slot inventory',()=>{
  it('only lists owned items, in a stable catalog order, and retains a consumed selection',()=>{
    const pet=createPet('小红','red',1000);pet.inventory={[ITEMS[14].id]:2,[ITEMS[0].id]:1};
    expect(CLASSIC_PAGE_SIZE).toBe(12);
    expect(pocketItems(pet).map(i=>i.id)).toEqual([ITEMS[0].id,ITEMS[14].id]);
    pet.inventory[ITEMS[0].id]=0;
    expect(pocketItems(pet,ITEMS[0].id).map(i=>i.id)).toEqual([ITEMS[0].id,ITEMS[14].id]);
    expect(pocketItems(pet).map(i=>i.id)).toEqual([ITEMS[14].id]);
    expect(pocketItems(pet,'fake-item').map(i=>i.id)).toEqual([ITEMS[14].id]);
  });
  it('validates sleep, in-flight actions, ownership, stage and colour before drag/double-click use',()=>{
    const pet=createPet('小红','red',1000),item=ITEMS.find(i=>i.minStage===2)!;
    expect(itemUseReason(pet,item,false)).toBe('已经用完啦');pet.inventory[item.id]=1;
    expect(itemUseReason(pet,item,false)).toBe('中级可用');pet.growth=180;
    expect(itemUseReason(pet,item,false)).toBeNull();
    expect(itemUseReason(pet,item,true)).toBe('正在照料…');pet.sleeping=true;
    expect(itemUseReason(pet,item,false)).toBe('先叫醒拉姆');pet.sleeping=false;
    const color=ITEMS.find(i=>i.changesColor==='red')!;pet.inventory[color.id]=1;
    expect(itemUseReason(pet,color,false)).toBe('已经是这个颜色');
    expect(['food','drink','clean','medicine'].map(v=>categoryAction(v as 'food'))).toEqual(['feed','drink','wash','use']);
  });
});
