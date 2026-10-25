const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');

async function launch(legacyName, customProfile = false, platform = 'win32', options={}) {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'mole-native-'));
  if (legacyName) fs.mkdirSync(path.join(profile, legacyName, 'Local Storage'), { recursive: true });
  const handles = new Map(); const listeners = new Map(); const windows = [];
  const stats = { quit: 0 };
  const cursor={x:900,y:400};
  if(options.key){fs.mkdirSync(path.join(profile,'mole-baby'),{recursive:true});fs.writeFileSync(path.join(profile,'mole-baby','companion-ai-key.json'),'retired-test-key');}
  const app = new EventEmitter();
  app.isPackaged = true;
  app.commandLine = { getSwitchValue: () => customProfile ? path.join(profile, 'isolated-cli') : '' };
  app.getPath = key => key === 'appData' ? profile : app.userData || path.join(profile, '拉姆');
  app.setPath = (key, value) => { if (key === 'userData') app.userData = value; };
  app.setName = value => { app.name = value; };
  app.setAppUserModelId = () => {};
  app.dock = { hide() { stats.dockHidden = true; } };
  app.requestSingleInstanceLock = () => true;
  app.whenReady = () => Promise.resolve();
  app.quit = () => { stats.quit++; app.emit('before-quit'); app.emit('will-quit'); };
  class FakeWindow extends EventEmitter {
    static getAllWindows() { return windows; }
    constructor(options) {
      super(); this.options = options; this.bounds = { x: options.x, y: options.y, width: options.width, height: options.height };
      this.visible = false; this.top = options.alwaysOnTop;
      this.webContents = new EventEmitter();
      this.webContents.mainFrame = { url: '' };
      this.webContents.send = () => {};
      this.webContents.setWindowOpenHandler = () => {};
      this.webContents.session = { setPermissionRequestHandler() {}, setPermissionCheckHandler() {} };
      windows.push(this);
    }
    loadFile(filename) { this.webContents.mainFrame.url = require('node:url').pathToFileURL(filename).href; return Promise.resolve(); }
    loadURL(url) { this.webContents.mainFrame.url = url; return Promise.resolve(); }
    isDestroyed() { return false; }
    isMinimized() { return false; }
    isAlwaysOnTop() { return Boolean(this.top); }
    isVisible() { return this.visible; }
    getBounds() { return { ...this.bounds }; }
    getNormalBounds() { return this.getBounds(); }
    setBounds(bounds) { this.bounds = { ...bounds };if(options.clamp){this.bounds.x=Math.max(0,this.bounds.x);this.bounds.y=Math.max(0,this.bounds.y);} }
    setPosition(x, y) { this.bounds.x = options.clamp?Math.max(0,x):x; this.bounds.y = options.clamp?Math.max(0,y):y; }
    setAlwaysOnTop(value) { this.top = value; }
    setVisibleOnAllWorkspaces(value, options) { this.allSpaces = value; this.spaceOptions = options; }
    setMinimumSize(w,h) {this.minimum=[w,h]} setMaximumSize(w,h) {this.maximum=[w,h]} setResizable(value) {this.resizeChanges??=[];this.resizeChanges.push(value)} setIgnoreMouseEvents() {} setMenu() {}
    show() { this.visible = true; } hide() { this.visible = false; } focus() {} restore() {}
  }
  class FakeTray extends EventEmitter {
    constructor(image) { super(); this.image = image; FakeTray.instance = this; }
    isDestroyed() { return false; }
    setToolTip(text) { this.tooltip = text; }
    setContextMenu(menu) { this.menu = menu; }
    destroy() { this.destroyed = true; }
  }
  const screen = new EventEmitter();
  const display = { workArea: { x: 0, y: 0, width: 1920, height: 1040 } };
  screen.getCursorScreenPoint=()=>({...cursor});screen.getDisplayNearestPoint=()=>display;
  screen.getPrimaryDisplay = screen.getDisplayMatching = () => display;
  const electron = { app, BrowserWindow: FakeWindow, screen, safeStorage: {}, Tray: FakeTray,
    Menu: { buildFromTemplate: template => template, setApplicationMenu: menu => { stats.appMenu = menu; } }, nativeImage: { createFromPath: value => ({path:value,template:false,setTemplateImage(flag){this.template=flag;}}) },
    ipcMain: { handle: (channel, fn) => handles.set(channel, fn), on: (channel, fn) => listeners.set(channel, fn) },
    Notification: { isSupported: () => false } };
  const localRequire = name => name === 'electron' ? electron : name.startsWith('./') ? require(path.join(__dirname,name)) : require(name);
  const runtimeProcess = Object.create(process);
  Object.defineProperty(runtimeProcess, 'platform', { value: platform });
  Object.defineProperty(runtimeProcess,'env',{value:{...process.env,MOLE_BABY_DISABLE_UPDATES:'1'}});
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, 'main.cjs'), 'utf8'), {
    require: localRequire, __dirname, console, URL, Date, process: runtimeProcess,
    setTimeout, clearTimeout, setInterval, clearInterval,
  }, { filename: 'main.cjs' });
  await new Promise(resolve => setImmediate(resolve));
  const window = windows[0]; const tray = FakeTray.instance;
  const event = { sender: window.webContents, senderFrame: window.webContents.mainFrame };
  return {
    app, window, tray, stats, handles, listeners, screen, display,cursor,
    send: (channel, ...args) => listeners.get(channel)(event, ...args),
    invoke: (channel, ...args) => handles.get(channel)(event, ...args),
    cleanup() { app.emit('before-quit'); app.emit('will-quit'); fs.rmSync(profile, { recursive: true, force: true }); },
  };
}

