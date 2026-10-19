const { app, BrowserWindow, ipcMain, Notification, screen, safeStorage, Tray, Menu, nativeImage } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { createCompanionAI } = require('./deepseek.cjs');
const { createCompanionSpeech } = require('./speech.cjs');
const { PET_SIZE, fitPetBounds, cornerSide, cornerBounds, canAnimateDesktop } = require('./desktop-geometry.cjs');

const NORMAL_SIZE = { width: 1180, height: 820 };
const NORMAL_MINIMUM = { width: 1000, height: 720 };
const COMPANION_SIZE = { width: 540, height: 490 };
const COMPANION_EXTENSION = {
  x: COMPANION_SIZE.width - PET_SIZE.width,
  y: COMPANION_SIZE.height - PET_SIZE.height,
};
const DEVELOPMENT_URL = 'http://127.0.0.1:5173';
const INDEX_PATH = path.join(__dirname, '..', 'dist', 'index.html');

// Keep the complete old Chromium profile (save, memories and encrypted Key)
// when the visible product name changes. Development keeps its existing path.
const originalUserDataPath = app.getPath('userData');
const legacyProfiles = [
  path.join(app.getPath('appData'), 'mole-baby'),
  path.join(app.getPath('appData'), '拉姆陪伴'),
  originalUserDataPath,
];
const explicitProfile = app.commandLine?.getSwitchValue('user-data-dir');
const stableUserDataPath = explicitProfile ? path.resolve(explicitProfile)
  : app.isPackaged
    ? legacyProfiles.find(profile => ['Local Storage', 'window-state.json', 'companion-ai-key.json']
      .some(filename => fs.existsSync(path.join(profile, filename)))) || legacyProfiles[0]
    : originalUserDataPath;
app.setPath('userData', stableUserDataPath);
app.setName('拉姆');

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
let companionPanel = false;
let panelSide = 'right';
let petCanMove = true;
let mousePassthrough = false;
let companionAI = null;
let companionSpeech = null;
let tray = null;
let quitting = false;
let rendererReady = false;
let hasPet = false;
let wanderPreference = true;
let edgeHiding = true;
let edgeSide = null;
let edgePose = 'visible';
let edgeTimer = null;
let interacting = false;

function getDesktopState() {
  return {
    petMode,
    alwaysOnTop: Boolean(mainWindow && !mainWindow.isDestroyed() && mainWindow.isAlwaysOnTop()),
    wandering,
    motion,
    companionPanel,
    panelSide,
    edgeSide,
    edgePose,
    edgeHiding,
  };
}

function publishState(includePetMode = false) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send('desktop:state-changed', getDesktopState());
  if (includePetMode) mainWindow.webContents.send('desktop:pet-mode-changed', petMode);
  refreshTrayMenu();
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
  return canMoveOnDesktop() && wandering && edgeSide === null;
}

function canMoveOnDesktop() {
  return Boolean(mainWindow && !mainWindow.isDestroyed() && canAnimateDesktop({
    visible: mainWindow.isVisible() && !mainWindow.isMinimized(), petMode,
    petCanMove, panel: companionPanel, dragging, interacting,
  }));
}

function revealPet() {
  clearTimeout(edgeTimer);
  edgeTimer = null;
  const changed = edgePose !== 'visible' || edgeSide !== null;
  edgePose = 'visible';
  edgeSide = null;
  if (changed) publishState();
  return getDesktopState();
}

function schedulePeek() {
  clearTimeout(edgeTimer);
  if (!edgeSide || !edgeHiding || !canMoveOnDesktop()) return;
  edgeTimer = setTimeout(() => {
    if (!edgeSide || !edgeHiding || !canMoveOnDesktop()) { revealPet(); return; }
    edgePose = edgePose === 'hidden' ? 'peek' : 'hidden';
    publishState();
    schedulePeek();
  }, edgePose === 'visible' ? 1600 : edgePose === 'peek' ? 2600 : 10000 + Math.random() * 9000);
}

function tuckIntoCorner(force = false) {
  if (!edgeHiding || !canMoveOnDesktop()) return false;
  const bounds = currentPetBounds();
  const area = screen.getDisplayMatching(bounds).workArea;
  const side = force
    ? bounds.x + bounds.width / 2 < area.x + area.width / 2 ? 'left' : 'right'
    : cornerSide(bounds, area);
  if (!side) return false;
  stopMovement();
  const target = cornerBounds(bounds, area, side);
  mainWindow.setPosition(target.x, target.y, false);
  edgeSide = side;
  edgePose = 'visible';
  publishState();
  scheduleSave();
  schedulePeek();
  return true;
}

