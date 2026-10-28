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
  const stats = { quit: 0, dialogs: [] };
  const cursor={x:900,y:400};
  if(options.key){fs.mkdirSync(path.join(profile,'mole-baby'),{recursive:true});fs.writeFileSync(path.join(profile,'mole-baby','companion-ai-key.json'),'retired-test-key');}
  const app = new EventEmitter();
  app.isPackaged = true;
  app.commandLine = { getSwitchValue: () => customProfile ? path.join(profile, 'isolated-cli') : '',appendSwitch:name=>{(stats.switches??=[]).push(name)} };
  app.disableHardwareAcceleration=()=>{assert.equal(windows.length,0,'CPU rendering must be selected before creating a window');stats.hardwareAccelerationDisabled=true};
  app.getPath = key => key === 'appData' ? profile : app.userData || path.join(profile, '拉姆');
  app.setPath = (key, value) => { if (key === 'userData') app.userData = value; };
  app.setName = value => { app.name = value; };
  app.setAppUserModelId = value => {stats.appId=value};
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
    setTitle(value) { this.title = value; }
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
    Notification: { isSupported: () => false }, dialog:{showMessageBox:async(...args)=>{stats.dialogs.push({parent:args.length===2?args[0]:null,options:args.at(-1)});return{response:options.dialogAnswers?.shift()??1}}} };
  const localRequire = name => name === 'electron' ? electron : name==='../package.json'&&options.edition ? {...require('../package.json'),windowsEdition:options.edition} : name==='./updates.cjs'&&options.updateFactory ? {createUpdates:options.updateFactory} : name.startsWith('./') ? require(path.join(__dirname,name)) : require(name);
  const runtimeProcess = Object.create(process);
  Object.defineProperty(runtimeProcess, 'platform', { value: platform });
  // The simulated Windows app is x64 regardless of the host running tests
  // (including Apple Silicon); explicit ia32 fixtures override this default.
  Object.defineProperty(runtimeProcess,'arch',{value:options.arch??(platform==='win32'?'x64':process.arch)});
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

test('tray state refreshes while hidden, clears on farewell and rejects untrusted senders',async t=>{
 const run=await launch();t.after(()=>run.cleanup());
 const pet={name:'小叶',stage:2,sleeping:false,stats:{hunger:80,thirst:90,cleanliness:70,happiness:60,health:100,energy:30}};
 run.send('desktop:ready-to-show',true);run.invoke('desktop:set-pet-status',pet);
 assert.match(run.tray.tooltip,/小叶/);assert.match(run.tray.tooltip,/精力 30/);
 run.send('desktop:hide-to-tray');run.invoke('desktop:set-pet-status',{...pet,sleeping:true,stats:{...pet.stats,energy:40}});
 assert.equal(run.window.isVisible(),false);assert.match(run.tray.tooltip,/睡觉中/);assert.match(run.tray.tooltip,/精力 40/);
 assert.throws(()=>run.handles.get('desktop:set-pet-status')({sender:{},senderFrame:{}},pet),/Untrusted/);
 run.send('desktop:ready-to-show',false);assert.equal(run.tray.tooltip,'拉姆 · 等待领养');
});

