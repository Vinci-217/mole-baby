import { describe, expect, it } from 'vitest';
import { scenePhaseAt, sceneSheetPosition } from './scene-time';

describe('the room follows the local day', () => {
  it.each([
    [0, 0, 'night'], [5, 59, 'night'], [6, 0, 'morning'], [10, 59, 'morning'],
    [11, 0, 'noon'], [16, 59, 'noon'], [17, 0, 'dusk'], [19, 59, 'dusk'],
    [20, 0, 'night'], [23, 59, 'night'],
  ] as const)('local %s:%s selects %s', (hours, minutes, expected) => {
    expect(scenePhaseAt(new Date(2026, 9, 19, hours, minutes))).toBe(expected);
  });

  it('selects each independent panel instead of displaying the whole four-scene sheet', () => {
    expect(sceneSheetPosition('morning')).toEqual({ x: '-25%', y: '-25%' });
    expect(sceneSheetPosition('noon')).toEqual({ x: '-75%', y: '-25%' });
    expect(sceneSheetPosition('dusk')).toEqual({ x: '-25%', y: '-75%' });
    expect(sceneSheetPosition('night')).toEqual({ x: '-75%', y: '-75%' });
  });
});
