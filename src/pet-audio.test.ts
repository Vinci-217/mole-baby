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

it('resumes sound on later frames after pausing without repeating a cue',async()=>{
 const {configurePetSound,createPetSoundClock}=await import('./pet-audio');
 configurePetSound({enabled:true,gameEnabled:false,volume:.4});
 const start=vi.fn(),disconnect=vi.fn();
 const param=()=>({value:0,setValueAtTime:vi.fn(),exponentialRampToValueAtTime:vi.fn(),cancelScheduledValues:vi.fn()});
 vi.stubGlobal('document',{hidden:false});
 vi.stubGlobal('AudioContext',class {
  currentTime=0;destination={};resume=async()=>{};
  createGain(){return {gain:param(),connect:vi.fn(),disconnect};}
  createOscillator(){return {frequency:param(),connect:vi.fn(),start,stop:vi.fn()};}
 });
 const cues=[0,250,500].map(at=>({at,kind:'ball' as const,strength:1}));
 const clock=createPetSoundClock({cues},true);
 clock.tick(0);
 clock.pause();
 clock.tick(0);
 expect(start).toHaveBeenCalledTimes(1);
 expect(disconnect).toHaveBeenCalledTimes(1);
 clock.tick(250);
 clock.stop();
 clock.tick(500);
 expect(start).toHaveBeenCalledTimes(2);
});