function changeEdgeHiding(enabled) {
  if (typeof enabled !== 'boolean') throw new TypeError('Edge hiding must be a boolean');
  edgeHiding = enabled;
  if (!enabled) { revealPet(); scheduleWander(); }
  scheduleSave();
  publishState();
  return edgeHiding;
}

function changeInteracting(enabled) {
  if (typeof enabled !== 'boolean') throw new TypeError('Interaction state must be a boolean');
  if (enabled === interacting) return interacting;
  interacting = enabled;
  if (enabled) { stopMovement(); revealPet(); }
  else if (!tuckIntoCorner()) scheduleWander();
  return interacting;
}

function walkToCorner() {
  if (!canMoveOnDesktop()) return;
  revealPet();
  stopMovement();
  const start = currentPetBounds();
  const area = screen.getDisplayMatching(start).workArea;
  const side = start.x + start.width / 2 < area.x + area.width / 2 ? 'left' : 'right';
  const target = cornerBounds(start, area, side);
  const distance = Math.hypot(target.x - start.x, target.y - start.y);
  if (distance < 2) { tuckIntoCorner(true); return; }
  const startedAt = Date.now();
  const duration = Math.max(1600, Math.min(12000, distance / 85 * 1000));
  changeMotion(target.x < start.x ? 'left' : 'right');
  movementTimer = setInterval(() => {
    if (!canMoveOnDesktop()) { stopMovement(); return; }
    const progress = Math.min(1, (Date.now() - startedAt) / duration);
    const eased = progress * progress * (3 - 2 * progress);
    mainWindow.setPosition(Math.round(start.x + (target.x - start.x) * eased),
      Math.round(start.y + (target.y - start.y) * eased), false);
    if (progress === 1) { stopMovement(); tuckIntoCorner(true); }
  }, 33);
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
  if (!petMode || !petCanMove) return false;
  revealPet();
  if (companionPanel) changeCompanionPanel(false);
  dragging = true;
  stopMovement();
  return true;
}

function endPetDrag() {
  dragging = false;
  scheduleSave();
  if (!tuckIntoCorner()) scheduleWander();
  return true;
}

function movePet(dx, dy) {
  if (typeof dx !== 'number' || typeof dy !== 'number'
    || !Number.isFinite(dx) || !Number.isFinite(dy)
    || Math.abs(dx) > 10000 || Math.abs(dy) > 10000) {
    throw new TypeError('Pet movement must use finite screen-coordinate deltas');
  }
  if (!petMode || !petCanMove) return false;
  revealPet();
  if (companionPanel) changeCompanionPanel(false);
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
  wanderPreference = enabled;
  wandering = wanderPreference && petCanMove;
  if (enabled) revealPet();
  stopMovement();
  scheduleWander();
  publishState();
  scheduleSave();
  return wandering;
}

function changePetCanMove(enabled) {
  if (typeof enabled !== 'boolean') throw new TypeError('Pet mobility must be a boolean');
  if (petCanMove === enabled) return petCanMove;
  petCanMove = enabled;
  if (!enabled) { dragging = false; revealPet(); }
  wandering = wanderPreference && enabled;
  stopMovement();
  scheduleWander();
  publishState();
  return petCanMove;
}

function changeMousePassthrough(ignore) {
  if (typeof ignore !== 'boolean') throw new TypeError('Mouse passthrough must be a boolean');
  const enabled = petMode && ignore;
  if (enabled === mousePassthrough) return;
  // Forward mouse movement so the renderer can make the pet interactive again
  // when the cursor returns from transparent pixels. X11 forwarding differs
  // across window managers, so cloud/Linux previews keep ordinary hit testing.
  if (process.platform === 'win32' || process.platform === 'darwin') {
    mainWindow.setIgnoreMouseEvents(enabled, { forward: true });
    mousePassthrough = enabled;
  }
}

function currentPetBounds() {
  const bounds = mainWindow.getBounds();
  return {
    x: bounds.x + (companionPanel && panelSide === 'left' ? COMPANION_EXTENSION.x : 0),
    y: bounds.y + (companionPanel ? COMPANION_EXTENSION.y : 0),
    ...PET_SIZE,
  };
}

