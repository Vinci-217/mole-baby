const test=require('node:test'),assert=require('node:assert/strict'),{EventEmitter}=require('node:events');
const {createMessageBoard}=require('./message-board.cjs');
function setup(){
 const handlers=new Map(),listeners=new Map(),windows=[];
 class Window extends EventEmitter{
  constructor(options){super();this.options=options;this.webContents=new EventEmitter();this.webContents.mainFrame={};this.webContents.send=(...args)=>this.lastSent=args;this.webContents.setWindowOpenHandler=()=>{};windows.push(this)}
  setMenu(){}loadFile(path,options){this.hash=options.hash;return Promise.resolve()}show(){}focus(){}isDestroyed(){return false}close(){this.emit('closed')}
 }
 const main={isDestroyed:()=>false,webContents:{send:(...args)=>{main.sent=args}}};
 const controller=createMessageBoard({ipcMain:{handle:(k,v)=>handlers.set(k,v),on:(k,v)=>listeners.set(k,v)},BrowserWindow:Window,getMain:()=>main,isMain:event=>event.main===true,preload:'preload',indexPath:'index.html',getURL:()=>null});
 const snapshot={name:'拉姆',createdAt:1700000000000,notes:[]};controller.open(snapshot);
 const board=windows[0],event={sender:board.webContents,senderFrame:board.webContents.mainFrame};
 return {controller,main,board,snapshot,invoke:(key,...args)=>handlers.get(key)(event,...args),handlers,reply:(id,result,ev={main:true})=>listeners.get('board:reply')(ev,id,result)};
}
test('native board loads only the board route and sends notes-only edits to the save owner',async()=>{
 const r=setup();assert.equal(r.board.hash,'message-board');assert.equal(r.board.options.webPreferences.nodeIntegration,false);
 const notes=[{id:'one',text:'备忘',done:false,createdAt:1700000000001}];
 const saved=r.invoke('board:change',{petId:r.snapshot.createdAt,baseNotes:'[]',notes});
 const [channel,request]=r.main.sent;assert.equal(channel,'board:patch');assert.equal('color' in request,false);
 r.reply(request.id,{ok:true,snapshot:{...r.snapshot,notes}},{main:false});
 assert.deepEqual(r.invoke('board:get').notes,[],'An untrusted reply cannot apply an edit');
 r.reply(request.id,{ok:true,snapshot:{...r.snapshot,notes}});assert.deepEqual((await saved).notes,notes);
 assert.throws(()=>r.invoke('board:change',{petId:r.snapshot.createdAt,baseNotes:'[]',notes:[]}),/已有更新/);
 assert.throws(()=>r.handlers.get('board:get')({sender:{},senderFrame:{}}),/Untrusted/);
});
test('failed save does not acknowledge or replace the last saved board',async()=>{
 const r=setup(),pending=r.invoke('board:change',{petId:r.snapshot.createdAt,baseNotes:'[]',notes:[{id:'x',text:'未保存'}]});
 r.reply(r.main.sent[1].id,{ok:false});await assert.rejects(pending,/未保存/);assert.deepEqual(r.invoke('board:get'),r.snapshot);
 r.controller.update(null);assert.equal(r.invoke('board:get'),null);
});
