const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');

async function launch(legacyName, customProfile = false, platform = 'win32') {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'mole-native-'));
  if (legacyName) fs.mkdirSync(path.join(profile, legacyName, 'Local Storage'), { recursive: true });
  const handles = new Map(); const listeners = new Map(); const windows = [];
  const stats = { aiCancelled: 0, speechCancelled: 0, quit: 0 };
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
    setBounds(bounds) { this.bounds = { ...bounds }; }
    setPosition(x, y) { this.bounds.x = x; this.bounds.y = y; }
    setAlwaysOnTop(value) { this.top = value; }
    setVisibleOnAllWorkspaces(value, options) { this.allSpaces = value; this.spaceOptions = options; }
    setMinimumSize() {} setResizable() {} setIgnoreMouseEvents() {} setMenu() {}
    show() { this.visible = true; } hide() { this.visible = false; } focus() {} restore() {}
  }
  class FakeTray extends EventEmitter {
    constructor() { super(); FakeTray.instance = this; }
    isDestroyed() { return false; }
    setToolTip(text) { this.tooltip = text; }
    setContextMenu(menu) { this.menu = menu; }
    destroy() { this.destroyed = true; }
  }
  const screen = new EventEmitter();
  const display = { workArea: { x: 0, y: 0, width: 1920, height: 1040 } };
  screen.getPrimaryDisplay = screen.getDisplayMatching = () => display;
  const electron = { app, BrowserWindow: FakeWindow, screen, safeStorage: {}, Tray: FakeTray,
    Menu: { buildFromTemplate: template => template, setApplicationMenu: menu => { stats.appMenu = menu; } }, nativeImage: { createFromPath: value => value },
    ipcMain: { handle: (channel, fn) => handles.set(channel, fn), on: (channel, fn) => listeners.set(channel, fn) },
    Notification: { isSupported: () => false } };
  const companionAI = { cancel: () => stats.aiCancelled++, dispose() {} };
  const companionSpeech = { cancel: () => stats.speechCancelled++, dispose() {} };
  const localRequire = name => name === 'electron' ? electron
    : name === './deepseek.cjs' ? { createCompanionAI: () => companionAI }
      : name === './speech.cjs' ? { createCompanionSpeech: () => companionSpeech }
        : name.startsWith('./') ? require(path.join(__dirname, name)) : require(name);
  const runtimeProcess = Object.create(process);
  Object.defineProperty(runtimeProcess, 'platform', { value: platform });
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, 'main.cjs'), 'utf8'), {
    require: localRequire, __dirname, console, URL, Date, process: runtimeProcess,
    setTimeout, clearTimeout, setInterval, clearInterval,
  }, { filename: 'main.cjs' });
  await new Promise(resolve => setImmediate(resolve));
  const window = windows[0]; const tray = FakeTray.instance;
  const event = { sender: window.webContents, senderFrame: window.webContents.mainFrame };
  return {
    app, window, tray, stats, handles, listeners,
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
  run.window.emit('ready-to-show');
  assert.equal(run.window.isVisible(), false, 'Electron paint readiness must not flash the large room');
  run.invoke('desktop:set-pet-mode', true);
  run.send('desktop:ready-to-show', true);
  assert.equal(run.window.isVisible(), true);
  assert.deepEqual(run.window.getBounds(), { x: 1754, y: 792, width: 160, height: 240 });
  assert.equal(run.tray.tooltip, '拉姆 · mole-baby');
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
  assert.equal(run.stats.aiCancelled, 1); assert.equal(run.stats.speechCancelled, 1);
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
  assert.equal(run.window.getBounds().height, 490);
  assert.equal(run.invoke('desktop:get-state').edgePose, 'visible');
});

test('macOS is menu-bar resident, never flashes before readiness, and uses native editing shortcuts', async t => {
  const run = await launch(undefined, false, 'darwin'); t.after(() => run.cleanup());
  assert.equal(run.stats.dockHidden, true);
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
 t.mock.timers.tick(1601);assert.equal(run.invoke('desktop:get-state').edgePose,'hidden');
 const due=run.invoke('desktop:get-state').edgeNextPeekAt;assert.ok(due-Date.now()>118000&&due-Date.now()<=300000);
 t.mock.timers.tick(118000);assert.equal(run.invoke('desktop:get-state').edgePose,'hidden');
 t.mock.timers.tick(due-Date.now()+1);assert.equal(run.invoke('desktop:get-state').edgePose,'peek');
 run.invoke('desktop:set-interacting',true);assert.equal(run.invoke('desktop:get-state').edgeSide,'right');run.invoke('desktop:set-interacting',false);
 run.invoke('desktop:set-edge-hovered',true);t.mock.timers.tick(600000);assert.equal(run.invoke('desktop:get-state').edgePose,'peek');assert.equal(run.invoke('desktop:get-state').edgeSide,'right');
 run.invoke('desktop:set-edge-hovered',false);assert.equal(run.invoke('desktop:get-state').edgePose,'hidden');
 run.invoke('desktop:start-pet-drag');run.invoke('desktop:move-pet',-200,0);run.invoke('desktop:end-pet-drag');assert.equal(run.invoke('desktop:get-state').edgeSide,null);
});

test('starting a drag before the edge tuck animation keeps the visible pet under the pointer',async t=>{
 const run=await launch();t.after(()=>run.cleanup());run.invoke('desktop:set-pet-mode',true);run.send('desktop:ready-to-show',true);run.invoke('desktop:set-pet-can-move',false);
 run.invoke('desktop:start-pet-drag');run.invoke('desktop:move-pet',5000,0);run.invoke('desktop:end-pet-drag');
 assert.equal(run.invoke('desktop:get-state').edgeSide,'right');assert.equal(run.invoke('desktop:get-state').edgePose,'visible');
 const before=run.window.getBounds();run.invoke('desktop:start-pet-drag');assert.equal(run.window.getBounds().x,before.x);
 run.invoke('desktop:move-pet',-200,0);run.invoke('desktop:end-pet-drag');assert.equal(run.invoke('desktop:get-state').edgeSide,null);
});