function companionBounds(base) {
  const area = screen.getDisplayMatching(base).workArea;
  const roomRight = area.x + area.width - (base.x + PET_SIZE.width);
  const roomLeft = base.x - area.x;
  panelSide = roomRight >= COMPANION_EXTENSION.x || roomRight >= roomLeft ? 'right' : 'left';
  const expanded = {
    x: base.x - (panelSide === 'left' ? COMPANION_EXTENSION.x : 0),
    y: base.y - COMPANION_EXTENSION.y,
    ...COMPANION_SIZE,
  };
  // Most positions need no adjustment. Near an edge, keep the complete panel
  // in the work area and derive the corresponding base bounds from that frame.
  expanded.x = Math.round(Math.max(area.x, Math.min(expanded.x, area.x + area.width - expanded.width)));
  expanded.y = Math.round(Math.max(area.y, Math.min(expanded.y, area.y + area.height - expanded.height)));
  return expanded;
}

function changeCompanionPanel(open) {
  if (typeof open !== 'boolean') throw new TypeError('Companion panel visibility must be a boolean');
  if (!petMode || open === companionPanel) return getDesktopState();
  if (open) revealPet();
  stopMovement();
  const base = currentPetBounds();
  const target = open ? companionBounds(base) : clampBounds(base, PET_SIZE);
  changingMode = true;
  companionPanel = open;
  mainWindow.setBounds(target);
  changingMode = false;
  rememberBounds();
  publishState();
  scheduleSave();
  scheduleWander();
  return getDesktopState();
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
    petBounds = validBounds(state.petBounds) ? {
      // Older releases used a large transparent frame. Keep its bottom centre
      // while migrating its position, never its obsolete width or height.
      x: state.petBounds.x + Math.round((state.petBounds.width - PET_SIZE.width) / 2),
      y: state.petBounds.y + state.petBounds.height - PET_SIZE.height,
      ...PET_SIZE,
    } : null;
    normalAlwaysOnTop = state.normalAlwaysOnTop === true;
    wanderPreference = state.wandering !== false;
    edgeHiding = state.edgeHiding !== false;
  } catch {
    // A missing or interrupted preferences file should never prevent startup.
  }
}

function rememberBounds() {
  if (!mainWindow || mainWindow.isDestroyed() || changingMode || mainWindow.isMinimized()) return;
  if (petMode) petBounds = currentPetBounds();
  else normalBounds = mainWindow.getNormalBounds();
}

function saveWindowState() {
  clearTimeout(saveTimer);
  saveTimer = null;
  rememberBounds();
  try {
    const filename = settingsPath();
    fs.mkdirSync(path.dirname(filename), { recursive: true });
    fs.writeFileSync(`${filename}.tmp`, JSON.stringify({ normalBounds, petBounds, normalAlwaysOnTop, wandering: wanderPreference, edgeHiding }));
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
  if (fallbackSize === PET_SIZE) return fitPetBounds(bounds, area);
  const minimum = fallbackSize === PET_SIZE ? PET_SIZE : NORMAL_MINIMUM;
  const width = fallbackSize === PET_SIZE ? PET_SIZE.width
    : Math.min(Math.max(minimum.width, Math.round(bounds?.width || fallbackSize.width)), area.width);
  const height = fallbackSize === PET_SIZE ? PET_SIZE.height
    : Math.min(Math.max(minimum.height, Math.round(bounds?.height || fallbackSize.height)), area.height);
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
  revealPet();
  dragging = false;
  rememberBounds();
  changeMousePassthrough(false);
  changingMode = true;
  companionPanel = false;
  panelSide = 'right';
  if (enabled) {
    normalAlwaysOnTop = mainWindow.isAlwaysOnTop();
    const target = clampBounds(petBounds, PET_SIZE);
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
  if (process.platform === 'darwin') {
    mainWindow.setVisibleOnAllWorkspaces(enabled, { visibleOnFullScreen: enabled, skipTransformProcessType: true });
  }
  publishState(true);
  saveWindowState();
  scheduleWander();
  return petMode;
}

function iconPath(filename) {
  const built = path.join(__dirname, '..', 'dist', 'icons', filename);
  return fs.existsSync(built) ? built : path.join(__dirname, '..', 'public', 'icons', filename);
}

function hideToTray() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  companionAI?.cancel();
  companionSpeech?.cancel();
  dragging = false;
  stopMovement();
  revealPet();
  changeMousePassthrough(false);
  saveWindowState();
  mainWindow.hide();
  publishState();
}

function showFromTray(home = false) {
  if (!mainWindow || mainWindow.isDestroyed()) { createWindow(); return; }
  if (!rendererReady) return;
  revealPet();
  changePetMode(hasPet && !home);
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
  scheduleWander();
}

function markRendererReady(adopted) {
  if (typeof adopted !== 'boolean') return;
  hasPet = adopted;
  refreshTrayMenu();
  // React calls this after painting its first correctly sized mode. It also
  // updates adoption state later, without reopening a window hidden to tray.
  if (rendererReady || !mainWindow || mainWindow.isDestroyed()) return;
  rendererReady = true;
  mainWindow.show();
  scheduleWander();
}

function refreshTrayMenu() {
  if (!tray || tray.isDestroyed()) return;
  const movable = hasPet && petCanMove;
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: hasPet ? '显示拉姆' : '领养拉姆', click: () => showFromTray() },
    { label: '进入小屋', enabled: hasPet, click: () => showFromTray(true) },
    { type: 'separator' },
    { label: '散步', type: 'checkbox', checked: wandering, enabled: movable, click: item => {
      if (!mainWindow.isVisible()) showFromTray();
      changeWandering(item.checked);
    } },
    { label: '躲到角落', enabled: movable, click: () => {
      showFromTray();
      changeEdgeHiding(true);
      walkToCorner();
    } },
    { label: '暂停躲藏', type: 'checkbox', checked: !edgeHiding, click: item => changeEdgeHiding(!item.checked) },
    { type: 'separator' },
    { label: '退出拉姆', click: () => { quitting = true; app.quit(); } },
  ]));
}

