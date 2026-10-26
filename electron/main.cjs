const { app, BrowserWindow, ipcMain, Notification, screen, Tray, Menu, nativeImage, shell, net, autoUpdater:nativeAutoUpdater } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { PET_SIZE, PET_PADDING, fitPetBounds, cornerSide, cornerBounds, edgeOffset, canAnimateDesktop, nearbyWanderTarget, compactPanelBounds } = require('./desktop-geometry.cjs');
const { edgeDelay } = require('./edge-timing.cjs');
const { createMacHelp } = require('./mac-settings.cjs');
const { createTrayIcon } = require('./tray-icon.cjs');
const macHelp=createMacHelp({platform:process.platform,shell,guidePath:path.join(__dirname,'Mac 打开说明.html'),guideDirectory:()=>path.join(app.getPath('userData'),'help')});

const {createUpdates}=require('./updates.cjs');
const applicationMetadata=require('../package.json');
let updates=null,updateRendererBusy=true,updateCheckpoint=null;
const NORMAL_SIZE = { width: 1180, height: 820 };
const NORMAL_MINIMUM = { width: 1000, height: 720 };
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
let wanderAnchor = null;
let motion = 'idle';
let companionPanel = false;
let panelSide = 'right';
let panelLayout = 'compact';
let panelGeometry = null;
// Compatibility IPC name: this controls autonomous motion only, never manual dragging.
let petCanMove = true;
let mousePassthrough = false;
let tray = null;
let quitting = false;
let rendererReady = false;
let hasPet = false;
let wanderPreference = true;
let edgeHiding = true;
let edgeSide = null;
let petAppearance='seed';
let edgePose = 'visible';
let edgeTimer = null;
let edgeTuckUntil = null;
let interacting = false;
let edgeHovered = false;
let edgeNextPeekAt = null;
let draggingFromEdge = false;
let petOffset={x:0,y:0};
let pointerPress=null,cursorDrag=null,dragPoll=null;
let petAlwaysOnTop=true,mouseThrough=false,trayMenuKey='';

