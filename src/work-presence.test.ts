import {describe,it,expect} from 'vitest';
import {WorkPresence,WORK_VIEW_SWITCH_MS} from './work-presence';
describe('restaurant foreground presence',()=>{
 it('cancels a hidden document or hidden native window without a requested switch',()=>{
  const p=new WorkPresence();expect(p.isPresent(false,0)).toBe(true);expect(p.isPresent(true,0)).toBe(false);
  p.observeWindow({windowVisible:false,petMode:false});expect(p.isPresent(false,1)).toBe(false);
 });
 it('bridges only a bounded explicit Android overlay-to-activity transfer',()=>{
  const p=new WorkPresence();p.observeWindow({windowVisible:true,petMode:true});p.beginViewSwitch(false,100);
  expect(p.isPresent(false,110)).toBe(true);p.observeWindow({windowVisible:false,petMode:false});expect(p.isPresent(true,120)).toBe(true);
  expect(p.isPresent(true,100+WORK_VIEW_SWITCH_MS)).toBe(false);
 });
 it('waits for both native and document visibility, then stops protecting real backgrounding',()=>{
  const p=new WorkPresence();p.beginViewSwitch(false,100);p.observeWindow({windowVisible:true,petMode:false});
  expect(p.isPresent(true,150)).toBe(true);expect(p.isPresent(false,200)).toBe(true);
  expect(p.isPresent(true,201)).toBe(false);p.observeWindow({windowVisible:false,petMode:false});expect(p.isPresent(false,202)).toBe(false);
 });
 it('does not complete a transfer on an old panel-state event and can abandon a failed request',()=>{
  const p=new WorkPresence();p.beginViewSwitch(false,100);p.observeWindow({windowVisible:true,petMode:true});
  expect(p.isPresent(false,110)).toBe(true);expect(p.isPresent(true,120)).toBe(true);
  p.endViewSwitch();expect(p.isPresent(true,121)).toBe(false);
 });
});
