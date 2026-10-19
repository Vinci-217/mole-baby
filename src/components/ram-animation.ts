import { SOCIAL_DURATIONS, isSocialAction } from '../social-motion'
import { getItemMotionByAction, sampleItemMotion } from '../item-motion'

export interface Pose { row: number; frame: number; finished: boolean; sheet?: 'care' | 'item' }
export const CARE_COLUMNS = 16
export const CARE_ROWS = 7
/** Each care row comes from the matching named animation in lamubone.swf. */
const CARE_ACTIONS: Record<string, { row: number; duration: number }> = {
  eat: { row: 0, duration: 1200 }, feed: { row: 0, duration: 1200 },
  drink: { row: 1, duration: 1200 }, wash: { row: 2, duration: 1500 },
  use: { row: 3, duration: 900 }, medical: { row: 3, duration: 900 },
}
const CONDITIONS: Record<string, number> = { thirsty: 4, hungry: 5, sick: 6, tired: 6, dirty: 6 }
const ONCE: Record<string, { row: number; frames: number[]; step: number }> = {
  pet: { row: 3, frames: [0, 1, 2, 3, 2, 1, 0], step: 95 },
  waving: { row: 3, frames: [0, 1, 2, 3, 2, 1, 0], step: 95 },
  catch: { row: 0, frames: [0, 1, 0], step: 83 },
  failed: { row: 5, frames: [0, 1, 2, 3, 4, 5, 6, 7], step: 100 },
  play: { row: 8, frames: [0, 1, 2, 3, 4, 5], step: 100 },
  reward: { row: 8, frames: [0, 1, 2, 3, 4, 5], step: 100 },
  happy: { row: 8, frames: [0, 1, 2, 3, 4, 5], step: 100 },
  wake: { row: 0, frames: [0, 1, 2, 1, 0], step: 100 },
}
export function getRamActionDuration(action: string): number | null {
  if (isSocialAction(action) && action !== 'focus') return SOCIAL_DURATIONS[action]
  const item = getItemMotionByAction(action)
  if (item) return item.duration
  const care = CARE_ACTIONS[action]
  if (care) return care.duration
  const once = ONCE[action]
  return once ? once.frames.length * once.step : null
}
/** Sample an event clock, never a React render count. Sleeping always uses an
 * original closed-eye pose (row 6 in the old atlas was not closed-eye sleep).
 */
export function sampleRamPose(action: string, elapsed: number, reduced = false): Pose {
  if (action === 'sleep') return { row: 8, frame: 0, finished: false }
  if (action === 'focus') return { row: 0, frame: reduced?1:[1,2,3,2][Math.floor(elapsed/1600)%4], finished: false }
  if (isSocialAction(action)) {
    const duration=SOCIAL_DURATIONS[action as 'pet'|'play'|'dizzy'];
    if (elapsed>=duration) return {row:0,frame:0,finished:true};
    if (reduced) return {row:0,frame:0,finished:false};
    return {row:action==='dizzy'?0:action==='play'?8:3,frame:action==='dizzy'?0:Math.floor(elapsed/220)%(action==='pet'?4:6),finished:false};
  }
  if (action === 'still' || action === 'drag') return { row: 0, frame: 0, finished: false }
  const item = getItemMotionByAction(action)
  if (item) {
    const pose = sampleItemMotion(item, elapsed, reduced)
    if (pose.finished) return { row: 0, frame: 0, finished: true }
    return { sheet: 'item', row: item.body === 'eat' ? 0 : item.body === 'drink' ? 1 : item.body === 'wash' ? 2 : 3, frame: pose.bodyFrame, finished: false }
  }
  const care = CARE_ACTIONS[action]
  if (care) {
    if (elapsed >= care.duration) return { row: 0, frame: 0, finished: true }
    return { sheet: 'care', row: care.row, frame: reduced ? 0 : Math.min(15, Math.floor(elapsed / care.duration * 16)), finished: false }
  }
  const condition = CONDITIONS[action]
  if (condition !== undefined) {
    const phase = elapsed % 8000
    return { sheet: 'care', row: condition, frame: reduced || phase >= 1600 ? 0 : Math.min(15, Math.floor(phase / 100)), finished: false }
  }
  if (action === 'sad') {
    const phase = elapsed % 8000
    return { row: 5, frame: reduced || phase >= 800 ? 1 : Math.min(7, Math.floor(phase / 100)), finished: false }
  }
  const once = ONCE[action]
  if (once) {
    const n = Math.floor(elapsed / once.step)
    if (n >= once.frames.length) return { row: 0, frame: 0, finished: true }
    return reduced ? { row: 0, frame: 0, finished: false } : { row: once.row, frame: once.frames[n], finished: false }
  }
  if (reduced) return { row: 0, frame: 0, finished: false }
  if (action.includes('walk') || action.includes('running-')) return { row: action.endsWith('left') ? 2 : 1, frame: Math.floor(elapsed / 62.5) % 8, finished: false }
  if (action === 'peek' || action === 'hide') {
    const phase = elapsed % 5000
    return { row: 0, frame: phase < 4200 ? 0 : Math.min(4, Math.floor((phase - 4200) / 170)), finished: false }
  }
  const phase = elapsed % 7000
  return { row: 0, frame: phase < 6000 ? 0 : Math.min(5, Math.floor((phase - 6000) / 170)), finished: false }
}
/** Original seed timeline has closed eyes in frames 4 and 5, and large eyes in
 * frame 0. Pot is an independent, completely static original image. */
