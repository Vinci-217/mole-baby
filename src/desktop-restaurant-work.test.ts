import {describe,it,expect} from 'vitest';
import {desktopRestaurantFrame,DESKTOP_WORK_CYCLE,DESKTOP_WORK_BOUNDS} from './desktop-restaurant-work';
describe('desktop restaurant work',()=>{
  it('takes a tray left to right, serves once, returns empty and clears the table',()=>{
    expect(desktopRestaurantFrame(0).worker.carrying).toBe(false);
    expect(desktopRestaurantFrame(1100).worker.carrying).toBe(true);
    const delivery=desktopRestaurantFrame(3000);expect(delivery.worker.moving).toBe(true);expect(delivery.worker.to.x).toBeGreaterThan(delivery.worker.from.x);
    expect(desktopRestaurantFrame(4300).dishVisible).toBe(false);
    expect(desktopRestaurantFrame(4400).worker.carrying).toBe(false);expect(desktopRestaurantFrame(4400).dishVisible).toBe(true);
    const returning=desktopRestaurantFrame(6000);expect(returning.worker.carrying).toBe(false);expect(returning.worker.to.x).toBeLessThan(returning.worker.from.x);
    expect(desktopRestaurantFrame(8600).dishVisible).toBe(false);
    expect(desktopRestaurantFrame(DESKTOP_WORK_CYCLE)).toEqual(desktopRestaurantFrame(0));
  });
  it('has no position jumps at phase boundaries and stays within the expanded desktop host',()=>{
    for(let t=1;t<=DESKTOP_WORK_CYCLE;t++){
      const before=desktopRestaurantFrame(t-1).worker.position,next=desktopRestaurantFrame(t).worker.position;
      expect(Math.hypot(next.x-before.x,next.y-before.y)).toBeLessThan(.1);
      expect(next.x).toBeGreaterThan(50);expect(next.x).toBeLessThan(DESKTOP_WORK_BOUNDS.width-50);expect(next.y).toBeLessThan(164);
    }
  });
});
