import type { Foley, SoundScore } from './pet-sound-score'

export type PetVoice = 'pet' | 'lift' | 'shake' | 'drop' | 'catch' | 'feed' | 'drink' | 'wash' | 'sleep' | 'wake' | 'sick'
let lastVoiceAt = -Infinity, lastEffectAt = -Infinity
let lastKind: PetVoice | null = null, context: AudioContext | null = null
let settings = {enabled: true, volume: .45, speechBusy: false}
const channels = new Set<GainNode>()
const canPlay = (enabled = true) => enabled && settings.enabled && settings.volume > 0 && !settings.speechBusy && !document.hidden && !window.speechSynthesis?.speaking
const level = () => canPlay() ? settings.volume : 0
function syncChannels() { for (const channel of channels) channel.gain.setValueAtTime(level(), channel.context.currentTime) }
export function configurePetSound(next: typeof settings) {
  settings = {...next, volume: Number.isFinite(next.volume) ? Math.max(0,Math.min(1,next.volume)) : .45}
  syncChannels()
}
if (typeof document !== 'undefined') document.addEventListener('visibilitychange', syncChannels)
function audioContext() { if (!context || context.state === 'closed') context = new AudioContext(); return context }
function channel(audio: AudioContext) { const output = audio.createGain(); output.gain.value = level(); output.connect(audio.destination); channels.add(output); return output }
function dispose(output: GainNode) { output.disconnect(); channels.delete(output) }
function envelope(audio: BaseAudioContext, start: number, length: number, gain: number, output: AudioNode) {
  const node = audio.createGain()
  node.gain.setValueAtTime(.0001,start)
  node.gain.exponentialRampToValueAtTime(Math.max(.0001,gain),start+Math.min(.015,length/4))
  node.gain.exponentialRampToValueAtTime(.0001,start+length)
  node.connect(output); return node
}
function note(audio: BaseAudioContext, start: number, length: number, pitch: number, target: number, gain: number, output: AudioNode, type: OscillatorType = 'sine') {
  const source=audio.createOscillator(), amp=envelope(audio,start,length,gain,output)
  source.type=type;source.frequency.setValueAtTime(pitch,start);source.frequency.exponentialRampToValueAtTime(target,start+length)
  source.connect(amp);source.start(start);source.stop(start+length)
  source.onended=()=>{source.disconnect();amp.disconnect()}
}
function rustle(audio: BaseAudioContext, start: number, length: number, frequency: number, gain: number, output: AudioNode) {
  const buffer=audio.createBuffer(1,Math.ceil(audio.sampleRate*length),audio.sampleRate), samples=buffer.getChannelData(0)
  for(let i=0;i<samples.length;i++)samples[i]=(Math.random()*2-1)*.65
  const source=audio.createBufferSource(), filter=audio.createBiquadFilter(), amp=envelope(audio,start,length,gain,output)
  source.buffer=buffer;filter.type='bandpass';filter.frequency.value=frequency;filter.Q.value=1.5
  source.connect(filter);filter.connect(amp);source.start(start);source.stop(start+length)
  source.onended=()=>{source.disconnect();filter.disconnect();amp.disconnect()}
}
/** Program-synthesized foley, not official recordings. Shared by live/offline review. */
export function renderFoley(audio: BaseAudioContext, kind: Foley, at: number, strength: number, output: AudioNode) {
  const n=(length:number,pitch:number,target:number,gain:number)=>note(audio,at,length,pitch,target,gain*strength,output)
  const noise=(length:number,pitch:number,gain:number)=>rustle(audio,at,length,pitch,gain*strength,output)
  switch(kind){
    case 'nibble':noise(.065,1050,.035);n(.08,190,130,.022);break
    case 'crunch':noise(.09,2100,.065);n(.07,170,105,.025);break
    case 'sip':noise(.075,780,.021);n(.12,330,185,.04);break
    case 'gulp':n(.15,255,125,.065);n(.08,440,230,.012);break
    case 'bubble':n(.08,420,970,.035);break
    case 'brush':noise(.065,2450,.045);break
    case 'water':noise(.24,1600,.04);n(.09,780,340,.015);break
    case 'cloth':noise(.11,850,.04);break
    case 'page':noise(.14,1800,.035);break
    case 'ball':n(.11,175,65,.08);break
    case 'magic':n(.25,784,790,.035);note(audio,at+.1,.3,1047,1050,.028*strength,output);break
    case 'voice':n(.16,390,290,.035);n(.2,570,430,.012);break
  }
}
/** A visual-frame clock dispatches each contact once. Never queues future care
 * sounds: cancel, hidden windows and delayed frames cannot produce a burst. */
