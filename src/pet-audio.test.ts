import {afterEach,describe,expect,it,vi} from 'vitest';
import {configurePetSound,playGameSound} from './pet-audio';
afterEach(()=>{vi.unstubAllGlobals();vi.resetModules()});
describe('independent game mute',()=>{
 it('allows gameplay with interaction sounds muted and immediately stops playback on game mute',()=>{
  vi.stubGlobal('document',{hidden:false});const voices:{pause:ReturnType<typeof vi.fn>}[]=[];
  vi.stubGlobal('Audio',class{volume=0;pause=vi.fn();play=vi.fn(()=>Promise.resolve());removeAttribute(){}load(){}addEventListener(){}removeEventListener(){}constructor(){voices.push(this)}});
  configurePetSound({enabled:false,gameEnabled:true,volume:.4});playGameSound('start',true);expect(voices).toHaveLength(1);
  configurePetSound({enabled:true,gameEnabled:false,volume:.4});expect(voices[0].pause).toHaveBeenCalledOnce();
  playGameSound('match',true);expect(voices).toHaveLength(1);
 });
});
