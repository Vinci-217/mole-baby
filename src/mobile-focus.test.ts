import {describe,it,expect} from 'vitest';
import {parseMobileFocus,focusReminderId} from './mobile-focus';
describe('Android persistent one-shot timer',()=>{
 const value={petId:123,startedAt:1000000,deadline:1180000,plannedMinutes:3,direction:'countdown'};
 it('restores a running timer using its original deadline',()=>expect(parseMobileFocus(JSON.stringify(value),123,3,'countdown',1100000)).toEqual(value));
 it('restores a just-finished timer for one completion record',()=>expect(parseMobileFocus(JSON.stringify(value),123,3,'countdown',1200000)).toEqual(value));
 it('does not start timers for a different pet or settings',()=>{expect(parseMobileFocus(JSON.stringify(value),456,3,'countdown',1100000)).toBeNull();expect(parseMobileFocus(JSON.stringify(value),123,4,'countdown',1100000)).toBeNull();expect(parseMobileFocus(JSON.stringify(value),123,3,'countup',1100000)).toBeNull();});
 it('rejects stale, corrupt and impossible clocks',()=>{for(const raw of ['broken',JSON.stringify({...value,deadline:0}),JSON.stringify({...value,startedAt:2000000}),JSON.stringify({...value,plannedMinutes:999})])expect(parseMobileFocus(raw,123,3,'countdown',1100000)).toBeNull();expect(parseMobileFocus(JSON.stringify(value),123,3,'countdown',100000000)).toBeNull();});
 it('deduplicates native notifications by pet and session',()=>{expect(focusReminderId(value)).toBe('focus:123:1000000');expect(focusReminderId({...value,startedAt:1000001})).not.toBe(focusReminderId(value));});
});