test('startup waits for the correctly painted mode, and keeps the old profile through rename', async t => {
  const run = await launch(); t.after(() => run.cleanup());
  assert.equal(run.app.name, '拉姆');
  assert.equal(path.basename(run.app.userData), 'mole-baby');
  assert.equal(run.window.options.title, '拉姆');
  assert.equal(run.window.options.skipTaskbar, true);
  assert.equal(run.window.options.enableLargerThanScreen, false);
  run.window.emit('ready-to-show');
  assert.equal(run.window.isVisible(), false, 'Electron paint readiness must not flash the large room');
  run.invoke('desktop:set-pet-mode', true);
  run.send('desktop:ready-to-show', true);
  assert.equal(run.window.isVisible(), true);
  assert.deepEqual(run.window.getBounds(), { x: 1754, y: 792, width: 160, height: 240 });
  assert.equal(run.tray.tooltip, '', 'Windows must not show a native horizontal tray tooltip');
  assert.equal(run.tray.image.template, false);
  assert.equal(path.basename(run.tray.image.path), 'tray.png');
});

test('existing legacy named profiles are reused without moving or deleting their save', async t => {
  const run = await launch('拉姆陪伴'); t.after(() => run.cleanup());
  assert.equal(path.basename(run.app.userData), '拉姆陪伴');
  assert.equal(fs.existsSync(path.join(run.app.userData, 'Local Storage')), true);
});

test('explicit test/user profiles take priority over migration and leave old data untouched', async t => {
  const run = await launch('mole-baby', true); t.after(() => run.cleanup());
  assert.equal(path.basename(run.app.userData), 'isolated-cli');
  assert.equal(fs.existsSync(path.join(path.dirname(run.app.userData), 'mole-baby', 'Local Storage')), true);
});

test('window close and minimize hide to tray, cancel pending audio/model work, and can restore', async t => {
  const run = await launch(); t.after(() => run.cleanup());
  run.invoke('desktop:set-pet-mode', true); run.send('desktop:ready-to-show', true);
  let prevented = false;
  run.window.emit('close', { preventDefault() { prevented = true; } });
  assert.equal(prevented, true); assert.equal(run.stats.quit, 0);
  assert.equal(run.window.isVisible(), false);
  assert.equal([...run.handles.keys()].some(key=>key.startsWith('companion-')),false);
  assert.equal(fs.existsSync(path.join(run.app.userData, 'window-state.json')), true);
  run.tray.emit('click'); assert.equal(run.window.isVisible(), true);
  run.window.emit('minimize', { preventDefault() {} });
  assert.equal(run.window.isVisible(), false); assert.equal(run.stats.quit, 0);
  run.send('desktop:ready-to-show', false);
  assert.equal(run.window.isVisible(), false, 'abandonment updates must not reopen a hidden adoption window');
  run.tray.emit('double-click');
  assert.equal(run.window.getBounds().width, 1180, 'an unadopted pet restores the full adoption form');
});