function getDesktopState() {
  return {
    petMode,
    petOffset,mouseThrough,mousePassthrough,
    ...(dragging?{dragPoint:{...screen.getCursorScreenPoint(),at:Date.now()}}:{}),
    alwaysOnTop: Boolean(mainWindow && !mainWindow.isDestroyed() && mainWindow.isAlwaysOnTop()),
    wandering,
    motion,
    companionPanel,
    panelSide,
    panelLayout,
    panelGeometry,
    edgeSide,
    edgePose,
    edgeOffset: edgeOffset(edgeSide, edgePose,petAppearance),
    edgeHiding,
    edgeNextPeekAt,
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

function canHideAtEdge() {
  return Boolean(mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible()
    && !mainWindow.isMinimized() && petMode && hasPet && !companionPanel && !dragging && !interacting);
}

function revealPet() {
  clearTimeout(edgeTimer);
  edgeTimer = null;
  edgeTuckUntil = null;
  edgeHovered = false;edgeNextPeekAt=null;
  const changed = edgePose !== 'visible' || edgeSide !== null;
  edgePose = 'visible';
  edgeSide = null;
  if (changed) publishState();
  return getDesktopState();
}

function schedulePeek() {
  clearTimeout(edgeTimer);
  edgeTimer = null;
  edgeNextPeekAt=null;
  if (!edgeSide || !edgeHiding) return;
  // Hovering or briefly interacting must never restart or strand the enter pose.
  if (edgePose === 'tucking') {
    edgeTimer = setTimeout(() => {
      edgeTimer = null;
      if (!edgeSide || !edgeHiding || edgePose !== 'tucking') return;
      edgeTuckUntil = null;
      edgePose = edgeHovered ? 'peek' : 'hidden';
      schedulePeek();
      publishState();
    }, Math.max(0, (edgeTuckUntil ?? Date.now()) - Date.now()));
    return;
  }
  if (!edgeSide || !edgeHiding || edgeHovered || !canHideAtEdge()) return;
  const delay=edgeDelay(edgePose);
  if(edgePose==='hidden')edgeNextPeekAt=Date.now()+delay;
  edgeTimer = setTimeout(() => {
    edgeTimer = null;
    edgeNextPeekAt=null;
    if (!edgeSide || !edgeHiding || edgeHovered || !canHideAtEdge()) return;
    edgePose = edgePose === 'hidden' ? 'peek' : 'hidden';
    schedulePeek();
    publishState();
  }, delay);
}

function changeEdgeHovered(hovered) {
  if(typeof hovered!=='boolean')throw new TypeError('Edge hover must be a boolean');
  if(!edgeSide||!edgeHiding||!petMode||dragging||hovered===edgeHovered)return getDesktopState();
  edgeHovered=hovered;
  if (edgePose === 'tucking') return getDesktopState();
  clearTimeout(edgeTimer);edgeTimer=null;edgeNextPeekAt=null;
  edgePose=hovered?'peek':'hidden';
  if(!hovered)schedulePeek();
  publishState();
  return getDesktopState();
}

function tuckIntoCorner() {
  if (!edgeHiding || !canHideAtEdge()) return false;
  const bounds = currentPetBounds();
  const area = screen.getDisplayMatching(bounds).workArea;
  const side = cornerSide(bounds, area);
  if (!side) return false;
  stopMovement();
  const target = cornerBounds(bounds, area, side);
  placePetAt(target);
  edgeSide = side;
  edgePose = 'tucking';
  edgeTuckUntil = Date.now() + edgeDelay('tucking');
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
  if (enabled) { stopMovement(); if(!edgeSide)revealPet(); }
  else if(edgeSide)schedulePeek();else if (!tuckIntoCorner()) scheduleWander();
  return interacting;
}

function walkToCorner() {
  if (!canHideAtEdge()) return;
  revealPet();
  stopMovement();
  const start = currentPetBounds();
  const area = screen.getDisplayMatching(start).workArea;
  const side = 'right';
  const target = cornerBounds(start, area, side);
  const distance = Math.hypot(target.x - start.x, target.y - start.y);
  if (distance < 2) { tuckIntoCorner(); return; }
  const startedAt = Date.now();
  const duration = petCanMove ? Math.max(1600, Math.min(12000, distance / 85 * 1000)) : 850;
  changeMotion(target.x < start.x ? 'left' : 'right');
  movementTimer = setInterval(() => {
    if (!canHideAtEdge()) { stopMovement(); return; }
    const progress = Math.min(1, (Date.now() - startedAt) / duration);
    const eased = progress * progress * (3 - 2 * progress);
    placePetAt({...PET_SIZE,x:Math.round(start.x+(target.x-start.x)*eased),y:Math.round(start.y+(target.y-start.y)*eased)});
    if (progress === 1) { stopMovement(); tuckIntoCorner(); }
  }, 33);
}

function scheduleWander() {
  clearTimeout(wanderTimer);
  wanderTimer = null;
  if (!canWander() || movementTimer) return;
  wanderTimer = setTimeout(walkAlongDesktop, 12000 + Math.random() * 6000);
}

function walkAlongDesktop() {
  wanderTimer = null;
  if (!canWander()) return;
  const start = currentPetBounds();
  const area = screen.getDisplayMatching(start).workArea;
  if (!wanderAnchor) wanderAnchor = { ...start };
  const target = nearbyWanderTarget(start, area, wanderAnchor);
  const travel = Math.hypot(target.x - start.x, target.y - start.y);
  if (travel < 1) { scheduleWander(); return; }

  // Preserve the chosen height and ease only a short distance nearby.
  const duration = 1000 + travel * 15;
  const startedAt = Date.now();
  changeMotion(target.x < start.x ? 'left' : 'right');
  movementTimer = setInterval(() => {
    if (!canWander()) { stopMovement(); return; }
    const progress = Math.min(1, (Date.now() - startedAt) / duration);
    const eased = progress * progress * (3 - 2 * progress);
    const x = Math.round(start.x + (target.x - start.x) * eased);
    const y = Math.round(start.y + (target.y - start.y) * eased);
    const current = currentPetBounds();
    if (x !== current.x || y !== current.y) placePetAt({...PET_SIZE,x,y});
    if (progress === 1) {
      clearInterval(movementTimer);
      movementTimer = null;
      changeMotion('idle');
      scheduleSave();
      scheduleWander();
    }
  }, 33);
}

/** Keep a virtual pet anchor even if Windows clamps the transparent frame.
 * The renderer offsets the body by the actual OS displacement, so every edge
 * remains reachable without asking the OS to put a window above its bounds. */
function placePetAt(target){
  const previous=currentPetBounds();if(!companionPanel&&previous.x===Math.round(target.x)&&previous.y===Math.round(target.y))return;
  changingMode=true;mainWindow.setPosition(Math.round(target.x),Math.round(target.y),false);changingMode=false;
  const actual=mainWindow.getBounds(),previousOffset=petOffset;petOffset={x:target.x-actual.x,y:target.y-actual.y};
  petBounds={...PET_SIZE,x:target.x,y:target.y};if(previousOffset.x!==petOffset.x||previousOffset.y!==petOffset.y)publishState();
}
function preparePetDrag(){
  if(!petMode||mouseThrough)return false;
  pointerPress={point:screen.getCursorScreenPoint(),base:currentPetBounds()};return true;
}
function startPetDrag(paintedOffset){
  if(paintedOffset!==undefined&&(!paintedOffset||Array.isArray(paintedOffset)||typeof paintedOffset.x!=='number'||typeof paintedOffset.y!=='number'||!Number.isFinite(paintedOffset.x)||!Number.isFinite(paintedOffset.y)||Math.abs(paintedOffset.x)>82||Math.abs(paintedOffset.y)>92))throw new TypeError('Painted pet offset must be a finite bounded screen-coordinate vector');
  if(!petMode||mouseThrough)return false;
  const offset=paintedOffset??(edgeSide?edgeOffset(edgeSide,edgePose,petAppearance):{x:0,y:0});draggingFromEdge=Boolean(edgeSide)||Boolean(offset.x||offset.y);
  if(companionPanel)changeCompanionPanel(false);
  const base=currentPetBounds();revealPet();dragging=true;stopMovement();
  const painted={...base,x:base.x+Math.round(offset.x),y:base.y+Math.round(offset.y)};placePetAt(painted);
  if(pointerPress){cursorDrag={point:pointerPress.point,base:painted};clearInterval(dragPoll);dragPoll=setInterval(dragPetToCursor,16);dragPetToCursor();}
  return true;
}
function dragPetToCursor(){
  if(!dragging||!cursorDrag||!mainWindow||mainWindow.isDestroyed())return false;
  const point=screen.getCursorScreenPoint(),desired={...PET_SIZE,x:cursorDrag.base.x+point.x-cursorDrag.point.x,y:cursorDrag.base.y+point.y-cursorDrag.point.y};
  const area=screen.getDisplayNearestPoint?screen.getDisplayNearestPoint(point).workArea:screen.getDisplayMatching(desired).workArea;
  const target=fitPetBounds(desired,area);
  if(draggingFromEdge){target.x=Math.max(area.x-PET_PADDING.left-82,Math.min(area.x+area.width-PET_SIZE.width+PET_PADDING.right+82,desired.x));target.y=Math.max(area.y-PET_PADDING.top-92,Math.min(area.y+area.height-PET_SIZE.height+PET_PADDING.bottom+92,desired.y));}
  placePetAt(target);return true;
}
function endPetDrag(){
  const clickOnly=pointerPress&&!dragging;
  dragPetToCursor();clearInterval(dragPoll);dragPoll=null;pointerPress=null;cursorDrag=null;
  if(clickOnly)return true;
  dragging=false;
  if(petMode&&!companionPanel)placePetAt(clampBounds(currentPetBounds(),PET_SIZE));
  draggingFromEdge=false;interacting=false;wanderAnchor={...currentPetBounds()};scheduleSave();if(!tuckIntoCorner())scheduleWander();return true;
}

function movePet(dx, dy) {
  if (typeof dx !== 'number' || typeof dy !== 'number'
    || !Number.isFinite(dx) || !Number.isFinite(dy)
    || Math.abs(dx) > 10000 || Math.abs(dy) > 10000) {
    throw new TypeError('Pet movement must use finite screen-coordinate deltas');
  }
  if (!petMode) return false; // Manual dragging is allowed even for a seed or sleeping pet.
  revealPet();
  if (companionPanel) changeCompanionPanel(false);
  stopMovement();
  const current = currentPetBounds();
  const desired={...current,x:current.x+Math.round(dx),y:current.y+Math.round(dy)};
  const target = clampBounds(desired, PET_SIZE);
  if(dragging&&draggingFromEdge){
    const area=screen.getDisplayMatching(current).workArea;
    // Keep the painted body under the pointer while pulling it out of any edge.
    target.x=Math.max(area.x-PET_PADDING.left-82,Math.min(area.x+area.width-PET_SIZE.width+PET_PADDING.right+82,desired.x));
    target.y=Math.max(area.y-PET_PADDING.top-92,Math.min(area.y+area.height-PET_SIZE.height+PET_PADDING.bottom+92,desired.y));
  }
  placePetAt(target);
  wanderAnchor = { ...target };
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
  if (!enabled) { stopMovement(); }
  wandering = wanderPreference && enabled;
  stopMovement();
  scheduleWander();
  publishState();
  return petCanMove;
}

function changeMousePassthrough(ignore) {
  if (typeof ignore !== 'boolean') throw new TypeError('Mouse passthrough must be a boolean');
  const enabled = petMode && (mouseThrough||ignore);
  if (enabled === mousePassthrough) return;
  // Forward mouse movement so the renderer can make the pet interactive again
  // when the cursor returns from transparent pixels. X11 forwarding differs
  // across window managers, so cloud/Linux previews keep ordinary hit testing.
  if (process.platform === 'win32' || process.platform === 'darwin') {
    mainWindow.setIgnoreMouseEvents(enabled, { forward: true });
    mousePassthrough = enabled;
  }
}

function changeAlwaysOnTop(enabled,petOnly=false){
 if(typeof enabled!=='boolean')throw new TypeError('Always-on-top must be a boolean');
 if(petMode||petOnly)petAlwaysOnTop=enabled;else normalAlwaysOnTop=enabled;
 if(!petOnly||petMode)mainWindow.setAlwaysOnTop(enabled,'floating');refreshTrayMenu();scheduleSave();publishState();return enabled;
}
function changeMouseThrough(enabled){
 if(typeof enabled!=='boolean')throw new TypeError('Mouse through must be a boolean');
 mouseThrough=enabled;
 if(enabled&&companionPanel)changeCompanionPanel(false);
 if(enabled){clearInterval(dragPoll);dragPoll=null;cursorDrag=null;pointerPress=null;dragging=false;interacting=false;stopMovement();}
 changeMousePassthrough(false);refreshTrayMenu();scheduleSave();publishState();return enabled;
}
function currentPetBounds(){
 const b=mainWindow.getBounds();return {...PET_SIZE,x:b.x+(companionPanel&&panelGeometry?panelGeometry.petX:petOffset.x),y:b.y+(companionPanel&&panelGeometry?panelGeometry.petY:petOffset.y)};
}
function companionBounds(base){
 const result=compactPanelBounds(base,screen.getDisplayMatching(base).workArea);panelSide=result.panelSide;panelGeometry=result.geometry;return result.bounds;
}
function changeCompanionPanel(open, layout = 'compact') {
  if (typeof open !== 'boolean') throw new TypeError('Companion panel visibility must be a boolean');
  if (!['compact', 'classic', 'profile'].includes(layout)) throw new TypeError('Unknown companion layout');
  if (!petMode || (open === companionPanel && (!open || layout === panelLayout))) return getDesktopState();
  if (open) revealPet();
  stopMovement();
  const base = currentPetBounds();
  panelLayout = 'compact';
  const target = open ? companionBounds(base) : clampBounds(base, PET_SIZE);
  if (!open) panelGeometry = null;
  changingMode = true;
  companionPanel = open;
  if(process.platform==='win32')applyMinimum(target,petMode);
  mainWindow.setBounds(target);
  const actual=mainWindow.getBounds();
  if(open&&panelGeometry){panelGeometry={...panelGeometry,petX:base.x-actual.x,petY:base.y-actual.y,panelX:panelGeometry.panelX+target.x-actual.x,panelY:panelGeometry.panelY+target.y-actual.y};}
  else petOffset={x:base.x-actual.x,y:base.y-actual.y};
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
    normalAlwaysOnTop = state.normalAlwaysOnTop === true;petAlwaysOnTop=state.petAlwaysOnTop!==false;mouseThrough=state.mouseThrough===true;
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
    fs.writeFileSync(`${filename}.tmp`, JSON.stringify({ normalBounds, petBounds, normalAlwaysOnTop,petAlwaysOnTop,mouseThrough, wandering: wanderPreference, edgeHiding }));
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
  if(process.platform==='win32'){
    // Keep the original frameless style for the lifetime of the HWND. Toggling
    // CanResize lets Chromium restore native caption bits on some Windows builds.
    mainWindow.setMaximumSize(0,0);
    const fixed=isPet?bounds:size;
    mainWindow.setMinimumSize(Math.min(fixed.width,area.width),Math.min(fixed.height,area.height));
    if(isPet)mainWindow.setMaximumSize(bounds.width,bounds.height);
  }else mainWindow.setMinimumSize(Math.min(size.width,area.width),Math.min(size.height,area.height));
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
  panelLayout = 'compact';
  panelGeometry = null;
  if (enabled) {
    normalAlwaysOnTop = mainWindow.isAlwaysOnTop();
    const target = clampBounds(petBounds, PET_SIZE);
    petMode = true;
    applyMinimum(target, true);
    if(process.platform!=='win32')mainWindow.setResizable(false);
    mainWindow.setBounds(target);
    const actual=mainWindow.getBounds();petOffset={x:target.x-actual.x,y:target.y-actual.y};
    mainWindow.setAlwaysOnTop(petAlwaysOnTop, 'floating');
    petBounds = target;
  } else {
    petMode = false;petOffset={x:0,y:0};
    const target = clampBounds(normalBounds, NORMAL_SIZE);
    if(process.platform!=='win32')mainWindow.setResizable(true);
    applyMinimum(target, false);
    mainWindow.setBounds(target);
    mainWindow.setAlwaysOnTop(normalAlwaysOnTop, 'floating');
    normalBounds = target;
  }
  changingMode = false;
  if (process.platform === 'darwin') {
    mainWindow.setVisibleOnAllWorkspaces(enabled, { visibleOnFullScreen: enabled, skipTransformProcessType: true });
  }
  changeMousePassthrough(false);
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
  dragging = false;clearInterval(dragPoll);dragPoll=null;pointerPress=null;cursorDrag=null;
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
  updates?.wake();
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
  const key=JSON.stringify([hasPet,petMode,petCanMove,wandering,edgeHiding,mouseThrough,petAlwaysOnTop,mainWindow.isAlwaysOnTop(),updates?.getState().status,Math.floor((updates?.getState().percent??0)/5),updates?.getState().enabled]);if(key===trayMenuKey)return;trayMenuKey=key;
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: hasPet ? '显示拉姆' : '领养拉姆', click: () => showFromTray() },
    { label: '进入小屋', enabled: hasPet, click: () => showFromTray(true) },
    { type: 'separator' },
    { label: '拉姆置顶',type:'checkbox',checked:petMode?mainWindow.isAlwaysOnTop():petAlwaysOnTop,click:item=>changeAlwaysOnTop(item.checked,true)},
    { label: '鼠标穿透',type:'checkbox',checked:mouseThrough,click:item=>changeMouseThrough(item.checked)},
    { label: '散步', type: 'checkbox', checked: wandering, enabled: movable, click: item => {
      if (!mainWindow.isVisible()) showFromTray();
      changeWandering(item.checked);
    } },
    { label: '躲到角落', enabled: hasPet, click: () => {
      showFromTray();
      if (companionPanel) changeCompanionPanel(false);
      interacting = false; dragging = false;
      changeEdgeHiding(true);
      walkToCorner();
    } },
    { label: '暂停躲藏', type: 'checkbox', checked: !edgeHiding, click: item => changeEdgeHiding(!item.checked) },
    ...(process.platform==='darwin'?[{label:'Mac 使用帮助',submenu:[
      {label:'打开隐私与安全',click:()=>{void macHelp.openSettings('security').catch(()=>{});}},
      {label:'首次打开说明',click:()=>{void macHelp.openGuide().catch(()=>{});}},
    ]}]:[]),
    { type: 'separator' },
    ...(updates?[{label:updateMenuLabel(),enabled:!['disabled','checking','downloading','installing'].includes(updates.getState().status),click:()=>{const state=updates.getState();void(state.status==='ready'?updates.install(true):state.status==='available'?updates.download():updates.check(true))}}]:[]),
    { label: '退出拉姆', click: () => { quitting = true; app.quit(); } },
  ]));
}

