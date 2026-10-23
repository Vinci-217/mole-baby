import type { ItemMotion } from './item-motion'
import {BALL_CONTACTS} from './social-motion'
import {footballContacts} from './original-actions'

export type Foley = 'nibble' | 'crunch' | 'sip' | 'gulp' | 'bubble' | 'brush' | 'water' | 'cloth' | 'page' | 'ball' | 'magic' | 'voice'
export interface SoundCue { at: number; kind: Foley; strength: number }
export interface SoundScore { cues: SoundCue[]; loop?: number }

/** Contact times use the same approach/activity interval as sampleItemMotion. */
export function itemSoundScore(motion: ItemMotion): SoundScore {
  const kind: Foley = motion.gesture === 'brush' ? 'brush'
    : ['bath', 'fizz'].includes(motion.gesture) ? 'bubble'
    : ['face-wash', 'rinse'].includes(motion.gesture) ? 'water'
    : motion.gesture === 'scrub' ? 'cloth'
    : ['medicine', 'recolor', 'gulp', 'squeeze'].includes(motion.gesture) ? 'gulp'
    : motion.body === 'drink' ? 'sip'
    : ['crunch', 'pour-beans', 'slice'].includes(motion.gesture) ? 'crunch' : 'nibble'
  const cues: SoundCue[] = Array.from({length: motion.beats}, (_, i) => ({
    at: motion.duration * (.14 + .68 * (i + .5) / motion.beats), kind, strength: kind === 'brush' ? .55 : .7,
  }))
  if (motion.gesture === 'bath') cues.unshift({at: motion.duration * .15, kind: 'water', strength: .4})
  if (motion.gesture === 'recolor') cues.push({at: motion.duration * .61, kind: 'magic', strength: .5})
  return {cues: cues.sort((a,b) => a.at-b.at)}
}
export function socialSoundScore(action: string,form='seed'): SoundScore {
  if (action === 'focus') return {cues: [{at: 6250, kind: 'page', strength: .35}], loop: 8000}
  if (action === 'play') return {cues: (form==='seed'?BALL_CONTACTS:footballContacts(form)).map(at => ({at, kind: 'ball', strength: .5}))}
  if (action === 'pet') return {cues: [{at: 480, kind: 'voice', strength: .55}]}
  return {cues: []}
}
