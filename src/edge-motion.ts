import visibility from '../electron/edge-visibility.json';
import type { Stage } from './game';

export type PetEdge = 'left' | 'right' | 'top' | 'bottom';
export type EdgePose = 'visible' | 'tucking' | 'hidden' | 'peek';
export interface EdgeVector { x: number; y: number }

/** Native state supplies targets; transitions interpolate these in the renderer. */
export function edgeTargetOffset(side: PetEdge | null, pose: EdgePose, supplied?: EdgeVector,form:string='junior'): EdgeVector {
  if (!side || pose === 'visible') return { x: 0, y: 0 };
  const horizontal = side === 'left' || side === 'right';
  const profile=visibility.forms[form as keyof typeof visibility.forms]??visibility.forms.junior;
  const amount=profile[pose==='peek'?'peek':'hidden'][side];
  const direction = side === 'left' || side === 'top' ? -1 : 1;
  const fallback = { x: horizontal ? amount * direction : 0, y: horizontal ? 0 : amount * direction };
  if (!supplied || !Number.isFinite(supplied.x) || !Number.isFinite(supplied.y)) return fallback;
  return { x: Math.max(-82, Math.min(82, supplied.x)), y: Math.max(-92, Math.min(92, supplied.y)) };
}

/** Side rows exist in the original atlas. Vertical entry keeps an upright
 * front pose and adds a small step/hop on a separate layer. */
export function edgeEntryAction(stage: Stage, side: PetEdge | null): string {
  if (stage === 0 || !side || side === 'top' || side === 'bottom') return 'waiting';
  return side === 'left' ? 'walk-left' : 'walk-right';
}

export function edgePeekTilt(side: PetEdge = 'right'): number {
  return side === 'left' ? 7 : side === 'right' ? -7 : side === 'top' ? 5 : -5;
}

/** Parse only the painted translation, before disabling its CSS transition.
 * Invalid values must not become native window movement. */
export function paintedEdgeOffset(transform: string): EdgeVector {
  const match = /^matrix(3d)?\(([^)]+)\)$/.exec(transform);
  if (!match) return { x: 0, y: 0 };
  const values = match[2].split(',').map(Number), three = Boolean(match[1]);
  if (values.length !== (three ? 16 : 6) || values.some(value => !Number.isFinite(value))) return { x: 0, y: 0 };
  return { x: Math.max(-82, Math.min(82, values[three ? 12 : 4])), y: Math.max(-92, Math.min(92, values[three ? 13 : 5])) };
}
