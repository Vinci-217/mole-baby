export interface Pose { row: number; frame: number; finished: boolean }
const ONCE: Record<string, { row: number; frames: number[]; step: number }> = {
  pet: { row: 0, frames: [0, 1, 2, 1, 0], step: 90 },
  waving: { row: 0, frames: [0, 1, 2, 1, 0], step: 90 },
  catch: { row: 0, frames: [0, 1, 0], step: 83 },
  feed: { row: 3, frames: [0, 1, 2, 3], step: 110 },
  wash: { row: 4, frames: [0, 1, 2, 3, 4], step: 140 },
  sad: { row: 5, frames: [0, 1, 2, 3, 4, 5, 6, 7], step: 100 },
  play: { row: 8, frames: [0, 1, 2, 3, 4, 5], step: 100 },
  reward: { row: 8, frames: [0, 1, 2, 3, 4, 5], step: 100 },
};
/** Sample an event clock rather than restarting timers on React renders. */
export function sampleRamPose(action: string, elapsed: number, reduced = false): Pose {
  if (reduced || action === 'still' || action === 'drag') return { row: 0, frame: 0, finished: false };
  const once = ONCE[action];
  if (once) {
    const n = Math.floor(elapsed / once.step);
    return n >= once.frames.length ? { row: 0, frame: 0, finished: true }
      : { row: once.row, frame: once.frames[n], finished: false };
  }
  if (action.includes('walk') || action.includes('running-')) return { row: action.endsWith('left') ? 2 : 1, frame: Math.floor(elapsed / 62.5) % 8, finished: false };
  // Most of the time the pet simply stands. A brief original blink happens
  // every seven seconds, rather than replaying the whole pose continuously.
  const phase = elapsed % 7000;
  return { row: 0, frame: phase < 6000 ? 0 : Math.min(5, Math.floor((phase - 6000) / 170)), finished: false };
}