test('renderer close has no quit authority; only tray exit quits and destroys the tray', async t => {
  const run = await launch(); t.after(() => run.cleanup());
  run.send('desktop:ready-to-show', true); run.send('desktop:close');
  assert.equal(run.stats.quit, 0); assert.equal(run.window.isVisible(), false);
  assert.equal(run.handles.has('desktop:quit'), false); assert.equal(run.listeners.has('desktop:quit'), false);
  run.tray.menu.find(item => item.label === '退出拉姆').click();
  assert.equal(run.stats.quit, 1); assert.equal(run.tray.destroyed, true);
});

test('seed/sleep disables autonomous movement while manual dragging remains available', async t => {
  const run = await launch(); t.after(() => run.cleanup());
  run.invoke('desktop:set-pet-mode', true); run.send('desktop:ready-to-show', true);
  const initial = run.window.getBounds();
  run.invoke('desktop:set-pet-can-move', false);
  assert.equal(run.invoke('desktop:start-pet-drag'), true);
  assert.equal(run.invoke('desktop:move-pet', -100, 0), true);
  assert.equal(run.window.getBounds().x, initial.x - 100);
  run.invoke('desktop:end-pet-drag');
  assert.equal(run.invoke('desktop:get-state').edgePose, 'visible', 'a centrally placed seed stays visible');
  assert.equal(run.invoke('desktop:get-state').wandering, false);
  run.invoke('desktop:move-pet', 5000, -300);
  const edgeY=run.window.getBounds().y;
  run.invoke('desktop:end-pet-drag');
  assert.equal(run.invoke('desktop:get-state').edgeSide, 'right');
  assert.equal(run.window.getBounds().y, edgeY, 'seed edge placement preserves the selected vertical position');
  assert.equal(run.invoke('desktop:get-state').wandering, false, 'hiding never enables seed locomotion');
  run.invoke('desktop:reveal-pet');
  run.invoke('desktop:set-pet-can-move', true);
  assert.equal(run.invoke('desktop:get-state').wandering, true, 'waking up restores the existing walk preference');
  assert.equal(run.invoke('desktop:set-interacting', true), true);
  run.invoke('desktop:set-companion-panel', true);
  assert.equal(run.invoke('desktop:get-state').panelGeometry.panelHeight,216);
  assert.equal(run.invoke('desktop:get-state').edgePose, 'visible');
});

test('macOS is menu-bar resident, never flashes before readiness, and uses native editing shortcuts', async t => {
  const run = await launch(undefined, false, 'darwin'); t.after(() => run.cleanup());
  assert.equal(run.stats.dockHidden, true);
  assert.equal(run.window.options.enableLargerThanScreen, true, 'frameless Mac windows must be able to place their transparent top margin beyond the menu bar');
  assert.equal(run.tray.image.template, true, 'AppKit must tint the Mac menu-bar glyph');
  assert.equal(path.basename(run.tray.image.path), 'tray-mac.png');
  assert.ok(run.stats.appMenu.some(item => item.role === 'editMenu'));
  run.app.emit('activate');
  assert.equal(run.window.isVisible(), false, 'early macOS activation cannot flash the room');
  run.invoke('desktop:set-pet-mode', true); run.send('desktop:ready-to-show', true);
  assert.equal(run.window.allSpaces, true);
  assert.equal(run.window.spaceOptions.visibleOnFullScreen, true);
  run.send('desktop:close'); run.tray.emit('click');
  assert.equal(run.window.isVisible(), false, 'opening the status menu must not also restore the window');
  run.tray.menu.find(item => item.label === '显示拉姆').click();
  assert.equal(run.window.isVisible(), true);
  run.invoke('desktop:set-pet-mode', false);
  assert.equal(run.window.allSpaces, false, 'the room stays in its own desktop space');
  run.stats.appMenu[0].submenu.find(item => item.accelerator === 'Command+Q').click();
  assert.equal(run.stats.quit, 1);
});

