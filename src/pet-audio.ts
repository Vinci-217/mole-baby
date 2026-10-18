export type PetVoice = 'pet' | 'lift' | 'shake' | 'drop' | 'catch';
let lastVoiceAt = -Infinity;
let lastKind: PetVoice | null = null;
let context: AudioContext | null = null;
/** Short local vocal responses; these are system/synthesized voices, not
 * mislabeled official recordings. Called only from deliberate interaction. */
export function playPetVoice(kind: PetVoice, enabled: boolean) {
  if (!enabled || performance.now() - lastVoiceAt < (lastKind === kind ? 700 : 180)) return;
  lastVoiceAt = performance.now(); lastKind = kind;
  const synth = window.speechSynthesis;
  const voice = synth?.getVoices().find(v => v.lang.startsWith('zh'));
  if (voice) {
    if (synth.speaking) { if (kind === 'shake' || kind === 'drop') synth.cancel(); else return; }
    const utterance = new SpeechSynthesisUtterance({ pet: '拉姆', lift: '唔', shake: '呜', drop: '嘿咻', catch: '嗯' }[kind]);
    utterance.voice = voice; utterance.lang = voice.lang; utterance.volume = .22; utterance.pitch = 1.65; utterance.rate = 1.45;
    synth.speak(utterance); return;
  }
  try {
    context ??= new AudioContext(); void context.resume();
    const now = context.currentTime;
    // Two voiced syllables with changing vocal-tract resonances, rather than
    // a single high oscillator beep. No network or microphone is involved.
    const pitches = { pet: [240, 290], lift: [250, 340], shake: [290, 210], drop: [200, 270], catch: [260, 300] }[kind];
    pitches.forEach((pitch, n) => {
      const start = now + n * .15, length = .18;
      const source = context!.createOscillator(); source.type = 'sawtooth'; source.frequency.setValueAtTime(pitch, start); source.frequency.exponentialRampToValueAtTime(pitch * .84, start + length);
      const gain = context!.createGain(); gain.gain.setValueAtTime(0, start); gain.gain.linearRampToValueAtTime(.028, start + .025); gain.gain.exponentialRampToValueAtTime(.0001, start + length);
      const filter = context!.createBiquadFilter(); filter.type = 'bandpass'; filter.Q.value = 2.8; filter.frequency.setValueAtTime(n ? 520 : 920, start); filter.frequency.linearRampToValueAtTime(n ? 420 : 650, start + length);
      source.connect(filter); filter.connect(gain); gain.connect(context!.destination); source.onended = () => { source.disconnect(); filter.disconnect(); gain.disconnect(); }; source.start(start); source.stop(start + length);
    });
  } catch { /* Optional sound never blocks interaction. */ }
}
