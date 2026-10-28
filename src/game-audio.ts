/** Archived original-client MP3 streams. Event mapping is our adaptation;
 * recordings are neither synthesized nor re-encoded. See game-audio/sources.json. */
export const GAME_SOUND_FILES={
 flip:'button',match:'match',catch:'catch',move:'tap',perfect:'perfect',
 purchase:'purchase',reward:'reward',start:'start',countdown:'tap',
 miss:'miss',combo:'combo',hint:'hint',pause:'button',resume:'button',mismatch:'mismatch',
} as const;
export type GameSound=keyof typeof GAME_SOUND_FILES;
export const gameSoundUrl=(kind:GameSound)=>`./assets/original/game-audio/${GAME_SOUND_FILES[kind]}.mp3`;

/** Media elements work with packaged file:// URLs on Electron 22 too. Bound
 * polyphony, and dispose playback on mute, hidden windows and game teardown. */
export function createOriginalGameAudio(makeAudio:(url:string)=>HTMLAudioElement){
 let enabled=true,volume=.45;
 const voices=new Map<HTMLAudioElement,()=>void>();
 const stop=()=>{for(const dispose of [...voices.values()])dispose()};
 return {
  configure(next:{enabled:boolean;volume:number;hidden?:boolean}){
   enabled=next.enabled&&!next.hidden;volume=Number.isFinite(next.volume)?Math.max(0,Math.min(1,next.volume)):.45;
   if(!enabled||volume===0){stop();return}
   for(const voice of voices.keys())voice.volume=volume;
  },
  play(kind:GameSound){
   if(!enabled||volume===0)return;
   if(voices.size>=4)voices.values().next().value?.();
   let voice:HTMLAudioElement;
   try{voice=makeAudio(gameSoundUrl(kind))}catch{return}
   let disposed=false;
   const dispose=()=>{
    if(disposed)return;disposed=true;voices.delete(voice);
    voice.removeEventListener('ended',dispose);voice.removeEventListener('error',dispose);
    voice.pause();voice.removeAttribute('src');voice.load();
   };
   voice.volume=volume;voices.set(voice,dispose);
   voice.addEventListener('ended',dispose,{once:true});voice.addEventListener('error',dispose,{once:true});
   try{void voice.play().catch(dispose)}catch{dispose()}
  },
  stop,
 };
}
