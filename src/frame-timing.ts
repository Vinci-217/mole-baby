/** Zero-based frame of a fixed-rate clip. A finite clip holds its final pose. */
export function frameAtTime(elapsedMs: number, frames: number, fps: number) {
  return Math.min(frames - 1, Math.max(0, Math.floor(elapsedMs * fps / 1000)));
}
