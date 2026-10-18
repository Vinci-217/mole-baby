const { app, BrowserWindow, ipcMain, Notification, screen } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const NORMAL_SIZE = { width: 1180, height: 820 };
const NORMAL_MINIMUM = { width: 1000, height: 720 };
const PET_SIZE = { width: 360, height: 420 };
const DEVELOPMENT_URL = 'http://127.0.0.1:5173';
const INDEX_PATH = path.join(__dirname, '..', 'dist', 'index.html');

let mainWindow = null;
let rendererURL = '';
let petMode = false;
let normalBounds = null;
let petBounds = null;
let normalAlwaysOnTop = false;
let changingMode = false;
let saveTimer = null;
let wandering = false;
let dragging = false;
let wanderTimer = null;
let movementTimer = null;
let motion = 'idle';

function getDesktopState() {
  return {
    petMode,
    alwaysOnTop: Boolean(mainWindow && !mainWindow.isDestroyed() && mainWindow.isAlwaysOnTop()),
    wandering,
    motion,
  };
}

function publishState(includePetMode = false) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send('desktop:state-changed', getDesktopState());
  if (includePetMode) mainWindow.webContents.send('desktop:pet-mode-changed', petMode);
}

function stopMovement() {
  clearTimeout(wanderTimer);
  clearInterval(movementTimer);
  wanderTimer = null;
  movementTimer = null;
  changeMotion('idle');
}

function changeMotion(next) {
  if (next === motion) return;
  motion = next;
  publishState();
}

function canWander() {
  return mainWindow && !mainWindow.isDestroyed() && !mainWindow.isMinimized()
    && petMode && wandering && !dragging;
}

function scheduleWander() {
  clearTimeout(wanderTimer);
  wanderTimer = null;
  if (!canWander() || movementTimer) return;
  wanderTimer = setTimeout(walkAlongDesktop, 8000 + Math.random() * 7000);
}

function walkAlongDesktop() {
  wanderTimer = null;
  if (!canWander()) return;
  const start = mainWindow.getBounds();
  const area = screen.getDisplayMatching(start).workArea;
  const distance = 50 + Math.round(Math.random() * 70);
  let direction = Math.random() < 0.5 ? -1 : 1;
  if (start.x + direction * distance < area.x
    || start.x + direction * distance + start.width > area.x + area.width) direction *= -1;
  const target = clampBounds({
    ...start,
    x: start.x + direction * distance,
    y: area.y + area.height - start.height,
  }, PET_SIZE);
  const travel = Math.hypot(target.x - start.x, target.y - start.y);
  if (travel < 1) { scheduleWander(); return; }

  // Ease toward the bottom at a walking pace, including after the user has
  // placed the pet higher on the screen. Never teleport or activate the window.
  const duration = Math.max(1500, travel / 65 * 1000);
  const startedAt = Date.now();
  changeMotion(target.x < start.x ? 'left' : 'right');
  movementTimer = setInterval(() => {
    if (!canWander()) { stopMovement(); return; }
    const progress = Math.min(1, (Date.now() - startedAt) / duration);
    const eased = progress * progress * (3 - 2 * progress);
    const x = Math.round(start.x + (target.x - start.x) * eased);
    const y = Math.round(start.y + (target.y - start.y) * eased);
    const current = mainWindow.getBounds();
    if (x !== current.x || y !== current.y) mainWindow.setPosition(x, y, false);
    if (progress === 1) {
      clearInterval(movementTimer);
      movementTimer = null;
      changeMotion('idle');
      scheduleSave();
      scheduleWander();
    }
  }, 33);
}

function startPetDrag() {
  if (!petMode) return false;
  dragging = true;
  stopMovement();
  return true;
}

function endPetDrag() {
  dragging = false;
  scheduleSave();
  scheduleWander();
  return true;
}

function movePet(dx, dy) {
  if (typeof dx !== 'number' || typeof dy !== 'number'
    || !Number.isFinite(dx) || !Number.isFinite(dy)
    || Math.abs(dx) > 10000 || Math.abs(dy) > 10000) {
    throw new TypeError('Pet movement must use finite screen-coordinate deltas');
  }
  if (!petMode) return false;
  stopMovement();
  const current = mainWindow.getBounds();
  const target = clampBounds({ ...current, x: current.x + Math.round(dx), y: current.y + Math.round(dy) }, PET_SIZE);
  mainWindow.setPosition(target.x, target.y, false);
  scheduleSave();
  // movePet also works without explicit drag lifecycle calls: movement delays
  // the next walk. start/end keep wandering paused during a stationary hold.
  if (!dragging) scheduleWander();
  return true;
}