function createTray() {
  if (tray && !tray.isDestroyed()) return;
  const image = nativeImage.createFromPath(iconPath(process.platform === 'darwin' ? 'tray-mac.png' : 'tray.png'));
  tray = new Tray(image);
  tray.setToolTip('拉姆 · mole-baby');
  // On macOS, either mouse button opens the native status menu. Restoring on
  // click as well would open the pet while the user is trying to select Exit.
  if (process.platform !== 'darwin') {
    tray.on('click', () => showFromTray());
    tray.on('double-click', () => showFromTray());
  }
  refreshTrayMenu();
}

function registerIPC() {
  handle('companion-ai:get-settings', () => companionAI.getSettings());
  handle('companion-ai:set-key', (key) => companionAI.setKey(key));
  handle('companion-ai:clear-key', () => companionAI.clearKey());
  handle('companion-ai:chat', (messages) => companionAI.chat(messages));
  listen('companion-ai:cancel', () => companionAI.cancel());
  handle('companion-speech:get-availability', () => companionSpeech.getAvailability());
  handle('companion-speech:listen', () => {
    // A renderer may finish its availability probe after the user has closed
    // the window to tray. Checking at the microphone boundary prevents that
    // stale continuation from starting a recording in a hidden window.
    if (!mainWindow || mainWindow.isDestroyed() || !mainWindow.isVisible() || mainWindow.isMinimized()) {
      throw new Error('请先从托盘打开拉姆，再开始语音输入。');
    }
    return companionSpeech.listen();
  });
  listen('companion-speech:cancel', () => companionSpeech.cancel());
  listen('desktop:minimize', hideToTray);
  listen('desktop:close', hideToTray);
  listen('desktop:hide-to-tray', hideToTray);
  listen('desktop:ready-to-show', markRendererReady);
  handle('desktop:toggle-always-on-top', () => {
    const enabled = !mainWindow.isAlwaysOnTop();
    mainWindow.setAlwaysOnTop(enabled, 'floating');
    if (!petMode) normalAlwaysOnTop = enabled;
    scheduleSave();
    publishState();
    return enabled;
  });
  handle('desktop:set-pet-mode', changePetMode);
  handle('desktop:set-companion-panel', changeCompanionPanel);
  handle('desktop:set-pet-can-move', changePetCanMove);
  handle('desktop:set-edge-hiding', changeEdgeHiding);
  handle('desktop:set-interacting', changeInteracting);
  handle('desktop:reveal-pet', revealPet);
  handle('desktop:get-state', getDesktopState);
  handle('desktop:move-pet', movePet);
  handle('desktop:start-pet-drag', startPetDrag);
  handle('desktop:end-pet-drag', endPetDrag);
  handle('desktop:wander', changeWandering);
  listen('desktop:set-mouse-passthrough', (ignore) => {
    if (typeof ignore === 'boolean') changeMousePassthrough(ignore);
  });
  listen('desktop:notify', (title, body) => {
    if (!Notification.isSupported() || typeof title !== 'string' || typeof body !== 'string') return;
    new Notification({ title: title.slice(0, 100), body: body.slice(0, 500), silent: true }).show();
  });
}

