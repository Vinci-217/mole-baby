import { describe, expect, it } from 'vitest';
import { restaurantWorkFrame, RESTAURANT_BACKGROUNDS, WORK_CYCLE_MS } from './restaurant-work';

describe('restaurant work animation', () => {
  it('serves food before eating, clears the plate, and returns to an empty scene', () => {
    const at = (ms: number) => restaurantWorkFrame(RESTAURANT_BACKGROUNDS[0], ms);
    expect(at(0).guest).toBeNull();
    expect(at(3000).phase).toBe('enter');
    expect(at(5000).phase).toBe('wait');
    expect(at(7000).phase).toBe('fetch');
    expect(at(9600).worker.carrying).toBe(true);
    expect(at(12000).phase).toBe('deliver');
    expect(at(13900).dishVisible).toBe(false);
    expect(at(14000).dishVisible).toBe(true);
    expect(at(14000).worker.carrying).toBe(false);
    expect(at(17000).eating).toBe(true);
    expect(at(20000).dishOpacity).toBeCloseTo(.5);
    expect(at(21500).dishVisible).toBe(false);
    expect(at(21500).phase).toBe('leave');
    expect(at(25500).guest).toBeNull();
    expect(at(WORK_CYCLE_MS).worker.position).toEqual(at(0).worker.position);
    expect(at(WORK_CYCLE_MS).cycle).toBe(1);
  });

  it('keeps worker and customer positions continuous through every phase in all backgrounds', () => {
    for (const id of RESTAURANT_BACKGROUNDS) {
      for (const boundary of [1000, 4500, 6000, 9000, 10000, 13500, 14500, 17500, 20500, 25000, WORK_CYCLE_MS]) {
        for (let cycle = 0; cycle < 8; cycle++) {
          const before = restaurantWorkFrame(id, cycle * WORK_CYCLE_MS + boundary - 1);
          const after = restaurantWorkFrame(id, cycle * WORK_CYCLE_MS + boundary);
          expect(Math.hypot(after.worker.position.x - before.worker.position.x, after.worker.position.y - before.worker.position.y), `${id}: worker at ${boundary}`).toBeLessThan(1);
          if (before.guest && after.guest) expect(Math.hypot(after.guest.x - before.guest.x, after.guest.y - before.guest.y), `${id}: guest at ${boundary}`).toBeLessThan(1);
          else if (before.guest || after.guest) expect((before.guest ?? after.guest)!.y).toBeGreaterThan(620);
        }
      }
    }
  });

  it('handles an outdated background selection and invalid elapsed times safely', () => {
    expect(restaurantWorkFrame('removed-room', NaN)).toEqual(restaurantWorkFrame(RESTAURANT_BACKGROUNDS[0], 0));
    expect(restaurantWorkFrame(RESTAURANT_BACKGROUNDS[0], -500)).toEqual(restaurantWorkFrame(RESTAURANT_BACKGROUNDS[0], 0));
  });
});