function updateMenuLabel(){
 const u=updates.getState();return u.status==='checking'?'正在检查更新…':u.status==='downloading'?`正在下载更新 ${u.percent}%`:u.status==='installing'?'正在更新…':u.status==='ready'?(u.automaticInstall?'更新并重启拉姆':'打开更新安装包'):u.status==='available'?'下载新版本':'检查更新';
}
function prepareUpdateInstall(){
 if(!mainWindow||mainWindow.isDestroyed()||!rendererReady||updateCheckpoint)return Promise.resolve(false);
 return new Promise(resolve=>{const id=require('node:crypto').randomUUID();const timer=setTimeout(()=>{updateCheckpoint=null;resolve(false)},5000);updateCheckpoint={id,timer,resolve};mainWindow.webContents.send('updates:prepare',id)});
}
function startUpdates(){
 updates=createUpdates({
  version:applicationMetadata.version,platform:process.platform,arch:process.arch==='arm64'||app.runningUnderARM64Translation?'arm64':'x64',
  configFile:path.join(app.getPath('userData'),'updates.json'),cacheDirectory:path.join(app.getPath('userData'),'update-downloads'),
  disabled:!app.isPackaged||process.env.MOLE_BABY_DISABLE_UPDATES==='1',
  installed:process.platform==='win32'&&fs.existsSync(path.join(path.dirname(process.execPath),'Uninstall 拉姆.exe')),
  macSigned:applicationMetadata.macUpdateSigned===true,
  fetch:(url,options)=>net.fetch(url,options),openPath:file=>shell.openPath(file),
  engineFactory:()=>{const engine=require('electron-updater').autoUpdater;engine.setFeedURL({provider:'generic',url:'https://github.com/Vinci-217/mole-baby/releases/latest/download/'});return engine},
  prepareInstall:prepareUpdateInstall,isBusy:()=>updateRendererBusy||!hasPet||!petMode||companionPanel||dragging||interacting,
  onChange:state=>{if(mainWindow&&!mainWindow.isDestroyed())mainWindow.webContents.send('updates:state',state);refreshTrayMenu()},
  onReady:()=>{if(Notification.isSupported())try{new Notification({title:'拉姆有新版本啦',body:'更新已下载，可以在托盘或小屋设置里查看。',silent:true}).show()}catch{}},
 });
 updates.start();refreshTrayMenu();
}
function createTray() {
  if (tray && !tray.isDestroyed()) return;
  const image = createTrayIcon(nativeImage, process.platform, iconPath);
  tray = new Tray(image);trayMenuKey='';
  tray.setToolTip(process.platform==='win32'?'':'拉姆');
  // On macOS, either mouse button opens the native status menu. Restoring on
  // click as well would open the pet while the user is trying to select Exit.
  if (process.platform !== 'darwin') {
    tray.on('click', () => showFromTray());
    tray.on('double-click', () => showFromTray());
  }
  refreshTrayMenu();
}

