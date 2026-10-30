import {describe,it,expect} from 'vitest'
import {roomWalkArea,roomWalkTarget,stepRoomWalk} from './room-walk'
describe('room floor travel',()=>{
 it('keeps targets below the wall and above the dock while leaving room for the pet',()=>{
  for(const [width,height,dock] of [[1180,790,650],[1000,690,540],[600,590,440]]){
   const area=roomWalkArea(width,height,dock)
   expect(area.top).toBeGreaterThanOrEqual(height*.5);expect(area.bottom).toBeLessThan(dock)
   expect(roomWalkTarget({x:-100,y:-100},area)).toEqual({x:area.left,y:area.top})
   expect(roomWalkTarget({x:width+500,y:height+500},area)).toEqual({x:area.right,y:area.bottom})
  }
 })
 it('keeps a usable floor strip on a short landscape phone',()=>{
  const area=roomWalkArea(852,393,278)
  expect(area.bottom-area.top).toBeGreaterThanOrEqual(44)
  expect(area.top).toBeGreaterThan(60)
  expect(area.bottom).toBeLessThan(278)
  const target=roomWalkTarget({x:760,y:200},area)
  expect(target.x).toBe(760);expect(target.y).toBe(200)
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
