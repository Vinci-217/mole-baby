const{test}=require('node:test'),assert=require('node:assert/strict');
const{resizedRoomBounds,createRoomResizer}=require('./room-resize.cjs');
test('eight-direction room resizing anchors opposite edges and respects negative-origin displays and small work areas',()=>{
 const area={x:-1920,y:32,width:1920,height:1040},b={x:-1700,y:100,width:1100,height:800};
 for(const edge of ['n','ne','e','se','s','sw','w','nw']){
  const r=resizedRoomBounds(b,edge,120,80,area);assert.ok(r.width>=800&&r.height>=640);assert.ok(r.x>=area.x&&r.y>=area.y);assert.ok(r.x+r.width<=0&&r.y+r.height<=1072);
  if(edge.includes('w'))assert.equal(r.x+r.width,b.x+b.width);if(edge.includes('n'))assert.equal(r.y+r.height,b.y+b.height);
 }
 const tiny={x:0,y:0,width:760,height:600};assert.deepEqual(resizedRoomBounds(b,'se',-5000,-5000,tiny),tiny);
 assert.throws(()=>resizedRoomBounds(b,'bad',0,0,area));assert.throws(()=>resizedRoomBounds(b,'e',NaN,0,area));
});
test('native cursor drag uses its initial DIP bounds, ends on mode change and never touches native frame style',t=>{
 t.mock.timers.enable({apis:['setInterval']});let allowed=true,point={x:100,y:100},bounds={x:20,y:30,width:1000,height:720},saves=0;
 const room=createRoomResizer({getWindow:()=>({getBounds:()=>({...bounds}),setBounds:b=>bounds={...b}}),screen:{getCursorScreenPoint:()=>point,getDisplayMatching:()=>({workArea:{x:0,y:0,width:1920,height:1080}})},canResize:()=>allowed,onResize(){},onEnd(){saves++}});
 t.after(()=>room.end());assert.equal(room.start('se'),true);point={x:220,y:180};t.mock.timers.tick(16);assert.deepEqual(bounds,{x:20,y:30,width:1120,height:800});
 t.mock.timers.tick(160);assert.equal(bounds.height,800,'unchanged pointer cannot accumulate resize drift');
 allowed=false;t.mock.timers.tick(16);assert.equal(saves,1);point={x:400,y:500};t.mock.timers.tick(32);assert.equal(bounds.height,800);assert.equal(room.adjust(16,16),false);assert.throws(()=>room.adjust(Infinity,1));
});