test('docked pets only peek on hover, wait minutes between automatic peeks and require a drag to release',async t=>{
 t.mock.timers.enable({apis:['setTimeout','Date'],now:1_800_000_000_000});
 const run=await launch();t.after(()=>run.cleanup());run.invoke('desktop:set-pet-mode',true);run.send('desktop:ready-to-show',true);run.invoke('desktop:set-pet-can-move',false);
 run.invoke('desktop:start-pet-drag');run.invoke('desktop:move-pet',5000,-200);run.invoke('desktop:end-pet-drag');
 assert.equal(run.invoke('desktop:get-state').edgePose,'tucking');
 t.mock.timers.tick(1799);assert.equal(run.invoke('desktop:get-state').edgePose,'tucking');
 t.mock.timers.tick(1);assert.equal(run.invoke('desktop:get-state').edgePose,'hidden');
 const due=run.invoke('desktop:get-state').edgeNextPeekAt;assert.ok(due-Date.now()>118000&&due-Date.now()<=300000);
 t.mock.timers.tick(118000);assert.equal(run.invoke('desktop:get-state').edgePose,'hidden');
 t.mock.timers.tick(due-Date.now()+1);assert.equal(run.invoke('desktop:get-state').edgePose,'peek');
 run.invoke('desktop:set-interacting',true);assert.equal(run.invoke('desktop:get-state').edgeSide,'right');run.invoke('desktop:set-interacting',false);
 run.invoke('desktop:set-edge-hovered',true);t.mock.timers.tick(600000);assert.equal(run.invoke('desktop:get-state').edgePose,'peek');assert.equal(run.invoke('desktop:get-state').edgeSide,'right');
 run.invoke('desktop:set-edge-hovered',false);assert.equal(run.invoke('desktop:get-state').edgePose,'hidden');
 run.invoke('desktop:start-pet-drag');run.invoke('desktop:move-pet',-200,0);run.invoke('desktop:end-pet-drag');assert.equal(run.invoke('desktop:get-state').edgeSide,null);
});

test('all four seed docks finish entering, only peek on hover, and release by dragging',async t=>{
 t.mock.timers.enable({apis:['setTimeout','Date'],now:1_800_000_000_000});
 const run=await launch();t.after(()=>run.cleanup());run.invoke('desktop:set-pet-mode',true);run.send('desktop:ready-to-show',true);run.invoke('desktop:set-pet-can-move',false);
 for(const[side,delta,pull]of[['left',[-5000,0],[250,0]],['right',[5000,0],[-250,0]],['top',[0,-5000],[0,250]],['bottom',[0,5000],[0,-250]]]){
   const hidden=require('./desktop-geometry.cjs').edgeOffset(side,'hidden','seed'),peek=require('./desktop-geometry.cjs').edgeOffset(side,'peek','seed');
   run.invoke('desktop:move-pet',900-run.window.getBounds().x,400-run.window.getBounds().y);
   run.invoke('desktop:start-pet-drag');run.invoke('desktop:move-pet',...delta);run.invoke('desktop:set-interacting',true);run.invoke('desktop:end-pet-drag');
   assert.equal(run.invoke('desktop:get-state').edgeSide,side);
   assert.equal(run.invoke('desktop:get-state').edgePose,'tucking');
   assert.deepEqual({...run.invoke('desktop:get-state').edgeOffset},hidden);
   const anchor=run.window.getBounds();
   t.mock.timers.tick(1800);assert.equal(run.invoke('desktop:get-state').edgePose,'hidden');
   run.invoke('desktop:set-edge-hovered',true);
   assert.equal(run.invoke('desktop:get-state').edgePose,'peek');
   assert.deepEqual({...run.invoke('desktop:get-state').edgeOffset},peek);
   assert.deepEqual(run.window.getBounds(),anchor,'hover changes the renderer pose without releasing the native anchor');
   t.mock.timers.tick(600000);assert.equal(run.invoke('desktop:get-state').edgePose,'peek');
   run.invoke('desktop:start-pet-drag',peek);
   assert.equal(run.window.getBounds().x,anchor.x+Math.round(peek.x));assert.equal(run.window.getBounds().y,anchor.y+Math.round(peek.y));
   run.invoke('desktop:move-pet',...pull);run.invoke('desktop:end-pet-drag');
   assert.equal(run.invoke('desktop:get-state').edgeSide,null);assert.equal(run.invoke('desktop:get-state').edgePose,'visible');
   assert.deepEqual({...run.invoke('desktop:get-state').edgeOffset},{x:0,y:0});
   t.mock.timers.tick(500000);assert.equal(run.invoke('desktop:get-state').edgeSide,null,'old peek timers cannot redock a released pet');
 }
});

