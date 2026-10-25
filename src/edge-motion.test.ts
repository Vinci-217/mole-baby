import { describe, expect, it } from 'vitest';
import { edgeEntryAction, edgePeekTilt, edgeTargetOffset, paintedEdgeOffset } from './edge-motion';
import visibility from '../electron/edge-visibility.json';
import type { PetEdge } from './edge-motion';

describe('four desktop edges share one painted movement contract', () => {
  it('uses matching signed native targets for hiding and peeking on each axis', () => {
    const p=visibility.forms.junior;const vectors={left:[-p.hidden.left,0,-p.peek.left,0],right:[p.hidden.right,0,p.peek.right,0],top:[0,-p.hidden.top,0,-p.peek.top],bottom:[0,p.hidden.bottom,0,p.peek.bottom]};
    for (const [side, [x, y, px, py]] of Object.entries(vectors)) {
      for (const pose of ['tucking', 'hidden'] as const) expect(edgeTargetOffset(side as PetEdge, pose)).toEqual({ x, y });
      expect(edgeTargetOffset(side as PetEdge, 'peek')).toEqual({ x: px, y: py });
      expect(edgeTargetOffset(side as PetEdge, 'visible', { x, y })).toEqual({ x: 0, y: 0 });
    }
    expect(edgeTargetOffset(null, 'hidden')).toEqual({ x: 0, y: 0 });
    expect(edgeTargetOffset('top', 'hidden', { x: NaN, y: 80 })).toEqual({ x: 0, y: -p.hidden.top });
  });
  it('keeps seeds and vertical movement upright while retaining real horizontal side faces', () => {
    for (const side of ['left', 'right', 'top', 'bottom'] as const) expect(edgeEntryAction(0, side)).toBe('waiting');
    for (const stage of [1, 2, 3, 4] as const) {
      expect(edgeEntryAction(stage, 'left')).toBe('walk-left'); expect(edgeEntryAction(stage, 'right')).toBe('walk-right');
      expect(edgeEntryAction(stage, 'top')).toBe('waiting'); expect(edgeEntryAction(stage, 'bottom')).toBe('waiting');
    }
    expect(edgePeekTilt('left')).toBeGreaterThan(0); expect(edgePeekTilt('right')).toBeLessThan(0);
    expect(Math.abs(edgePeekTilt('top'))).toBeLessThan(8); expect(Math.abs(edgePeekTilt('bottom'))).toBeLessThan(8);
  });
  it('captures interrupted two-axis transitions without trusting malformed or oversized translations', () => {
    expect(paintedEdgeOffset('matrix(1, 0, 0, 1, -31.25, 0)')).toEqual({ x: -31.25, y: 0 });
    expect(paintedEdgeOffset('matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,43.5,0,1)')).toEqual({ x: 0, y: 43.5 });
    for (const value of ['none', '', 'matrix(1,0,0,1,Infinity,2)', 'matrix(1,2,3)']) expect(paintedEdgeOffset(value)).toEqual({ x: 0, y: 0 });
    expect(paintedEdgeOffset('matrix(1,0,0,1,999,-999)')).toEqual({ x: 82, y: -92 });
  });
});

it('retains thirty percent of each original body at every edge, with a larger hover peek',()=>{for(const form of Object.values(visibility.forms)){const[l,t,r,b]=form.body,w=r-l,h=b-t;expect((r-form.hidden.left)/w).toBeCloseTo(.3,3);expect((100-form.hidden.right-l)/w).toBeCloseTo(.3,3);expect((b-form.hidden.top)/h).toBeCloseTo(.3,3);expect((108-form.hidden.bottom-t)/h).toBeCloseTo(.3,3);for(const edge of ['left','right','top','bottom']as const)expect(form.peek[edge]).toBeLessThan(form.hidden[edge])}})