export function createPetSoundClock(score: SoundScore, enabled: boolean) {
  let previous=-1, output: GainNode | null=null, stopped=false
  return {
    tick(elapsed: number) {
      if(stopped||!Number.isFinite(elapsed)||elapsed<previous)return
      const cycle=score.loop?Math.floor(elapsed/score.loop):0
      const due=score.cues.filter(cue=>{const at=cue.at+cycle*(score.loop??0);return at>previous&&at<=elapsed&&elapsed-at<=120})
      previous=elapsed
      if(!due.length||!canPlay(enabled))return
      try {const audio=audioContext();void audio.resume().catch(()=>{});output??=channel(audio);for(const cue of due)renderFoley(audio,cue.kind,audio.currentTime,cue.strength,output)}catch{/* Optional audio device. */}
    },
    stop(){stopped=true;if(output)dispose(output);output=null},
  }
}
function oneShot(play:(audio:AudioContext,output:GainNode)=>void) {
  try{const audio=audioContext();void audio.resume().catch(()=>{});const output=channel(audio);play(audio,output);setTimeout(()=>dispose(output),1200)}catch{/* Sound never blocks care. */}
}
/** Speech (including native speech) takes priority over every pet effect. */
export function playPetVoice(kind: PetVoice, enabled: boolean) {
  const now=performance.now()
  if(!canPlay(enabled)||now-lastVoiceAt<(lastKind===kind?700:180))return
  lastVoiceAt=now;lastKind=kind
  oneShot((audio,output)=>{
    const at=audio.currentTime
    if(['feed','drink','wash'].includes(kind)){renderFoley(audio,kind==='feed'?'nibble':kind==='drink'?'sip':'bubble',at,.7,output);return}
    if(kind==='sleep'){rustle(audio,at,.55,480,.018,output);return}
    const pitch=kind==='sick'?210:kind==='shake'?290:kind==='lift'?350:kind==='wake'?330:270
    note(audio,at,.16,pitch,pitch*.85,.038,output)
    note(audio,at+.14,.18,pitch*1.18,pitch*1.04,.025,output)
  })
}
export function playGameSound(kind: 'flip'|'match'|'catch'|'move'|'perfect'|'purchase'|'reward', enabled: boolean) {
  if(!canPlay(enabled)||performance.now()-lastEffectAt<75)return
  lastEffectAt=performance.now()
  oneShot((audio,output)=>{
    const at=audio.currentTime
    if(kind==='flip'||kind==='move'){renderFoley(audio,'page',at,.7,output);return}
    if(kind==='catch'){renderFoley(audio,'bubble',at,.7,output);return}
    const pitches=kind==='reward'?[523,659,784]:kind==='purchase'?[660,880]:kind==='perfect'?[784,1047]:[659,880]
    pitches.forEach((pitch,i)=>note(audio,at+i*.09,.19,pitch,pitch,.04,output))
  })
}
/** Unlock on the user's Start gesture; never plays on launch. */
export function prepareReminderSound() {try{void audioContext().resume().catch(()=>{})}catch{/* Optional audio. */}}
/** The explicit timer's chime has its own switch and bypasses pet mute/TTS. */
export function playReminderSound(enabled: boolean) {
  if(!enabled)return
  try{const audio=audioContext();void audio.resume().then(()=>{
    [659.25,783.99,1046.5,659.25,783.99,1046.5].forEach((pitch,i)=>note(audio,audio.currentTime+i*.23+(i>2?.18:0),.38,pitch,pitch,.075,audio.destination))
  }).catch(()=>{})}catch{/* The visual completion notification still appears. */}
}