test('dragging during any entering animation uses the actual painted offset and cancels old timers',async t=>{
 t.mock.timers.enable({apis:['setTimeout','Date'],now:1_800_000_000_000});
 const run=await launch();t.after(()=>run.cleanup());run.invoke('desktop:set-pet-mode',true);run.send('desktop:ready-to-show',true);run.invoke('desktop:set-pet-can-move',false);
 for (const [side,delta,painted,pull] of [
   ['left',[-5000,0],{x:-21,y:0},[200,0]],['right',[5000,0],{x:25,y:0},[-200,0]],
   ['top',[0,-5000],{x:0,y:-17},[0,200]],['bottom',[0,5000],{x:0,y:32},[0,-200]],
 ]) {
   run.invoke('desktop:move-pet',900-run.window.getBounds().x,400-run.window.getBounds().y);
   run.invoke('desktop:start-pet-drag');run.invoke('desktop:move-pet',...delta);run.invoke('desktop:set-interacting',true);run.invoke('desktop:end-pet-drag');
   assert.equal(run.invoke('desktop:get-state').edgeSide,side);assert.equal(run.invoke('desktop:get-state').edgePose,'tucking');
   t.mock.timers.tick(600);const before=run.window.getBounds();
   run.invoke('desktop:start-pet-drag',painted);
   assert.equal(run.window.getBounds().x,before.x+painted.x);assert.equal(run.window.getBounds().y,before.y+painted.y);
   run.invoke('desktop:move-pet',...pull);run.invoke('desktop:end-pet-drag');
   t.mock.timers.tick(2000);assert.equal(run.invoke('desktop:get-state').edgeSide,null);assert.equal(run.invoke('desktop:get-state').edgePose,'visible');
 }
});

test('hover and interaction during entry never restart or strand its finite deadline',async t=>{
 t.mock.timers.enable({apis:['setTimeout','Date'],now:1_800_000_000_000});
 const run=await launch();t.after(()=>run.cleanup());run.invoke('desktop:set-pet-mode',true);run.send('desktop:ready-to-show',true);run.invoke('desktop:set-pet-can-move',false);
 run.invoke('desktop:move-pet',5000,-200);run.invoke('desktop:end-pet-drag');
 t.mock.timers.tick(1000);run.invoke('desktop:set-edge-hovered',true);run.invoke('desktop:set-interacting',true);
 run.invoke('desktop:set-interacting',false);t.mock.timers.tick(799);
 assert.equal(run.invoke('desktop:get-state').edgePose,'tucking');t.mock.timers.tick(1);
 assert.equal(run.invoke('desktop:get-state').edgePose,'peek');assert.equal(run.invoke('desktop:get-state').edgeSide,'right');
 run.invoke('desktop:set-edge-hovered',false);assert.equal(run.invoke('desktop:get-state').edgePose,'hidden');
 assert.ok(run.invoke('desktop:get-state').edgeNextPeekAt>Date.now()+118000);
});

test('invalid painted drag offsets fail before changing bounds or releasing a dock',async t=>{
 const run=await launch();t.after(()=>run.cleanup());run.invoke('desktop:set-pet-mode',true);run.send('desktop:ready-to-show',true);run.invoke('desktop:set-pet-can-move',false);
 run.invoke('desktop:move-pet',5000,-200);run.invoke('desktop:end-pet-drag');const before=run.window.getBounds();
 for(const bad of [null,{},[],{x:NaN,y:0},{x:0,y:Infinity},{x:83,y:0},{x:0,y:-93},{x:'0',y:0}]){
   assert.throws(()=>run.invoke('desktop:start-pet-drag',bad),/finite bounded/);
   assert.deepEqual(run.window.getBounds(),before);assert.equal(run.invoke('desktop:get-state').edgeSide,'right');
 }
 assert.equal(run.invoke('desktop:start-pet-drag'),true,'the original no-argument API remains available');
 run.invoke('desktop:move-pet',-250,0);run.invoke('desktop:end-pet-drag');
});

