import {describe,it,expect} from 'vitest'
import {roomWalkArea,roomWalkClickTop,roomWalkLayout,roomWalkTarget,stepRoomWalk} from './room-walk'
import {MIDDLE_WALK_RISE} from './frame-registration'
import {ROOM_PET_BASE} from './room-pet-size'
describe('room floor travel',()=>{
 it('restricts pointer, random and keyboard travel to the middle/lower floor',()=>{
  for(const [width,height,dock] of [[1180,790,650],[1000,690,540],[600,590,440]]){
   const area=roomWalkArea(width,height,dock)
   expect(area.top).toBeGreaterThanOrEqual(height*.5);expect(area.bottom).toBeLessThan(dock);expect(area.right).toBeGreaterThan(width*.8)
   expect(roomWalkTarget({x:-100,y:-100},area)).toEqual({x:area.left,y:area.top})
   expect(roomWalkTarget({x:width+500,y:height+500},area)).toEqual({x:area.right,y:area.bottom})
  }
 })
 it('keeps a usable floor strip on a short landscape phone',()=>{
  const area=roomWalkArea(852,393,278)
  expect(area.bottom-area.top).toBeGreaterThanOrEqual(44)
  expect(area.top).toBeGreaterThanOrEqual(393*.5)
  expect(area.bottom).toBeLessThan(278)
  const target=roomWalkTarget({x:760,y:area.top-1},area)
  expect(target.x).toBe(760);expect(target.y).toBe(area.top)
 })
 it('uses one floor boundary for wall taps and all movement',()=>{
  const area=roomWalkArea(1180,790,650)
  const clickTop=roomWalkClickTop(area)
  expect(clickTop).toBe(area.top)
  expect(area.bottom-clickTop).toBeGreaterThanOrEqual(44)
  expect(clickTop).toBeLessThan(area.bottom)
 })
 it('reserves the complete two-leaf walking silhouette at one scale in short rooms',()=>{
  const headroom=MIDDLE_WALK_RISE*ROOM_PET_BASE.height
  const large=roomWalkLayout(1180,790,650,1,headroom)
  expect(large.scale).toBe(1)
  const short=roomWalkLayout(360,282,184,1,headroom)
  expect(short.scale).toBeLessThan(1)
  expect(short.area.top).toBeGreaterThan(short.scale*headroom)
  expect(short.area.bottom-short.area.top).toBeGreaterThanOrEqual(44)
  expect(roomWalkTarget({x:180,y:0},short.area).y).toBe(short.area.top)
 })
 it('travels at the same speed diagonally and never overshoots a nearby destination',()=>{
  const straight=stepRoomWalk({x:0,y:0},{x:100,y:0},40),diagonal=stepRoomWalk({x:0,y:0},{x:100,y:100},40)
  expect(Math.hypot(straight.point.x,straight.point.y)).toBeCloseTo(5)
  expect(Math.hypot(diagonal.point.x,diagonal.point.y)).toBeCloseTo(5)
  expect(stepRoomWalk({x:90,y:80},{x:91,y:81},100)).toEqual({point:{x:91,y:81},finished:true})
 })
 it('can change destination mid-step and bounds progress after a suspended frame',()=>{
  const p=stepRoomWalk({x:100,y:100},{x:500,y:100},5000).point
  expect(p.x).toBe(112.5)
  expect(stepRoomWalk(p,{x:20,y:80},40).point.x).toBeLessThan(p.x)
  expect(stepRoomWalk(p,p,0).finished).toBe(true)
 })
})