function changeWandering(enabled) {
  if (typeof enabled !== 'boolean') throw new TypeError('Wandering must be a boolean');
  wandering = enabled;
  stopMovement();
  scheduleWander();
  publishState();
  return wandering;
}

function settingsPath() {
  return path.join(app.getPath('userData'), 'window-state.json');
}

function validBounds(value) {
  return value && ['x', 'y', 'width', 'height'].every((key) =>
    Number.isInteger(value[key]) && Math.abs(value[key]) < 100000
  ) && value.width > 0 && value.height > 0;
}

function loadWindowState() {
  try {
    const state = JSON.parse(fs.readFileSync(settingsPath(), 'utf8'));
    normalBounds = validBounds(state.normalBounds) ? state.normalBounds : null;
    petBounds = validBounds(state.petBounds) ? state.petBounds : null;
    normalAlwaysOnTop = state.normalAlwaysOnTop === true;
  } catch {
    // A missing or interrupted preferences file should never prevent startup.
  }
}

function rememberBounds() {
  if (!mainWindow || mainWindow.isDestroyed() || changingMode || mainWindow.isMinimized()) return;
  if (petMode) petBounds = mainWindow.getBounds();
  else normalBounds = mainWindow.getNormalBounds();
}

function saveWindowState() {
  clearTimeout(saveTimer);
  saveTimer = null;
  rememberBounds();
  try {
    const filename = settingsPath();
    fs.mkdirSync(path.dirname(filename), { recursive: true });
    fs.writeFileSync(`${filename}.tmp`, JSON.stringify({ normalBounds, petBounds, normalAlwaysOnTop }));
    fs.renameSync(`${filename}.tmp`, filename);
  } catch (error) {
    console.warn('Unable to save window position:', error.code || error.name);
  }
}

function scheduleSave() {
  rememberBounds();
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveWindowState, 300);
}

function clampBounds(bounds, fallbackSize) {
  const display = validBounds(bounds) ? screen.getDisplayMatching(bounds) : screen.getPrimaryDisplay();
  const area = display.workArea;
  const minimum = fallbackSize === PET_SIZE ? PET_SIZE : NORMAL_MINIMUM;
  const width = Math.min(Math.max(minimum.width, Math.round(bounds?.width || fallbackSize.width)), area.width);
  const height = Math.min(Math.max(minimum.height, Math.round(bounds?.height || fallbackSize.height)), area.height);
  const x = bounds?.x ?? area.x + Math.round((area.width - width) / 2);
  const y = bounds?.y ?? area.y + Math.round((area.height - height) / 2);
  return {
    x: Math.round(Math.max(area.x, Math.min(x, area.x + area.width - width))),
    y: Math.round(Math.max(area.y, Math.min(y, area.y + area.height - height))),
    width,
    height,
  };
}

function applyMinimum(bounds, isPet) {
  const area = screen.getDisplayMatching(bounds).workArea;
  const size = isPet ? PET_SIZE : NORMAL_MINIMUM;
  mainWindow.setMinimumSize(Math.min(size.width, area.width), Math.min(size.height, area.height));
}

function isOurURL(url) {
  try {
    const candidate = new URL(url);
    const expected = new URL(rendererURL);
    return candidate.protocol === expected.protocol && candidate.host === expected.host
      && (candidate.protocol !== 'file:' || candidate.pathname === expected.pathname);
  } catch {
    return false;
  }
}

function isOurSender(event) {
  return mainWindow && !mainWindow.isDestroyed()
    && event.sender === mainWindow.webContents
    && event.senderFrame === mainWindow.webContents.mainFrame
    && isOurURL(event.senderFrame.url);
}

function handle(channel, callback) {
  ipcMain.handle(channel, (event, ...args) => {
    if (!isOurSender(event)) throw new Error('Untrusted desktop request');
    return callback(...args);
  });
}

function listen(channel, callback) {
  ipcMain.on(channel, (event, ...args) => {
    if (isOurSender(event)) callback(...args);
  });
}

function changePetMode(enabled) {
  if (typeof enabled !== 'boolean') throw new TypeError('Pet mode must be a boolean');
  if (enabled === petMode) return petMode;

  stopMovement();
  dragging = false;
  rememberBounds();
  changingMode = true;
  if (enabled) {
    normalAlwaysOnTop = mainWindow.isAlwaysOnTop();
    const current = normalBounds || mainWindow.getBounds();
    const target = clampBounds({
      x: petBounds?.x ?? current.x + current.width - PET_SIZE.width,
      y: petBounds?.y ?? current.y + current.height - PET_SIZE.height,
      ...PET_SIZE,
    }, PET_SIZE);
    petMode = true;
    applyMinimum(target, true);
    mainWindow.setResizable(false);
    mainWindow.setBounds(target);
    mainWindow.setAlwaysOnTop(true, 'floating');
    petBounds = target;
  } else {
    petMode = false;
    const target = clampBounds(normalBounds, NORMAL_SIZE);
    mainWindow.setResizable(true);
    applyMinimum(target, false);
    mainWindow.setBounds(target);
    mainWindow.setAlwaysOnTop(normalAlwaysOnTop, 'floating');
    normalBounds = target;
  }
  changingMode = false;
  publishState(true);
  saveWindowState();
  scheduleWander();
  return petMode;
}