test('expanded panels and monitor recovery keep content visible after an edge placement',async t=>{
 t.mock.timers.enable({apis:['setTimeout','Date'],now:1_800_000_000_000});
 const run=await launch();t.after(()=>run.cleanup());run.invoke('desktop:set-pet-mode',true);run.send('desktop:ready-to-show',true);run.invoke('desktop:set-pet-can-move',false);
 run.invoke('desktop:move-pet',-5000,-5000);run.invoke('desktop:end-pet-drag');
 run.invoke('desktop:set-companion-panel',true);let bounds=run.window.getBounds();
 const g=run.invoke('desktop:get-state').panelGeometry;assert.ok(bounds.x+g.panelX>=0&&bounds.y+g.panelY>=0&&bounds.x+g.panelX+g.panelWidth<=1920&&bounds.y+g.panelY+g.panelHeight<=1040);
 assert.equal(run.invoke('desktop:get-state').edgeSide,null);assert.equal(run.invoke('desktop:get-state').edgePose,'visible');
 run.invoke('desktop:set-companion-panel',false);run.invoke('desktop:move-pet',5000,5000);run.invoke('desktop:end-pet-drag');
 run.display.workArea={x:-1280,y:-200,width:1280,height:800};run.screen.emit('display-removed');bounds=run.window.getBounds();
 assert.ok(bounds.x+30>=-1280&&bounds.x+130<=0&&bounds.y+71>=-200&&bounds.y+179<=600);
 assert.equal(run.invoke('desktop:get-state').edgeSide,null);assert.deepEqual({...run.invoke('desktop:get-state').edgeOffset},{x:0,y:0});
 t.mock.timers.tick(2000);assert.equal(run.invoke('desktop:get-state').edgeSide,null,'display recovery cancels the old entering timer');
});


test('autonomous movement is larger in both axes but stays around the manually placed pet',async t=>{
 t.mock.timers.enable({apis:['setTimeout','setInterval','Date'],now:1_800_000_000_000});
 const run=await launch();t.after(()=>run.cleanup());run.invoke('desktop:set-pet-mode',true);run.send('desktop:ready-to-show',true);run.invoke('desktop:set-edge-hiding',false);run.invoke('desktop:move-pet',-500,-350);run.invoke('desktop:wander',true);const home=run.window.getBounds(),ys=new Set();
 for(let n=0;n<30;n++){t.mock.timers.tick(20000);t.mock.timers.tick(2500);const p=run.window.getBounds();assert.ok(Math.abs(p.x-home.x)<=150&&Math.abs(p.y-home.y)<=100);ys.add(p.y);}assert.ok(ys.size>2);
});
test('opening and closing a small pocket repeatedly preserves every pet placement',async t=>{
 const run=await launch();t.after(()=>run.cleanup());run.invoke('desktop:set-pet-mode',true);run.send('desktop:ready-to-show',true);
 for(const point of [{x:1754,y:792},{x:730,y:300},{x:-30,y:-71}]){run.window.setBounds({...point,width:160,height:240});for(let i=0;i<20;i++){const state=run.invoke('desktop:set-companion-panel',true),g=state.panelGeometry,b=run.window.getBounds();assert.equal(b.x+g.petX,point.x);assert.equal(b.y+g.petY,point.y);assert.equal(g.panelHeight,216);run.invoke('desktop:set-companion-panel',false);assert.deepEqual(run.window.getBounds(),{...point,width:160,height:240});}}
});
test('native cursor dragging has no cumulative downward drift, even with clamped Windows frames',async t=>{
 t.mock.timers.enable({apis:['setTimeout','setInterval','Date'],now:1_800_000_000_000});
 const run=await launch(undefined,false,'win32',{clamp:true});t.after(()=>run.cleanup());run.invoke('desktop:set-pet-mode',true);run.send('desktop:ready-to-show',true);run.invoke('desktop:set-edge-hiding',false);run.invoke('desktop:move-pet',-800,-300);
 const logical=()=>{const b=run.window.getBounds(),s=run.invoke('desktop:get-state');return {x:b.x+s.petOffset.x,y:b.y+s.petOffset.y}};
 const start=logical();run.invoke('desktop:prepare-pet-drag');run.invoke('desktop:start-pet-drag');
 for(let i=1;i<=100;i++){run.cursor.y=400-i*2;run.invoke('desktop:drag-pet-to-cursor');t.mock.timers.tick(32);assert.equal(logical().y,start.y-i*2);}
 run.cursor.y=400;run.invoke('desktop:drag-pet-to-cursor');assert.deepEqual(logical(),start);run.invoke('desktop:end-pet-drag');
 run.invoke('desktop:set-edge-hiding',true);
 for(const[side,dx,dy]of[['top',0,-5000],['left',-5000,0],['bottom',0,5000],['right',5000,0]]){run.invoke('desktop:move-pet',800-logical().x,400-logical().y);run.invoke('desktop:move-pet',dx,dy);run.invoke('desktop:end-pet-drag');assert.equal(run.invoke('desktop:get-state').edgeSide,side);t.mock.timers.tick(1800);assert.equal(run.invoke('desktop:get-state').edgePose,'hidden');}
});
test('tray pin and explicit mouse-through survive automatic hit tests and restart storage',async t=>{
 const run=await launch();t.after(()=>run.cleanup());run.invoke('desktop:set-pet-mode',true);run.send('desktop:ready-to-show',true);
 assert.ok(run.tray.menu.some(i=>i.label==='拉姆置顶'));assert.ok(run.tray.menu.some(i=>i.label==='鼠标穿透'));
 run.invoke('desktop:toggle-always-on-top');assert.equal(run.window.isAlwaysOnTop(),false);run.invoke('desktop:set-pet-mode',false);run.invoke('desktop:set-pet-mode',true);assert.equal(run.window.isAlwaysOnTop(),false);
 run.invoke('desktop:set-pet-mode',false);run.tray.menu.find(i=>i.label==='拉姆置顶').click({checked:true});assert.equal(run.tray.menu.find(i=>i.label==='拉姆置顶').checked,true);run.invoke('desktop:set-pet-mode',true);assert.equal(run.window.isAlwaysOnTop(),true);
 run.invoke('desktop:set-mouse-through',true);run.send('desktop:set-mouse-passthrough',false);assert.equal(run.invoke('desktop:get-state').mouseThrough,true);assert.equal(run.invoke('desktop:prepare-pet-drag'),false);run.send('desktop:hide-to-tray');const prefs=JSON.parse(fs.readFileSync(path.join(run.app.userData,'window-state.json')));assert.equal(prefs.mouseThrough,true);assert.equal(prefs.petAlwaysOnTop,true);run.invoke('desktop:set-mouse-through',false);assert.equal(run.invoke('desktop:get-state').mouseThrough,false);
});
test('upgrade removes retired API credentials without registering AI or speech endpoints',async t=>{
 const run=await launch(undefined,false,'win32',{key:true});t.after(()=>run.cleanup());assert.equal(fs.existsSync(path.join(run.app.userData,'companion-ai-key.json')),false);assert.equal([...run.handles.keys()].some(k=>/companion-(ai|speech)/.test(k)),false);
});