function createWindow() {
  petMode = false;
  wandering = wanderPreference;
  dragging = false;
  companionPanel = false;
  panelSide = 'right';
  petCanMove = true;
  mousePassthrough = false;
  interacting = false;
  rendererReady = false;
  revealPet();
  const bounds = clampBounds(normalBounds, NORMAL_SIZE);
  const area = screen.getDisplayMatching(bounds).workArea;
  const useDevelopmentServer = !app.isPackaged
    && (process.env.ELECTRON_DEV === '1' || !fs.existsSync(INDEX_PATH));
  rendererURL = useDevelopmentServer ? DEVELOPMENT_URL : pathToFileURL(INDEX_PATH).href;

  mainWindow = new BrowserWindow({
    ...bounds,
    minWidth: Math.min(NORMAL_MINIMUM.width, area.width),
    minHeight: Math.min(NORMAL_MINIMUM.height, area.height),
    title: '拉姆',
    icon: iconPath('ramu.png'),
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: false,
    show: false,
    skipTaskbar: true,
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
  window.on('move', scheduleSave);
  window.on('resize', scheduleSave);
  window.on('always-on-top-changed', () => publishState());
  window.on('minimize', event => { event.preventDefault(); hideToTray(); });
  window.on('restore', scheduleWander);
  window.on('blur', () => { if (dragging) endPetDrag(); });
  window.on('close', event => {
    if (!quitting) { event.preventDefault(); hideToTray(); return; }
    companionAI.cancel(); companionSpeech.cancel(); saveWindowState();
  });
  window.on('closed', () => {
    stopMovement();
    clearTimeout(edgeTimer);
    clearTimeout(saveTimer);
    mainWindow = null;
  });
  window.webContents.on('did-finish-load', () => {
    if (!window.isDestroyed()) publishState(true);
  });
  window.webContents.on('render-process-gone', () => { companionAI.cancel(); companionSpeech.cancel(); });
  window.webContents.on('did-start-navigation', (_event, _url, isInPlace, isMainFrame) => {
    if (isMainFrame && !isInPlace) { companionAI.cancel(); companionSpeech.cancel(); }
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
    showFromTray();
  });
  app.whenReady().then(() => {
    if (process.platform === 'win32') app.setAppUserModelId('com.molebaby.ramuhouse');
    if (process.platform === 'darwin') {
      app.dock.hide();
      Menu.setApplicationMenu(Menu.buildFromTemplate([
        { label: '拉姆', submenu: [
          { label: '显示拉姆', click: () => showFromTray() },
          { label: '进入小屋', click: () => showFromTray(true) },
          { type: 'separator' },
          { label: '退出拉姆', accelerator: 'Command+Q', click: () => { quitting = true; app.quit(); } },
        ] },
        { role: 'editMenu' },
        { role: 'windowMenu' },
      ]));
    }
    companionAI = createCompanionAI({ userDataPath: app.getPath('userData'), safeStorage });
    companionSpeech = createCompanionSpeech();
    loadWindowState();
    registerIPC();
    createWindow();
    createTray();
    const keepWindowVisible = () => {
      if (!mainWindow || mainWindow.isDestroyed()) return;
      stopMovement();
      revealPet();
      const base = petMode ? clampBounds(currentPetBounds(), PET_SIZE) : null;
      const bounds = petMode
        ? companionPanel ? companionBounds(base) : base
        : clampBounds(mainWindow.getBounds(), NORMAL_SIZE);
      changingMode = true;
      applyMinimum(bounds, petMode);
      mainWindow.setBounds(bounds);
      changingMode = false;
      scheduleSave();
      publishState();
      scheduleWander();
    };
    screen.on('display-removed', keepWindowVisible);
    screen.on('display-metrics-changed', keepWindowVisible);
    app.on('activate', () => {
      showFromTray();
    });
  }).catch((error) => {
    console.error('Unable to start the pet application:', error.message);
    app.quit();
  });
  app.on('before-quit', () => {
    quitting = true;
    companionAI?.dispose(); companionSpeech?.dispose(); stopMovement(); clearTimeout(edgeTimer); saveWindowState();
  });
  app.on('will-quit', () => { if (tray && !tray.isDestroyed()) tray.destroy(); });
  app.on('window-all-closed', () => { if (quitting) app.quit(); });
}
