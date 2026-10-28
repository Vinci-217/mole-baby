import {describe,it,expect,vi} from 'vitest';
import {createOriginalGameAudio,gameSoundUrl,GAME_SOUND_FILES} from './game-audio';

class Voice extends EventTarget{
 volume=1;play=vi.fn(()=>Promise.resolve());pause=vi.fn();load=vi.fn();removeAttribute=vi.fn();
}
function fixture(){const voices:Voice[]=[],urls:string[]=[];const player=createOriginalGameAudio(url=>{urls.push(url);const v=new Voice();voices.push(v);return v as unknown as HTMLAudioElement});return{voices,urls,player}}
describe('original game recording playback',()=>{
 it('uses only packaged original MP3s and does not create playback while muted',()=>{
  const {player,voices,urls}=fixture();player.configure({enabled:false,volume:.4});player.play('start');expect(voices).toHaveLength(0);
  player.configure({enabled:true,volume:.4});player.play('catch');expect(urls).toEqual(['./assets/original/game-audio/catch.mp3']);expect(voices[0].volume).toBe(.4);
  for(const kind of Object.keys(GAME_SOUND_FILES)as (keyof typeof GAME_SOUND_FILES)[])expect(gameSoundUrl(kind)).toMatch(/^\.\/assets\/original\/game-audio\/[a-z-]+\.mp3$/);
 });
 it('stops active sounds when hidden or muted, without replay on return',()=>{
  const {player,voices}=fixture();player.play('reward');player.configure({enabled:true,volume:.5,hidden:true});expect(voices[0].pause).toHaveBeenCalledOnce();
  player.configure({enabled:true,volume:.5});expect(voices).toHaveLength(1);player.play('match');player.configure({enabled:true,volume:0});expect(voices[1].pause).toHaveBeenCalledOnce();
 });
 it('caps overlap and disposes ended, failed and closed-game playback',async()=>{
  const {player,voices}=fixture();for(let i=0;i<5;i++)player.play('catch');expect(voices[0].pause).toHaveBeenCalledOnce();
  voices[1].dispatchEvent(new Event('ended'));voices[2].dispatchEvent(new Event('error'));player.stop();expect(voices.every(v=>v.pause.mock.calls.length===1)).toBe(true);
  const broken=new Voice();broken.play.mockRejectedValueOnce(Error('blocked'));const failing=createOriginalGameAudio(()=>broken as unknown as HTMLAudioElement);failing.play('hint');await Promise.resolve();expect(broken.pause).toHaveBeenCalledOnce();
 });
});