test('Windows keeps its frameless resize style stable through room, pocket and pet changes',async t=>{const run=await launch();t.after(()=>run.cleanup());for(let i=0;i<8;i++){run.invoke('desktop:set-pet-mode',true);assert.deepEqual(run.window.minimum,[160,240]);assert.deepEqual(run.window.maximum,[160,240]);run.invoke('desktop:set-companion-panel',true);assert.deepEqual(run.window.maximum,[run.window.bounds.width,run.window.bounds.height]);run.invoke('desktop:set-companion-panel',false);run.invoke('desktop:set-pet-mode',false);assert.deepEqual(run.window.maximum,[0,0]);}assert.deepEqual(run.window.resizeChanges??[],[]);assert.equal(run.window.options.frame,false);assert.equal(run.window.options.thickFrame,false)})

test('every appearance uses its calibrated exposure on four native edge states',async t=>{const run=await launch();t.after(()=>run.cleanup());run.invoke('desktop:set-pet-mode',true);run.send('desktop:ready-to-show',true);run.invoke('desktop:set-pet-can-move',false);for(const form of Object.keys(require('./edge-visibility.json').forms)){run.invoke('desktop:set-pet-appearance',form);for(const[side,dx,dy]of[['left',-5000,0],['right',5000,0],['top',0,-5000],['bottom',0,5000]]){run.invoke('desktop:reveal-pet');run.invoke('desktop:move-pet',900-run.window.bounds.x,400-run.window.bounds.y);run.invoke('desktop:start-pet-drag');run.invoke('desktop:move-pet',dx,dy);run.invoke('desktop:end-pet-drag');const state=run.invoke('desktop:get-state');assert.equal(state.edgeSide,side);assert.deepEqual({...state.edgeOffset},require('./desktop-geometry.cjs').edgeOffset(side,'hidden',form));}}assert.throws(()=>run.invoke('desktop:set-pet-appearance','unknown'),/Unknown pet appearance/)})
