export type PetVoice = 'pet' | 'lift' | 'shake' | 'drop' | 'catch' | 'feed' | 'drink' | 'wash' | 'sleep' | 'wake' | 'sick';
let lastVoiceAt = -Infinity;
let lastKind: PetVoice | null = null;
let context: AudioContext | null = null;

function envelope(audio: AudioContext, start: number, length: number, level: number) {
  const gain = audio.createGain();
  gain.gain.setValueAtTime(.0001, start);
  gain.gain.exponentialRampToValueAtTime(level, start + Math.min(.025, length / 4));
  gain.gain.exponentialRampToValueAtTime(.0001, start + length);
  gain.connect(audio.destination);
  return gain;
}
function note(audio: AudioContext, start: number, length: number, pitch: number, target: number, level: number, type: OscillatorType = 'sine') {
  const oscillator = audio.createOscillator(), gain = envelope(audio, start, length, level);
  oscillator.type = type; oscillator.frequency.setValueAtTime(pitch, start); oscillator.frequency.exponentialRampToValueAtTime(target, start + length);
  oscillator.connect(gain); oscillator.start(start); oscillator.stop(start + length);
  oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
}
function rustle(audio: AudioContext, start: number, length: number, frequency: number, level: number) {
  const buffer = audio.createBuffer(1, Math.ceil(audio.sampleRate * length), audio.sampleRate), samples = buffer.getChannelData(0);
  for (let index = 0; index < samples.length; index++) samples[index] = (Math.random() * 2 - 1) * .65;
  const source = audio.createBufferSource(), filter = audio.createBiquadFilter(), gain = envelope(audio, start, length, level);
  source.buffer = buffer; filter.type = 'bandpass'; filter.frequency.value = frequency; filter.Q.value = 1.5;
  source.connect(filter); filter.connect(gain); source.start(start); source.stop(start + length);
  source.onended = () => { source.disconnect(); filter.disconnect(); gain.disconnect(); };
}
/** Quiet, locally synthesized foley and vocal syllables. These are generated
 * sounds, not official game recordings. Speech playback always takes priority. */
export function playPetVoice(kind: PetVoice, enabled: boolean) {
  if (!enabled || performance.now() - lastVoiceAt < (lastKind === kind ? 700 : 180) || window.speechSynthesis?.speaking) return;
  lastVoiceAt = performance.now(); lastKind = kind;
  try {
    context ??= new AudioContext();
    const audio = context;
    void audio.resume().then(() => {
      const now = audio.currentTime;
      if (kind === 'feed') {
        for (let index = 0; index < 3; index++) {
          const start = now + index * .15;
          rustle(audio, start, .085, 1050 + index * 70, .045);
          note(audio, start, .1, 180, 120, .025);
        }
        return;
      }
      if (kind === 'drink') {
        for (let index = 0; index < 3; index++) note(audio, now + index * .17, .14, 290 + index * 22, 145, .055);
        return;
      }
      if (kind === 'wash') {
        for (let index = 0; index < 7; index++) note(audio, now + index * .065, .1, 380 + index % 3 * 135, 680 + index % 3 * 170, .025);
        rustle(audio, now + .03, .48, 1450, .017);
        return;
      }
      if (kind === 'sleep') { rustle(audio, now, .65, 480, .018); return; }
      const pitches: Record<Exclude<PetVoice, 'feed' | 'drink' | 'wash' | 'sleep'>, readonly [number, number]> = {
        pet: [240, 290], lift: [250, 340], shake: [290, 210], drop: [200, 270], catch: [260, 300], wake: [220, 320], sick: [210, 180],
      };
      pitches[kind].forEach((pitch, index) => {
        const start = now + index * .15, length = kind === 'sick' ? .24 : .18;
        const source = audio.createOscillator(), filter = audio.createBiquadFilter(), gain = envelope(audio, start, length, kind === 'sick' ? .023 : .035);
        source.type = 'sawtooth'; source.frequency.setValueAtTime(pitch, start); source.frequency.exponentialRampToValueAtTime(pitch * .84, start + length);
        filter.type = 'bandpass'; filter.Q.value = 2.8; filter.frequency.setValueAtTime(index ? 520 : 920, start); filter.frequency.linearRampToValueAtTime(index ? 420 : 650, start + length);
        source.connect(filter); filter.connect(gain); source.start(start); source.stop(start + length);
        source.onended = () => { source.disconnect(); filter.disconnect(); gain.disconnect(); };
      });
    }).catch(() => { /* A muted device does not block care. */ });
  } catch { /* Optional sound never blocks interaction. */ }
}

/** Unlock only on the user's Start gesture; no sound plays on launch. */
export function prepareReminderSound() {
  try { context ??= new AudioContext(); void context.resume().catch(() => {}); } catch { /* Optional audio device. */ }
}
/** A distinct two-part chime, independent of pet chirp throttling and TTS. */
export function playReminderSound(enabled: boolean) {
  if (!enabled) return;
  try {
    context ??= new AudioContext(); const audio = context;
    void audio.resume().then(() => {
      [659.25, 783.99, 1046.5, 659.25, 783.99, 1046.5].forEach((pitch, index) => {
        note(audio, audio.currentTime + index * .23 + (index > 2 ? .18 : 0), .38, pitch, pitch, .075, 'sine');
      });
    }).catch(() => {});
  } catch { /* Countdown completion still displays its visual notification. */ }
}