for(const platform of ['win32','darwin','linux'])test(`${platform}: expanded spell host preserves anchor, respects screen edges and restores after completion/interruption`,async t=>{
 const run=await launch(undefined,false,platform);t.after(()=>run.cleanup());
 run.invoke('desktop:set-pet-mode',true);run.send('desktop:ready-to-show',true);
 const base=run.window.getBounds(),effect={x:-400,y:-800,width:1000,height:1200};
 run.invoke('desktop:set-pet-effect-bounds',effect);
 const bounds=run.window.getBounds(),state=run.invoke('desktop:get-state');
 assert.equal(bounds.x+state.petOffset.x,base.x);assert.equal(bounds.y+state.petOffset.y,base.y);
 assert.ok(bounds.width>base.width&&bounds.height>base.height);
 assert.ok(bounds.x>=0&&bounds.y>=0&&bounds.x+bounds.width<=1920&&bounds.y+bounds.height<=1040);
 assert.equal(state.effectExpanded,true);assert.equal(run.invoke('desktop:prepare-pet-drag'),false);
 assert.equal(run.invoke('desktop:move-pet',40,40),false);
 run.invoke('desktop:set-pet-effect-bounds',null);assert.deepEqual(run.window.getBounds(),base);
 run.invoke('desktop:set-pet-effect-bounds',effect);run.invoke('desktop:set-companion-panel',true);
 assert.equal(run.invoke('desktop:get-state').effectExpanded,false);
 run.invoke('desktop:set-companion-panel',false);assert.deepEqual(run.window.getBounds(),base);
 run.invoke('desktop:set-pet-effect-bounds',effect);run.invoke('desktop:set-pet-mode',false);
 assert.equal(run.invoke('desktop:get-state').effectExpanded,false);
 run.invoke('desktop:set-pet-mode',true);assert.deepEqual(run.window.getBounds(),base);
 for(const bad of [{...effect,width:Infinity},{...effect,x:-5000},{...effect,height:0},[],true])assert.throws(()=>run.invoke('desktop:set-pet-effect-bounds',bad));
});