export function sampleSeedPose(action: string, elapsed: number, reduced = false): { frame: number; finished: boolean } {
  if (action === 'sleep') return { frame: 61, finished: false }
  if (action === 'still' || action === 'drag') return { frame: 0, finished: false }
  if (action === 'pet' || action === 'play') return {frame:elapsed>=SOCIAL_DURATIONS[action]?0:reduced?0:Math.floor(elapsed/350)%2,finished:elapsed>=SOCIAL_DURATIONS[action]}
  if (action === 'focus') return { frame: reduced?1:[0,1,2,1][Math.floor(elapsed/1600)%4], finished:false }
  if (action === 'dizzy') return {frame:elapsed>=SOCIAL_DURATIONS.dizzy?0:2,finished:elapsed>=SOCIAL_DURATIONS.dizzy}
  const duration = getRamActionDuration(action)
  if (duration !== null && elapsed >= duration) return { frame: 0, finished: true }
  if (reduced) return { frame: 0, finished: false }
  const item = getItemMotionByAction(action)
  if (item) {
    // Only the original body moves. The independently rendered pot is static.
    const pose = sampleItemMotion(item, elapsed)
    return { frame: Math.min(24, Math.round(pose.bodyFrame * 1.5)), finished: false }
  }
  if (action === 'hungry' || action === 'thirsty' || action === 'sick' || action === 'tired' || action === 'sad') return { frame: elapsed % 8000 < 1000 ? 2 : 3, finished: false }
  if (action !== 'idle' && action !== 'waiting') {
    // A short portion of the original body squash/sway, once per interaction.
    return { frame: Math.min(24, Math.floor(elapsed / 42)), finished: false }
  }
  const phase = elapsed % 9000
  return { frame: phase < 6000 ? 0 : Math.min(60, Math.floor((phase - 6000) / 42)), finished: false }
}

/** Elemental atlases retain their own body/crown during every interaction.
 * Their original happy pose has fully closed eyes; care rows use the short
 * original greeting animation plus the consumed item's existing gesture. */
export function sampleEvolvedPose(action: string, elapsed: number, reduced = false): Pose {
  const pose = sampleRamPose(action, elapsed, reduced);
  if (pose.finished || action === 'drag') return { row: 0, frame: 0, finished: pose.finished };
  if (action === 'sleep') return { row: 8, frame: 0, finished: false };
  if (pose.sheet) return { row: pose.sheet === 'care' && pose.row >= 4 ? 6 : 3, frame: reduced ? 0 : Math.floor(elapsed / 110) % 4, finished: false };
  return pose;
}