function registerIPC() {
  listen('desktop:minimize', hideToTray);
  listen('desktop:close', hideToTray);
  listen('desktop:hide-to-tray', hideToTray);
  listen('desktop:ready-to-show', markRendererReady);
  handle('updates:get-state',()=>updates?.getState()??null);
  handle('updates:check',()=>updates?.check(true)??false);
  handle('updates:download',()=>updates?.download()??false);
  handle('updates:install',()=>updates?.install(true)??false);
  handle('updates:set-enabled',enabled=>updates?.setEnabled(enabled)??null);
  listen('updates:busy',busy=>{if(typeof busy!=='boolean')return;updateRendererBusy=busy});
  listen('updates:prepared',(id,ok)=>{const checkpoint=updateCheckpoint;if(!checkpoint||id!==checkpoint.id||typeof ok!=='boolean')return;clearTimeout(checkpoint.timer);updateCheckpoint=null;let saved=ok;try{if(ok){saveWindowState();mainWindow.webContents.session.flushStorageData()}}catch{saved=false}checkpoint.resolve(saved)});
  handle('desktop:toggle-always-on-top',()=>changeAlwaysOnTop(!mainWindow.isAlwaysOnTop()));
  handle('desktop:set-mouse-through',changeMouseThrough);
  handle('desktop:prepare-pet-drag',preparePetDrag);
  handle('desktop:drag-pet-to-cursor',dragPetToCursor);
  handle('desktop:set-pet-mode', changePetMode);
  handle('desktop:set-companion-panel', changeCompanionPanel);
  handle('desktop:set-pet-can-move', changePetCanMove);
  handle('desktop:set-pet-appearance',form=>{if(typeof form!=='string'||!Object.hasOwn(require('./edge-visibility.json').forms,form))throw new TypeError('Unknown pet appearance');petAppearance=form;publishState();return getDesktopState()});
  handle('desktop:set-edge-hiding', changeEdgeHiding);
  handle('desktop:set-edge-hovered', changeEdgeHovered);
  handle('desktop:open-mac-settings', kind=>macHelp.openSettings(kind));
  handle('desktop:open-mac-guide', ()=>macHelp.openGuide());
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
  panelLayout = 'compact';
  panelGeometry = null;
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
    // Windows can expose a native caption/hover strip even on a transparent
    // HWND. Keep its title empty and its frameless style fixed for its lifetime.
    title: '',
    resizable: process.platform !== 'win32',
    icon: iconPath('ramu.png'),
    frame: false,
    // AppKit otherwise clamps the transparent top margin below its menu bar.
    // Our body-aware geometry keeps visible content inside the work area.
    enableLargerThanScreen: process.platform === 'darwin',
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: false,
    show: false,
    skipTaskbar: true,
    autoHideMenuBar: true,
    alwaysOnTop: normalAlwaysOnTop,
    thickFrame: process.platform !== 'win32',
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
  window.webContents.on('page-title-updated', event => {
    event.preventDefault();
    if (!window.isDestroyed()) window.setTitle('');
  });
  window.setMenu(null);
  window.on('move', scheduleSave);
  window.on('resize', scheduleSave);
  window.on('always-on-top-changed', () => publishState());
  window.on('minimize', event => { event.preventDefault(); hideToTray(); });
  window.on('restore', scheduleWander);
  window.on('blur', () => { if (dragging) endPetDrag(); });
  window.on('close', event => {
    if (!quitting) { event.preventDefault(); hideToTray(); return; }
    saveWindowState();
  });
  window.on('closed', () => {
    clearInterval(dragPoll);pointerPress=null;cursorDrag=null;
    stopMovement();
    clearTimeout(edgeTimer);
    clearTimeout(saveTimer);
    mainWindow = null;
  });
  window.webContents.on('did-finish-load', () => {
    if (!window.isDestroyed()) publishState(true);
  });
  window.webContents.on('preload-error', (_event, _filename, error) => { console.error('Desktop preload failed:', error.name, error.message); });
  window.webContents.on('render-process-gone', () => { });
  window.webContents.on('did-start-navigation', (_event, _url, isInPlace, isMainFrame) => {
    if (isMainFrame && !isInPlace) { }
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

    // This release removes chat and API storage. Leave pet saves untouched.
    for(const directory of new Set([...legacyProfiles,app.getPath('userData')])){
      try{fs.rmSync(path.join(directory,'companion-ai-key.json'),{force:true});}catch(error){console.warn('Unable to remove retired API key:',error.code||error.name);}
    }
    loadWindowState();
    startUpdates();
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
  nativeAutoUpdater?.on('before-quit-for-update',()=>{quitting=true;saveWindowState();try{mainWindow?.webContents.session.flushStorageData()}catch{}});
  app.on('before-quit', () => {
    quitting = true;clearInterval(dragPoll);
    try{mainWindow?.webContents.session.flushStorageData()}catch{}
    stopMovement(); clearTimeout(edgeTimer); saveWindowState();
  });
  app.on('will-quit', () => { updates?.dispose();if(updateCheckpoint){clearTimeout(updateCheckpoint.timer);updateCheckpoint.resolve(false);updateCheckpoint=null} if (tray && !tray.isDestroyed()) tray.destroy(); });
  app.on('window-all-closed', () => { if (quitting) app.quit(); });
}
