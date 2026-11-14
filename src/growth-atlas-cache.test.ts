import {expect,it} from 'vitest';
import {growthAtlasKey} from './growth-atlas-cache';
it('keeps every growth stage, palette and base sheet separate',()=>{
 const keys=new Set<string>();
 for(const form of ['seed','junior','middle','senior','classic','super','water','fire','wood']){
  for(const color of ['blue','purple','#9c5fd4'])for(const kind of ['seed','classic','grounded','flight']){
   const key=growthAtlasKey(form,color,kind,1536,1872);expect(key).toBeTruthy();expect(keys.has(key!)).toBe(false);keys.add(key!);
  }
 }
 expect(growthAtlasKey('super','blue','classic',1536,1872)).not.toBe(growthAtlasKey('super','blue','classic',192,208));
});
it('does not persist transient care and toy atlases in the growth cache',()=>{
 for(const kind of ['care','item','football','gentle','emotion-joy','dizzy'])expect(growthAtlasKey('super','blue',kind,1536,1872)).toBeUndefined();
});