function registerIPC() {
  listen('desktop:minimize', () => mainWindow.minimize());
  listen('desktop:close', () => app.quit());
  handle('desktop:toggle-always-on-top', () => {
    const enabled = !mainWindow.isAlwaysOnTop();
    mainWindow.setAlwaysOnTop(enabled, 'floating');
    if (!petMode) normalAlwaysOnTop = enabled;
    scheduleSave();
    publishState();
    return enabled;
  });
  handle('desktop:set-pet-mode', changePetMode);
  handle('desktop:get-state', getDesktopState);
  handle('desktop:move-pet', movePet);
  handle('desktop:start-pet-drag', startPetDrag);
  handle('desktop:end-pet-drag', endPetDrag);
  handle('desktop:wander', changeWandering);
  listen('desktop:notify', (title, body) => {
    if (!Notification.isSupported() || typeof title !== 'string' || typeof body !== 'string') return;
    new Notification({ title: title.slice(0, 100), body: body.slice(0, 500), silent: true }).show();
  });
}

function createWindow() {
  petMode = false;
  wandering = false;
  dragging = false;
  const bounds = clampBounds(normalBounds, NORMAL_SIZE);
  const area = screen.getDisplayMatching(bounds).workArea;
  const useDevelopmentServer = !app.isPackaged
    && (process.env.ELECTRON_DEV === '1' || !fs.existsSync(INDEX_PATH));
  rendererURL = useDevelopmentServer ? DEVELOPMENT_URL : pathToFileURL(INDEX_PATH).href;

  mainWindow = new BrowserWindow({
    ...bounds,
    minWidth: Math.min(NORMAL_MINIMUM.width, area.width),
    minHeight: Math.min(NORMAL_MINIMUM.height, area.height),
    title: '拉姆陪伴',
    icon: path.join(__dirname, '..', 'dist', 'favicon.png'),
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: true,
    show: false,
    autoHideMenuBar: true,
    alwaysOnTop: normalAlwaysOnTop,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      spellcheck: false,
    },
  });

  const window = mainWindow;
  window.setMenu(null);
  window.once('ready-to-show', () => window.show());
  window.on('move', scheduleSave);
  window.on('resize', scheduleSave);
  window.on('always-on-top-changed', () => publishState());
  window.on('minimize', stopMovement);
  window.on('restore', scheduleWander);
  window.on('blur', () => { if (dragging) endPetDrag(); });
  window.on('close', saveWindowState);
  window.on('closed', () => {
    stopMovement();
    clearTimeout(saveTimer);
    mainWindow = null;
  });
  window.webContents.on('did-finish-load', () => {
    if (!window.isDestroyed()) publishState(true);
  });
  window.webContents.on('will-navigate', (event, target) => {
    if (!isOurURL(target)) event.preventDefault();
  });
  // The pet currently has no external-link workflow. Deny popups and protocol
  // handlers; future external links should explicitly allow only HTTPS URLs.
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  window.webContents.session.setPermissionCheckHandler(() => false);

  const loading = useDevelopmentServer ? window.loadURL(rendererURL) : window.loadFile(INDEX_PATH);
  loading.catch((error) => {
    console.error('Unable to load the pet application:', error.code || error.message);
    if (!window.isDestroyed()) window.show();
  });
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });
  app.whenReady().then(() => {
    app.setAppUserModelId('com.molebaby.ramuhouse');
    loadWindowState();
    registerIPC();
    createWindow();
    const keepWindowVisible = () => {
      if (!mainWindow || mainWindow.isDestroyed()) return;
      stopMovement();
      const bounds = clampBounds(mainWindow.getBounds(), petMode ? PET_SIZE : NORMAL_SIZE);
      applyMinimum(bounds, petMode);
      mainWindow.setBounds(bounds);
      scheduleWander();
    };
    screen.on('display-removed', keepWindowVisible);
    screen.on('display-metrics-changed', keepWindowVisible);
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  }).catch((error) => {
    console.error('Unable to start the pet application:', error.message);
    app.quit();
  });
  app.on('before-quit', () => { stopMovement(); saveWindowState(); });
  app.on('window-all-closed', () => app.quit());
}