test('startup waits for the correctly painted mode, and keeps the old profile through rename', async t => {
  const run = await launch(); t.after(() => run.cleanup());
  assert.equal(run.app.name, '拉姆');
  assert.equal(run.stats.hardwareAccelerationDisabled,undefined);
  assert.equal(run.stats.appId,'com.molebaby.ramuhouse');
  assert.equal(path.basename(run.app.userData), 'mole-baby');
  assert.equal(run.window.options.title, '');
  assert.equal(run.window.options.resizable, false);
  let titlePrevented=false;
  run.window.webContents.emit('page-title-updated',{preventDefault(){titlePrevented=true}},'拉姆 · mole-baby');
  assert.equal(titlePrevented,true,'web page titles cannot restore a Windows caption');
  assert.equal(run.window.title,'');
  assert.equal(run.window.options.skipTaskbar, true);
  assert.equal(run.window.options.enableLargerThanScreen, false);
  run.window.emit('ready-to-show');
  assert.equal(run.window.isVisible(), false, 'Electron paint readiness must not flash the large room');
  run.invoke('desktop:set-pet-mode', true);
  run.send('desktop:ready-to-show', true);
  assert.equal(run.window.isVisible(), true);
  assert.deepEqual(run.window.getBounds(), { x: 1754, y: 792, width: 160, height: 240 });
  assert.equal(run.tray.tooltip, '拉姆 · 等待领养');
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


function consentFixture(){
 let state={status:'available',version:'1.1.0',automaticInstall:true,enabled:true},options;
 const calls={checks:[],downloads:[],installs:[]};
 const api={getState:()=>({...state}),start(){},wake(){},dispose(){},check:async manual=>{calls.checks.push(manual);return true},setEnabled:value=>{state.enabled=value;return{...state}},download:async confirmed=>{calls.downloads.push(confirmed);return true},install:async confirmed=>{calls.installs.push(confirmed);return true}};
 return{calls,factory:config=>{options=config;return api},state:patch=>{state={...state,...patch};options.onChange({...state})},available:()=>options.onAvailable({...state}),ready:()=>options.onReady({...state})};
}

test('actual update IPC and tray actions ask before granting download or install consent',async t=>{
 const updates=consentFixture(),answers=[1,0,1,0];
 const run=await launch(undefined,false,'win32',{updateFactory:updates.factory,dialogAnswers:answers});t.after(()=>run.cleanup());
 assert.equal(await run.invoke('updates:download'),false);assert.deepEqual(updates.calls.downloads,[]);
 assert.match(run.stats.dialogs[0].options.message,/1\.1\.0/);assert.equal(run.stats.dialogs[0].options.defaultId,1);assert.equal(run.stats.dialogs[0].options.cancelId,1);
 assert.equal(run.stats.dialogs[0].parent,null,'a tray-only pet uses a standalone visible native prompt');
 assert.equal(await run.invoke('updates:download'),true);assert.deepEqual(updates.calls.downloads,[true]);assert.deepEqual(updates.calls.installs,[]);
 updates.state({status:'ready'});run.invoke('desktop:set-pet-mode',true);run.send('desktop:ready-to-show',true);
 run.tray.menu.find(item=>item.label==='更新并重启拉姆').click();await new Promise(r=>setImmediate(r));assert.deepEqual(updates.calls.installs,[]);
 run.tray.menu.find(item=>item.label==='更新并重启拉姆').click();await new Promise(r=>setImmediate(r));assert.deepEqual(updates.calls.installs,[true]);
 assert.equal(run.stats.dialogs.at(-1).parent,run.window,'a visible pet owns its native prompt');
});

test('detected and downloaded release callbacks offer one native confirmation per version',async t=>{
 const updates=consentFixture(),answers=[1,1];
 const run=await launch(undefined,false,'win32',{updateFactory:updates.factory,dialogAnswers:answers});t.after(()=>run.cleanup());
 updates.available();updates.available();await new Promise(r=>setImmediate(r));assert.equal(run.stats.dialogs.length,1);assert.deepEqual(updates.calls.downloads,[]);
 updates.available();await new Promise(r=>setImmediate(r));assert.equal(run.stats.dialogs.length,1);
 updates.state({status:'ready'});updates.ready();updates.ready();await new Promise(r=>setImmediate(r));assert.equal(run.stats.dialogs.length,2);assert.deepEqual(updates.calls.installs,[]);
 assert.match(run.stats.dialogs[1].options.detail,/退出时也不会自动安装/);
 run.tray.menu.find(item=>item.label==='退出拉姆').click();assert.equal(run.stats.quit,1);assert.deepEqual(updates.calls.installs,[]);
});

test('the actual install IPC also requires a fresh native answer',async t=>{
 const updates=consentFixture(),answers=[1,0],run=await launch(undefined,false,'win32',{updateFactory:updates.factory,dialogAnswers:answers});t.after(()=>run.cleanup());updates.state({status:'ready'});
 assert.equal(await run.invoke('updates:install'),false);assert.deepEqual(updates.calls.installs,[]);
 assert.equal(await run.invoke('updates:install'),true);assert.deepEqual(updates.calls.installs,[true]);assert.deepEqual(updates.calls.downloads,[]);
});

test('the tray download action cannot bypass the same confirmation as settings',async t=>{
 const updates=consentFixture(),answers=[1,0],run=await launch(undefined,false,'win32',{updateFactory:updates.factory,dialogAnswers:answers});t.after(()=>run.cleanup());
 run.tray.menu.find(item=>item.label==='下载新版本').click();await new Promise(r=>setImmediate(r));assert.deepEqual(updates.calls.downloads,[]);
 run.tray.menu.find(item=>item.label==='下载新版本').click();await new Promise(r=>setImmediate(r));assert.deepEqual(updates.calls.downloads,[true]);assert.deepEqual(updates.calls.installs,[]);
});

test('legacy Windows isolates its Chromium profile and keeps architecture-specific update identity',async t=>{
 for(const arch of ['ia32','x64']){
  const run=await launch('mole-baby',false,'win32',{edition:'legacy',arch});t.after(()=>run.cleanup());
  assert.equal(run.app.name,'拉姆兼容版');assert.equal(path.basename(run.app.userData),'mole-baby-legacy');
  assert.equal(run.stats.hardwareAccelerationDisabled,true);
  assert.deepEqual(run.stats.switches,['disable-gpu','disable-gpu-sandbox']);
  assert.equal(run.window.options.webPreferences.sandbox,true);
  assert.equal(run.window.options.webPreferences.contextIsolation,true);
  assert.equal(run.stats.appId,'com.molebaby.ramuhouse.legacy');
  assert.notEqual(path.basename(run.app.userData),'mole-baby','an older Chromium must not open the modern profile');
 }
});
