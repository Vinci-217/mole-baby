import {careContactFractions,type ItemMotion } from './item-motion'
import {BALL_CONTACTS} from './social-motion'
import {footballContacts} from './original-actions'

export type Foley = 'smack' | 'clean' | 'sparkle' | 'boing' | 'nibble' | 'crunch' | 'sip' | 'gulp' | 'bubble' | 'brush' | 'water' | 'cloth' | 'page' | 'ball' | 'magic' | 'voice'
export interface SoundCue { at: number; kind: Foley; strength: number }
export interface SoundScore { cues: SoundCue[]; loop?: number }

/** Contact times use the same approach/activity interval as sampleItemMotion. */
export function itemSoundScore(motion: ItemMotion): SoundScore {
  const kind:Foley=motion.body==='eat'?'smack':motion.body==='wash'?'bubble':'gulp'
  const cues:SoundCue[]=careContactFractions(motion).map(fraction=>({at:motion.duration*fraction,kind,strength:.65}))
  if(motion.body==='eat')cues.unshift({at:motion.duration*.24,kind:'cloth',strength:.2})
  if(motion.body==='drink')cues.push({at:motion.duration*.90,kind:'boing',strength:.25})
  if(motion.body==='wash')cues.push({at:motion.duration*.65,kind:'water',strength:.5},{at:motion.duration*.90,kind:'clean',strength:.7})
  if(motion.gesture==='recolor')cues.push({at:motion.duration*.61,kind:'magic',strength:.5})

  return {cues: cues.sort((a,b) => a.at-b.at)}
}
export function socialSoundScore(action: string,form='seed'): SoundScore {
  if (action === 'focus') return {cues: [{at: 6250, kind: 'page', strength: .35}], loop: 8000}
  if (action === 'play') return {cues: (form==='seed'?BALL_CONTACTS:footballContacts(form)).map(at => ({at, kind: 'boing', strength: .65}))}
  if(action==='watch-butterfly')return {cues:[{at:1700,kind:'cloth',strength:.4},{at:3900,kind:'cloth',strength:.4},{at:5000,kind:'voice',strength:.35}]}
  if (action === 'pet') return {cues: [{at: 480, kind: 'voice', strength: .55}]}
  return {cues: []}
}
