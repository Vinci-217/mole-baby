import OfficialClipMenu from './components/OfficialClipMenu';
import {officialClip,isOfficialAction,originalActionVariant,OFFICIAL_DURATION} from './official-clips';
import {drawingUnion,useNativeDrawingBounds} from './original-viewport';
import {autonomousActionLine,studyActionLine,isAmbientAction,originalItemClip,playbackForm,usesAmbientAdaptation,usesAmbientFootballFrames} from './pet-original-actions';
import {nextStudyActivity,originalStudyClip,preloadStudyActivity,type StudyActivity} from './ram-study';
import {footballDuration,ramForm} from './original-actions';
import {originalCareClip} from './original-care';
import {DESKTOP_WORK_BOUNDS} from './desktop-restaurant-work';
import {WorkPresence} from './work-presence';
import MessageBoard from './components/MessageBoard';
import GameSoundToggle from './components/GameSoundToggle';
import {normalizeNotes,recordStatChange} from './pet-records';
import type {PetNote} from './pet-records';
import {dailyFrameSpec} from './daily-frames';
import {animationBlockReason} from './interaction-state';
import {isUploadedAction,uploadedMotion,UPLOADED_TOYS} from './uploaded-actions';
import {frameClipRect} from './frame-clip-spec';
import {brewColourPotion} from './color-mixing';
import UpdateSettings from './components/UpdateSettings';
import {useDesktopPetStatus} from './use-desktop-pet-status';
import {elementEffectRect} from './element-playback';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Maximize, Minimize, Scaling, CalendarCheck, Check } from 'lucide-react';
import type { CSSProperties, FormEvent, ReactNode, SetStateAction } from 'react';
import { COLORS, STAGES, EVOLUTIONS, MAX_SAVE_LENGTH, legacyUnlockedGrowth, configureGrowth, buyItem, care, createPet, getItem, getPetCondition, getStage, normalizeSavedPet, rewardGame, tick } from './game';
import type { Action, GameState, PetColor, GrowthSelection } from './game';
import Ram from './components/Ram';
import DesktopCompanion from './components/DesktopCompanion';
import type { CompanionPanel } from './components/DesktopCompanion';
import {buyOutfit,wearOutfit,getOutfit,petAppearance,petActionAppearance,costumePlayback} from './wardrobe';
import {costumeAction} from './costume-action';
import {normalizeRamAction} from './ram-action';
import {isMoodAction} from './mood-motion';
import {moodResponse} from './mood-companion';
import TimeScene from './components/TimeScene';
import type { ExtraGame } from './components/MoreGames';
import { getItemMotion } from './item-motion';
import { getRamActionDuration } from './components/ram-animation';
import { playPetVoice, playGameSound, preparePetSound, playInteractionPreview, configurePetSound, prepareReminderSound, playReminderSound } from './pet-audio';
import type { GameReceipt } from './components/game-receipt';
import CarePocket from './components/CarePocket';
import type {PocketCategory} from './components/CarePocket';
import RoomPetPanel from './components/RoomPetPanel';
import MacHelp from './components/MacHelp';
import StageSettings from './components/StageSettings';
import RoomDock from './components/RoomDock';
import {openManorSite} from './external-sites';
import SettingsPanel,{SettingsSection} from './components/SettingsPanel';
import SettingsSwitch from './components/SettingsSwitch';
import AnimationDiagnostics from './components/AnimationDiagnostics';
import BookResourceSettings from './components/BookResourceSettings';
import {useBookDownloads} from './book-downloads';
import SaveManager,{SaveOperationFeedback,type SaveFeedback,type SaveImport} from './components/SaveManager';
import StatusPocket from './components/StatusPocket';
import LaunchAtLoginSetting from './components/LaunchAtLoginSetting';
import {useRoomFullscreen} from './use-room-fullscreen';
import RoomResizeHandles from './components/RoomResizeHandles';
import AndroidSettings from './components/AndroidSettings';
import RoomMusicBox from './components/RoomMusicBox';
import RoomWalker from './components/RoomWalker';
import {isWebApp} from './web-app';
import WebAppHelp from './components/WebAppHelp';
import {roomPetScale} from './room-pet-size';
import {isRamBodyPoint} from './ram-hit-test';
import { useRoomMedia } from './room-media';
import { createMemory, loadMemory, recordCare, recordEvent, saveMemory, memoryKey, getCompanionMood } from './companion-memory';
import type { CompanionMemory } from './companion-memory';
import './companion-life.css';
import { usePresence } from './use-presence';
import { claimDailyGreeting, greetingKey, presenceKey, welcomeLine, wantsQuiet } from './companion-presence';
import { useIdleLife } from './use-idle-life';
import { isPlaybackVisible, setNativePlaybackVisibility } from './playback-visibility';
import { DEFAULT_IDLE_INTERVAL_SECONDS, validIdleIntervalSeconds } from './idle-behavior';
import IdleIntervalSetting from './components/IdleIntervalSetting';
import CareFeedback from './components/CareFeedback';
import {careGains,gameGains,mergeCareFeedback,type CareFeedbackData} from './care-feedback';
import type { PresenceLine } from './companion-presence';
import { useRestReminder, validReminderMinutes, reminderTime, timerRecordDetail, type TimerDirection } from './use-rest-reminder';
import PetInvitation from './components/PetInvitation';
import { createInvitation, companionSnoozeUntil } from './companion-invitation';
import type { CompanionInvitation } from './companion-invitation';
import { getPetHabits, nameResponse } from './companion-instinct';
import {claimDailyCheckIn,checkedInToday} from './daily-check-in';
import {isPastime,playBlockReason,beginOuting,finishOuting,PASTIME_MEMORIES} from './pet-pastimes';
import type {Pastime} from './pet-pastimes';
import PetPastimes from './components/PetPastimes';
import {elementSkillById,learnedElementSkill} from './element-skills';
import RamSchoolPanel,{ActivityCard} from './components/RamSchoolPanel';
import {activityAction,beginActivity,cancelActivity,finishRestaurantWork,courseById,hasLearnedMagic,isSchoolAction,learned,petSpeech,JOB_PAY,type CourseId} from './pet-school';
import {DeferredView,RoomFurnishingLayer,RoomFurnishingEditor,OriginalReadingBook,ShopBook,Wardrobe,PetDiary,
  RestaurantWorkShowcase,FruitGame,MemoryGame,TreasureGame,MoreGames,ColorMixerGame} from './deferred-views';
import {RAM_HANDBOOK_ID,READING_SHELF_ID,type RamBookId,type ReadingProgress} from './reading-progress';
import {PET_SAVE_KEY,MAX_BACKUP_BYTES,InvalidPetBackup,validatePetBackup,restorePetBackup,petBackupText} from './pet-backup';
import {buyFurniture,placeFurniture,duplicateFurniture,removeFurniture,changeReadingShelfPage,placementKey,hasPlacedMusicBox,MUSIC_BOX_ID,type Placement} from './room-furnishings';
import {roomFurnitureAction,type RoomFurniturePlayback} from './room-furniture-actions';

const SAVE_KEY = PET_SAVE_KEY;
const PREFS_KEY = 'ramu-house-preferences-v2';
type Panel = CompanionPanel | 'shop' | 'games' | 'growth' | 'settings' | 'decor' | 'wardrobe' | 'memories' | 'school' | 'bookshelf' | 'handbook' | 'music-box' | null;
type GameKind = 'fruit' | 'memory' | 'treasure' | ExtraGame | 'color-mixer' | 'restaurant';
const GAME_LABELS: Record<GameKind, string> = {restaurant:'拉姆餐厅','color-mixer':'拉姆换色游戏', fruit:'拉姆接果子',memory:'口袋翻翻乐',rhythm:'拉姆拍拍乐',orchard:'草地采果',puzzle:'小屋拼拼乐',treasure:'小屋寻宝' };
type Preferences = { roomPetScale:number; roomWander:boolean; gameSound:boolean; sound: boolean; soundVolume: number; lively: boolean; randomMagic:boolean; idleIntervalSeconds: number; outings: boolean; reminders: boolean; reminderMinutes: number; reminderSound: boolean; timerDirection:TimerDirection; presence: boolean; presenceMinutes: number };
type Result = { state: GameState; message: string; ok: boolean };
interface FocusStudy { petId:number; activity:StudyActivity; next:StudyActivity; shot:number; passage:number; played:number }
const titles = { bookshelf:'我的拉姆书架',handbook:'拉姆手册','music-box':'音乐盒',notes:'小屋留言板',status:'我的拉姆',food:'拉姆的背包',play:'一起玩耍',shop:'拉姆用品商店',games:'小屋游戏',growth:'一起长大',memories:'回忆',settings:'小屋设置',decor:'布置小屋',wardrobe:'拉姆小衣橱',school:'拉姆学院' };
function readSave() {
 try {
  const raw=localStorage.getItem(SAVE_KEY);if(!raw||raw.length>MAX_SAVE_LENGTH)return null;
  const stored=JSON.parse(raw);let selected=false;
  try{const history=JSON.parse(localStorage.getItem(memoryKey(stored))??'null');selected=history?.version===1&&history.petId===String(stored.createdAt)&&Array.isArray(history.events)&&history.events.some((event:{kind?:string})=>event?.kind==='stage-choice');if(history?.petId===String(stored.createdAt)&&!Number.isFinite(stored.naturalGrowth))stored.highestGrowth=Math.max(typeof stored.highestGrowth==='number'&&Number.isFinite(stored.highestGrowth)?stored.highestGrowth:0,legacyUnlockedGrowth(history.events))}catch{}
  const restored=normalizeSavedPet(stored,Date.now(),selected);return restored&&stored.stats?recordStatChange(stored,restored,'离线期间的消耗、休息与活动结算',restored.lastTick):restored;
 }catch{return null}
}
function readPrefs(): Preferences { try { const p = JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}'); return { roomPetScale:roomPetScale(p.roomPetScale), roomWander:p.roomWander!==false, gameSound:typeof p.gameSound==='boolean'?p.gameSound:p.sound!==false, sound: p.sound !== false, soundVolume: typeof p.soundVolume === 'number' && Number.isFinite(p.soundVolume) ? Math.max(0,Math.min(1,p.soundVolume)) : .45, lively: p.lively !== false, randomMagic:p.randomMagic===true, idleIntervalSeconds: validIdleIntervalSeconds(p.idleIntervalSeconds), outings: p.outings !== false, reminders: p.reminders !== false, reminderMinutes: validReminderMinutes(p.reminderMinutes), reminderSound: p.reminderSound !== false, timerDirection: p.timerDirection==='countup'?'countup':'countdown', presence: p.presence !== false, presenceMinutes: [10,20,40].includes(p.presenceMinutes)?p.presenceMinutes:20 }; } catch { return { roomPetScale:1, roomWander:true, gameSound:true, sound: true, soundVolume: .45, lively: true, randomMagic:false, idleIntervalSeconds: DEFAULT_IDLE_INTERVAL_SECONDS, outings: true, reminders: true, reminderMinutes: 40, reminderSound: true, timerDirection:'countdown', presence: true, presenceMinutes: 20 }; } }
function GameDialog({ title, children, onClose, wide = false }: { title: string; children: ReactNode; onClose: () => void; wide?: boolean }) {
  const dialog = useRef<HTMLDivElement>(null); const close = useRef(onClose); close.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null; dialog.current?.focus();
    const key = (e: KeyboardEvent) => { const stack = document.querySelectorAll('[role=dialog]'); if (stack[stack.length - 1] !== dialog.current) return; if (e.key === 'Escape') close.current(); if (e.key === 'Tab') { const items = dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled):not([type=hidden]),textarea:not(:disabled),select:not(:disabled),summary,a[href],[tabindex="0"]'); if (!items?.length) return; const first = items[0], last = items[items.length - 1]; if (e.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); } } };
    document.addEventListener('keydown', key); return () => { document.removeEventListener('keydown', key); previous?.focus(); };
  }, []);
  return <div className="game-overlay" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}><section ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title} className={`game-panel ${wide ? 'wide-panel' : ''}`}><header className="panel-header"><h2>{title}</h2><button className="round-close" onClick={onClose} aria-label="关闭面板">×</button></header><div className="panel-paper">{children}</div></section></div>;
}

export default function App({startInRoom=false}:{startInRoom?:boolean}={}) {
  const webEdition=isWebApp();
  const nativeDrawingBounds=useNativeDrawingBounds();
  const [pet, setPetRaw] = useState<GameState | null>(readSave);
  const setPet=useCallback((change:SetStateAction<GameState|null>,reason='自然消耗与休息')=>{
    setPetRaw(previous=>{const next=typeof change==='function'?change(previous):change;return previous&&next?recordStatChange(previous,next,reason):next;});
  },[]);
  const [unreadableSave,setUnreadableSave]=useState(()=>{try{return !pet&&localStorage.getItem(SAVE_KEY)!==null}catch{return true}});
  const [prefs, setPrefs] = useState<Preferences>(readPrefs);
  const [panel, setPanel] = useState<Panel>(null);
  const books=useBookDownloads(panel==='decor'||panel==='settings');
  const [furniturePlayback,setFurniturePlayback]=useState<RoomFurniturePlayback|null>(null);
  const furnitureSequence=useRef(0);
  const dismountFurniture=useCallback(()=>setFurniturePlayback(null),[]);
  const [roomWalking,setRoomWalking]=useState(false);
  const [roomSizeDraft,setRoomSizeDraft]=useState<number|null>(null);
  const [shelfBook,setShelfBook]=useState<RamBookId|undefined>();
  const [color, setColor] = useState<PetColor>('pink');
  const [name, setName] = useState(pet?.name ?? '小拉姆');
  const [adoptionStep, setAdoptionStep] = useState<'color' | 'name'>('color');
  const [waitingForReopen, setWaitingForReopen] = useState(false);
  const awaitingAdoption = useRef(false);
  const careUntil = useRef(0);
  const touches = useRef<number[]>([]);
  const dizzyUntil = useRef(0);
  const [actionItemId, setActionItemId] = useState<string | undefined>();
  const [actionFromColor,setActionFromColor]=useState<PetColor|undefined>();
  const [careFeedback,setCareFeedback]=useState<CareFeedbackData|null>(null);
  const gameFeedback=useRef<CareFeedbackData|null>(null);
  const pendingCareFeedback=useRef<CareFeedbackData|null>(null);
  const lastTug=useRef(0);
  const [action, setAction] = useState('idle');
  const [study,setStudy] = useState<FocusStudy|null>(null);
  const paintedStudy=useRef<FocusStudy|null>(null);
  const [courseCompletion,setCourseCompletion]=useState('');
  const [petMode, setPetMode] = useState(false);
  const [startingDesktopPet,setStartingDesktopPet]=useState(()=>Boolean(window.desktop?.isElectron&&pet));
  const [preview, setPreview] = useState(() => !startInRoom && !webEdition && !window.desktop && pet !== null);
  const [actionId, setActionId] = useState(0);
  const [desktopState, setDesktopState] = useState<DesktopState>({ petMode:false,alwaysOnTop:false,wandering:true,companionPanel:false,panelSide:'right',edgeHiding:true,edgeSide:null,edgePose:'visible' });
  const roomScreen=useRoomFullscreen(Boolean(desktopState.roomFullscreen));
  const [toast, setToast] = useState('');
  const [saveFeedback,setSaveFeedback]=useState<SaveFeedback|null>(null);
  const [bubble, setBubble] = useState('拉姆～ 我来陪你啦！');
  const [bubbleIsDescription,setBubbleIsDescription]=useState(false);
  const [bubbleVisible, setBubbleVisible] = useState(false);
  const [invitation, setInvitation] = useState<{ petId:number; at:number; offer:CompanionInvitation } | null>(null);
  const invitationRef = useRef(invitation); invitationRef.current = invitation;
  const suggestionSequence = useRef(0), nameSequence = useRef(0), nameCallUntil = useRef(0);
  const [game, setGame] = useState<GameKind | null>(null);
  const [reset, setReset] = useState(false);
  const [pocketCategory, setPocketCategory] = useState<PocketCategory>('food');
  const [shopCategory,setShopCategory]=useState<PocketCategory>('food');
  const [pocketVisit, setPocketVisit] = useState(0);
  const [memory, setMemory] = useState<CompanionMemory | null>(() => pet ? loadMemory(pet) : null);
  const [memorySaveError, setMemorySaveError] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const petRef = useRef(pet); petRef.current = pet;
  const workHeartbeat = useRef(Date.now());
  const workPresence=useRef(new WorkPresence());
  const timers = useRef<{ animation?: ReturnType<typeof setTimeout>; toast?: ReturnType<typeof setTimeout>; bubble?: ReturnType<typeof setTimeout>; feedback?: ReturnType<typeof setTimeout>;course?:ReturnType<typeof setTimeout> }>({});
  const ambient = useRef<{line:PresenceLine;at:number}|null>(null);
  const previousRest = useRef<{petId:number;sleeping:boolean}|null>(null);
  const pastimeRun=useRef<{petId:number;kind:Pastime}|null>(null);
  const uploadedRun=useRef<{petId:number;id:string;endsAt:number}|null>(null);
  const importSequence=useRef(0);
  useEffect(()=>()=>{importSequence.current++},[]);

  const updateSnapshot=useRef<()=>boolean>(()=>false);
  const diskSnapshot=useRef<()=>string|null>(()=>null);
  const [backupError,setBackupError]=useState(false);
  useEffect(()=>window.desktop?.updates?.onPrepare(async()=>{
    if(!updateSnapshot.current())return false;
    const text=diskSnapshot.current();
    if(text&&window.desktop?.localSaves)await window.desktop.localSaves.checkpoint(text,'before-update');
    return true;
  }),[]);
  const adoptionFocus = useRef<HTMLInputElement>(null);
  const hasPet = pet !== null;
  const current = pet ?? createPet('小拉姆', color);
  const stage = getStage(current.growth, current.evolution);
  const magicLearned=hasLearnedMagic(current);
  const appearance=petAppearance(current);
  const nativePet = petMode || startingDesktopPet;
  const floating = nativePet || preview;
  const roomStatusOpen = !floating && panel === 'status';
  useEffect(()=>{if(floating||panel!==null||game!==null||!pet)setRoomSizeDraft(null)},[floating,panel,game,pet?.createdAt]);
  function finishRoomSize(commit:boolean){if(commit&&roomSizeDraft!==null)setPrefs(p=>({...p,roomPetScale:roomPetScale(roomSizeDraft)}));setRoomSizeDraft(null)}
  const condition = getPetCondition(current);
  const spokenBubble=bubbleIsDescription?bubble:petSpeech(current,bubble);
  const workingAway = current.activity?.kind==='restaurant';
  const renderedAction = (workingAway?'still':activityAction(current.activity)) ?? (action !== 'idle' ? action : desktopState.motion === 'left' ? 'walk-left' : desktopState.motion === 'right' ? 'walk-right' : condition.action);
  const actionAppearance=petActionAppearance(current,current.sleeping?'sleep':renderedAction,actionItemId);
  const musicBoxPlaced = hasPet && hasPlacedMusicBox(current);
  const roomMedia = useRoomMedia(hasPet && !floating, musicBoxPlaced, game==='restaurant'&&workingAway?'./assets/original/restaurant/audio/bgSound.mp3':undefined);
  useEffect(()=>window.desktop?.onMusicToggle?.(enabled=>{if(musicBoxPlaced)roomMedia.update({backgroundPlayback:enabled})}),[musicBoxPlaced,roomMedia.update]);
  useEffect(()=>{void window.desktop?.setMusicState?.({playing:roomMedia.playing,enabled:musicBoxPlaced&&roomMedia.settings.musicEnabled,background:musicBoxPlaced&&roomMedia.settings.backgroundPlayback})?.catch(()=>{})},[musicBoxPlaced,roomMedia.playing,roomMedia.settings.musicEnabled,roomMedia.settings.backgroundPlayback]);
  useEffect(()=>{configurePetSound({enabled:prefs.sound,gameEnabled:prefs.gameSound,volume:prefs.soundVolume})},[prefs.sound,prefs.gameSound,prefs.soundVolume]);
  const currentMemory = memory?.petId === String(current.createdAt) ? memory : createMemory(current);
  diskSnapshot.current=()=>{const saved=petRef.current;return saved&&!awaitingAdoption.current&&currentMemory.petId===String(saved.createdAt)?petBackupText(saved,currentMemory,localStorage):null};
  updateSnapshot.current=()=>{try{const saved=petRef.current;if(awaitingAdoption.current)return false;if(saved){localStorage.setItem(SAVE_KEY,JSON.stringify(saved));if(currentMemory.petId===String(saved.createdAt)&&!saveMemory(saved,currentMemory))return false}localStorage.setItem(PREFS_KEY,JSON.stringify(prefs));return true}catch{return false}};
  useEffect(()=>{
    const api=window.desktop?.localSaves;if(!api||!pet||awaitingAdoption.current)return;
    let live=true;
    const timer=setTimeout(()=>{try{const text=diskSnapshot.current();if(text)void api.checkpoint(text).then(()=>{if(live)setBackupError(false)},()=>{if(live)setBackupError(true)})}catch{if(live)setBackupError(true)}},400);
    return()=>{live=false;clearTimeout(timer)};
  },[pet,memory,prefs]);
  const snoozed = companionSnoozeUntil(currentMemory) > Date.now();
  const openInvitation = invitation?.petId === current.createdAt && Date.now()-invitation.at < 5*60000 ? invitation.offer : null;

  const speak = useCallback((text: string, duration = 6500, description=false) => { ambient.current = null; setBubble(text);setBubbleIsDescription(description); setBubbleVisible(true); clearTimeout(timers.current.bubble); timers.current.bubble = setTimeout(() => setBubbleVisible(false), duration); }, []);
  const notify = useCallback((text: string) => { setToast(text); clearTimeout(timers.current.toast); timers.current.toast = setTimeout(() => setToast(''), 3800); }, []);
  useEffect(()=>{if(roomScreen.error)notify(roomScreen.error)},[roomScreen.error,notify]);
  useEffect(() => { setCourseCompletion('');clearTimeout(timers.current.course);clearInvitation(); suggestionSequence.current=0; nameSequence.current=0; nameCallUntil.current=0; }, [pet?.createdAt]);
  useEffect(() => { if(pet?.sleeping)clearInvitation(); }, [pet?.sleeping]);
  useEffect(() => {
    if (!invitation) return;
    const expiry = setTimeout(() => {
      if (invitationRef.current === invitation) clearInvitation();
    }, Math.max(0, invitation.at + 5 * 60000 - Date.now()));
    return () => clearTimeout(expiry);
  }, [invitation]);
  useEffect(() => { if (pet && petRef.current?.createdAt === pet.createdAt && !awaitingAdoption.current) { try { localStorage.setItem(SAVE_KEY, JSON.stringify(pet)); setSaveError(false); } catch { setSaveError(true); } } }, [pet]);
  useEffect(()=>{void window.desktop?.messageBoard?.publish(pet?{name:pet.name,createdAt:pet.createdAt,notes:pet.notes??[]}:null).catch(()=>{})},[pet?.createdAt,pet?.name,pet?.notes]);
  useEffect(()=>window.desktop?.messageBoard?.onPatch(request=>{
    const saved=petRef.current;
    if(!saved||saved.createdAt!==request.petId||JSON.stringify(saved.notes??[])!==request.baseNotes)return {ok:false,reason:'stale',snapshot:saved?{name:saved.name,createdAt:saved.createdAt,notes:saved.notes??[]}:undefined};
    if(!updateNotes(request.notes))return {ok:false,reason:'storage'};
    const next=petRef.current!;return {ok:true,snapshot:{name:next.name,createdAt:next.createdAt,notes:next.notes??[]}};
  }),[]);
  useEffect(()=>{
    const checkpoint=()=>{if(updateSnapshot.current()){void window.desktop?.flushSave?.().catch(()=>{});try{const text=diskSnapshot.current();if(text)void window.desktop?.localSaves?.checkpoint(text).catch(()=>{})}catch{}}};
    window.addEventListener('pagehide',checkpoint);window.addEventListener('blur',checkpoint);
    return()=>{window.removeEventListener('pagehide',checkpoint);window.removeEventListener('blur',checkpoint)};
  },[]);
  useEffect(() => { try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch { /* Pet save has its own error notice. */ } }, [prefs]);
  useEffect(() => {
    const advance = () => setPet(p => p ? advancePet(p) : p);
    const resume = () => { if (!document.hidden) advance(); };
    const timer = setInterval(advance, 15000);
    const unsubscribe = window.mobile?.on('resume', advance);
    document.addEventListener('visibilitychange', resume);
    window.addEventListener('focus', resume);
    return () => {
      clearInterval(timer); unsubscribe?.();
      document.removeEventListener('visibilitychange', resume);
      window.removeEventListener('focus', resume);
    };
  }, []);
  useEffect(() => {
    const desktop = window.desktop; if (!desktop) return;
    const unsubscribe = desktop.onStateChanged(state => {
      setNativePlaybackVisibility(desktop.isElectron && desktop.platform === 'win32' && state.petMode ? state.windowVisible : undefined);
      setDesktopState(state);
      setPetMode(state.petMode);
      document.documentElement.classList.toggle('pet-mode', state.petMode);
    });
    return () => {
      unsubscribe();
      setNativePlaybackVisibility(undefined);
      document.documentElement.classList.remove('pet-mode');
    };
  }, []);
  useEffect(() => {
    const desktop = window.desktop; if (!desktop) return;
    if (awaitingAdoption.current) { desktop.readyToShow(false); return; }
    let cancelled = false;
    // A hidden Windows window can throttle animation frames. Acknowledge the
    // native mode change without waiting for its first visible frame.
    let signaled = false;
    const signal = () => { if (cancelled || signaled) return; signaled = true; desktop.readyToShow(hasPet); };
    const ready = () => { if(cancelled)return;setStartingDesktopPet(false);signal(); };
    void desktop.setPetMode(desktop.platform==='android'?false:hasPet).then(ready).catch(() => {
      if(cancelled)return;
      // A native window can reject a mode change while it is still restoring
      // its first bounds. The renderer is already usable; reveal it so the
      // user can retry from the tray instead of leaving a permanently hidden
      // adoption/normal window.
      notify(desktop.platform==='android'?'小屋暂时未能打开，请重试。':'窗口暂时未能准备好，请从托盘重试。');
      ready();
    });
    return () => { cancelled = true; };
  }, [hasPet, notify]);
  useEffect(() => {
    function greet(){
      const saved=petRef.current;if(!saved||awaitingAdoption.current)return;
      if(window.desktop?.isElectron?desktopState.windowVisible!==true:document.hidden)return;
      if(claimDailyGreeting(saved))speak(welcomeLine(saved,loadMemory(saved)),8500,true);
    }
    greet();
    document.addEventListener('visibilitychange',greet);
    const unsubscribe=window.mobile?.on('resume',greet);
    return()=>{document.removeEventListener('visibilitychange',greet);unsubscribe?.()};
  }, [pet?.createdAt,desktopState.windowVisible,speak]);
  useEffect(()=>window.mobile?.on('back',()=>{
    if(reset){setReset(false);return;}
    if(game){setGame(null);return;}
    if(panel){void openPanel(null);return;}
    if(roomScreen.fullscreen){void roomScreen.exit();return;}
    window.desktop?.hideToTray();
  }),[reset,game,panel,roomScreen.fullscreen]);
  useEffect(()=>window.mobile?.on('openPanel',value=>{const next=value.panel;if(next==='food'||next==='status'||next==='settings'||next==='games'||next==='school')void openPanel(next);}),[]);
  useEffect(() => { if (floating && game) setGame(null); }, [floating, game]);
  useEffect(() => {
    // Native tray switches bypass the room's Return to Desktop button.
    // A room dialog left in state would keep the desktop timeline paused.
    if (floating) { setPanel(null); setReset(false); }
  }, [floating]);
  useEffect(() => {
    if (!musicBoxPlaced) setPanel(open => open==='music-box' ? null : open);
  }, [musicBoxPlaced]);
  useEffect(() => { if (!hasPet) adoptionFocus.current?.focus(); }, [hasPet]);
  useEffect(() => () => { Object.values(timers.current).forEach(clearTimeout); }, []);
  useEffect(() => { if (pet && memory?.petId !== String(pet.createdAt)) setMemory(loadMemory(pet)); }, [pet, memory?.petId]);
  useEffect(() => { if (pet && petRef.current?.createdAt === pet.createdAt && !awaitingAdoption.current && memory?.petId === String(pet.createdAt)) setMemorySaveError(!saveMemory(pet, memory)); }, [pet, memory]);
  const timer = useRestReminder(pet?.createdAt, prefs.reminders, prefs.reminderMinutes, (alreadyNotified) => {
    const text = '计时结束啦！站起来伸伸懒腰，喝口水，看看远处吧。';
    speak(text, 15000); notify(text);if(!alreadyNotified){playReminderSound(prefs.reminderSound);window.desktop?.notify('拉姆 · 计时结束', text);}
  },prefs.timerDirection,record=>setMemory(m=>m?.petId===String(record.petId)?recordEvent(m,{kind:'focus-timer',detail:timerRecordDetail(record),at:record.endedAt}):m),prefs.reminderSound);
  const studyForm=ramForm(stage,current.evolution);
  // The timer may end while a new source is preparing. Drain only the last
  // shot whose playback has actually started.
  const focusPose=(timer.running||timer.finished&&paintedStudy.current===study)&&study?.petId===current.createdAt&&action==='idle'&&!current.sleeping?study:null;
  const studyClip=focusPose&&originalStudyClip(studyForm,focusPose.activity);
  const displayAction=studyClip?`ambient-${studyClip.id}`:renderedAction;
  const displayActionId=focusPose?`study-${focusPose.petId}-${focusPose.shot}`:actionId;
  const studyClipDuration=studyClip?.effectFrames?studyClip.effectFrames/studyClip.fps*1000:
    focusPose?uploadedMotion(studyForm,displayAction)?.durationMs??8000:0;
  useEffect(()=>{
    if(!pet||pet.sleeping){setStudy(null);return;}
    if(!timer.running){setStudy(previous=>timer.finished&&paintedStudy.current===previous?previous:null);return;}
    if(action==='idle')setStudy(previous=>previous?.petId===pet.createdAt?previous:{petId:pet.createdAt,activity:'read',next:nextStudyActivity(studyForm,'read'),shot:0,passage:0,played:0});
  },[pet?.createdAt,pet?.sleeping,timer.running,timer.finished,action,studyForm]);
  useEffect(()=>{
    if(!pet||!prefs.reminders||pet.sleeping)return;
    const warm=setTimeout(()=>{void preloadStudyActivity(studyForm,current.color,'read').catch(()=>{})},150);
    return()=>clearTimeout(warm);
  },[pet?.createdAt,pet?.sleeping,prefs.reminders,studyForm,current.color]);
  const upcomingStudy=focusPose&&focusPose.played+studyClipDuration>=25000?focusPose.next:undefined;
  useEffect(()=>{
    if(timer.running&&upcomingStudy)void preloadStudyActivity(studyForm,current.color,upcomingStudy).catch(()=>{});
  },[timer.running,upcomingStudy,studyForm,current.color]);
  function markStudyPainted(){
    const previous=paintedStudy.current;
    if(!focusPose||previous===focusPose)return;
    paintedStudy.current=focusPose;
    const saved=petRef.current;
    if(timer.running&&saved&&(focusPose.shot===0||previous?.passage!==focusPose.passage))
      speak(studyActionLine(focusPose.activity,saved,focusPose.passage),5600,true);
  }
  function finishDisplay(completed=true){
    if(!focusPose){finishPerformance(completed);return;}
    if(!timer.running){setStudy(previous=>previous===focusPose?null:previous);return;}
    const played=focusPose.played+studyClipDuration;
    const activity=completed&&played<25000?focusPose.activity:focusPose.next;
    const change=activity!==focusPose.activity;
    setStudy(previous=>previous===focusPose?{...focusPose,activity,next:change?nextStudyActivity(studyForm,activity):focusPose.next,shot:focusPose.shot+1,
      passage:focusPose.passage+Number(change),played:change?0:Math.min(25000,played)}:previous);
  }
  const reading=timer.running||Boolean(focusPose)||action==='read-alone';
  const interactionReason = animationBlockReason({action,timerRunning:timer.running||Boolean(focusPose),careUntil:careUntil.current,dizzyUntil:dizzyUntil.current});
  const selectedFurniture=furniturePlayback&&pet?.createdAt===furniturePlayback.petId&&stage>0
    ?current.room?.placed.find(piece=>placementKey(piece)===furniturePlayback.key):undefined;
  const furnitureSeat=floating?undefined:selectedFurniture;
  const activeFurniturePlayback=furnitureSeat&&panel!=='decor'&&game===null&&!reset&&roomSizeDraft===null&&action==='idle'&&
    !current.sleeping&&!current.activity&&!current.outing&&!timer.running?furniturePlayback:null;
  useEffect(()=>{
    if(furniturePlayback&&!selectedFurniture)setFurniturePlayback(null);
    else if(!activeFurniturePlayback&&furniturePlayback?.ready)setFurniturePlayback({...furniturePlayback,ready:false});
  },[furniturePlayback,selectedFurniture,activeFurniturePlayback]);
  useEffect(()=>{
    if(!furnitureSeat||panel!==null||game!==null||reset)return;
    const stop=(event:KeyboardEvent)=>{if(event.key==='Escape')dismountFurniture();};
    document.addEventListener('keydown',stop);
    return()=>document.removeEventListener('keydown',stop);
  },[furnitureSeat,panel,game,reset,dismountFurniture]);
  const interactionBusy = Boolean(desktopState.petResizing) || Boolean(current.activity) || current.sleeping || Boolean(current.outing) || interactionReason !== null;
  const schoolBusy = isOfficialAction(action)&&!isAmbientAction(action) || timer.running || Date.now()<careUntil.current || ['play','dizzy'].includes(action);
  const tellPresence = usePresence({pet,memory:currentMemory,enabled:prefs.presence,minutes:prefs.presenceMinutes,reading:timer.running,
    blocked:Boolean(desktopState.petResizing)||!floating||snoozed||current.sleeping||Boolean(current.activity)||Boolean(current.outing)||panel!==null||game!==null||!['idle','focus'].includes(action)||bubbleVisible||desktopState.edgeSide!==null||(desktopState.motion!==undefined&&desktopState.motion!=='idle'),
    onLine:line=>{if(line.invitation)presentInvitation({...line.invitation,text:line.text});else{clearInvitation();speak(line.text,14000);}ambient.current={line,at:Date.now()};}
  });
  const quietSpeech = wantsQuiet(currentMemory);
  const nativeWindowHidden = Boolean(window.desktop?.isElectron && desktopState.windowVisible !== true);
  const desktopIdleBlocked = floating && (desktopState.edgePose === 'tucking' || (desktopState.motion ?? 'idle') !== 'idle' || Boolean(desktopState.dragPoint) || desktopState.companionPanel);
  useIdleLife({
    pet: pet ?? undefined, memory: currentMemory, intervalSeconds: prefs.idleIntervalSeconds, enabled: prefs.lively, randomMagic:magicLearned&&prefs.randomMagic,
    blocked: nativeWindowHidden || desktopIdleBlocked || (!floating && roomWalking) || Boolean(furnitureSeat || desktopState.petResizing) ||
      snoozed || interactionReason !== null || (panel !== null && !roomStatusOpen) || game !== null || reset ||
      roomSizeDraft !== null || action !== 'idle' || bubbleVisible,
    onAction(next, sequence) {
      if (!panel && !desktopState.edgeSide && !quietSpeech && prefs.outings && sequence % 5 === 4 && startOuting(false, sequence)) return;
      if (isPastime(next)) { startPastime(next, !quietSpeech, sequence); return; }
      animate(next);
      if (!quietSpeech) speak(autonomousActionLine(next,current,sequence), 5700, true);
    },
  });
  const returnRef=useRef((manual=false)=>recallPet(manual));returnRef.current=recallPet;
  useEffect(()=>{
    if(!pet?.outing)return;
    const due=setTimeout(()=>returnRef.current(false),Math.max(0,pet.outing.returnsAt-Date.now()));
    return()=>clearTimeout(due);
  },[pet?.createdAt,pet?.outing?.id]);
  useEffect(()=>{if(petRef.current?.outing&&!prefs.outings&&!petRef.current.outing.manual)returnRef.current(true)},[prefs.outings]);
  const previousActivity=useRef(pet?.activity);
  function advancePet(saved:GameState){
    const now=Date.now(),gap=now-workHeartbeat.current;
    if(saved.activity?.kind==='restaurant'&&(!workPresence.current.isPresent(document.hidden,now)||navigator.onLine===false||gap>5000||gap<0)){
      previousActivity.current=undefined;return tick(cancelActivity(saved),now);
    }
    return tick(saved,now);
  }
  useEffect(()=>{
    const cancelWork=()=>{
      const saved=petRef.current;if(saved?.activity?.kind!=='restaurant')return;
      previousActivity.current=undefined;const next=cancelActivity(saved);petRef.current=next;setPet(next,'餐厅工作中止');
      try{localStorage.setItem(SAVE_KEY,JSON.stringify(next));void window.desktop?.flushSave?.().catch(()=>{})}catch{setSaveError(true)}
    };
    const visibility=()=>{if(!workPresence.current.isPresent(document.hidden))cancelWork()};
    const heartbeat=setInterval(()=>{const now=Date.now();if(!workPresence.current.isPresent(document.hidden,now)||navigator.onLine===false||now-workHeartbeat.current>5000)cancelWork();workHeartbeat.current=now;},1000);
    const unsubscribe=window.desktop?.onStateChanged(state=>{workPresence.current.observeWindow(state);if(!workPresence.current.isPresent(document.hidden))cancelWork()});
    window.addEventListener('offline',cancelWork);window.addEventListener('pagehide',cancelWork);document.addEventListener('visibilitychange',visibility);
    return()=>{clearInterval(heartbeat);unsubscribe?.();window.removeEventListener('offline',cancelWork);window.removeEventListener('pagehide',cancelWork);document.removeEventListener('visibilitychange',visibility)};
  },[]);
  useEffect(()=>{
    if(!pet?.activity||pet.activity.kind==='restaurant'&&pet.activity.continuous)return;
    const id=pet.activity.id,due=setTimeout(()=>setPet(p=>p?.activity?.id===id?advancePet(p):p),Math.max(0,pet.activity.endsAt-Date.now()+5));
    return()=>clearTimeout(due);
  },[pet?.activity?.id]);
  useEffect(()=>{
    const before=previousActivity.current;previousActivity.current=pet?.activity;
    if(!pet||!before||!before.id.startsWith(`${pet.createdAt}:`)||pet.activity?.id===before.id||Date.now()<before.endsAt)return;
    const c=courseById(before.course),text=before.kind==='restaurant'?(before.continuous?`打工已结束，本次已结算 ${before.paidCoins??0} 摩尔豆。`:`工作完成！摩尔豆 +${JOB_PAY}`):before.course==='magic'?'魔法课学习完成！获得魔法法杖，已放进衣橱。':`${c!.name}学习完成！已掌握。`;
    notify(text);speak(text);playGameSound('reward',prefs.gameSound);
    if(before.kind==='course'){setCourseCompletion(text);clearTimeout(timers.current.course);timers.current.course=setTimeout(()=>setCourseCompletion(''),6500)}
    if(before.kind==='restaurant'&&!before.continuous){
      clearTimeout(timers.current.feedback);setBubbleVisible(false);setCareFeedback({id:Date.now(),petId:pet.createdAt,gains:[{key:'coins',label:'摩尔豆',amount:JOB_PAY,image:'./assets/original/ui/icon-medal.png'}]});timers.current.feedback=setTimeout(()=>setCareFeedback(null),2300);
    }
    setMemory(m=>m?recordEvent(m,{kind:before.kind==='restaurant'?'job-complete':'course-complete',detail:text}):m);
  },[pet?.activity,pet?.education]);
  async function enterRestaurant(){
    if(!petRef.current)return;
    if(schoolBusy){notify('先结束正在进行的互动或专注计时吧。');return;}
    await enterHome();setGame('restaurant');
  }
  function startActivity(kind:'course'|'restaurant',id?:CourseId){
    const saved=petRef.current;if(!saved)return;
    if(kind==='restaurant'&&navigator.onLine===false){notify('联网后再让拉姆去打工吧。');return;}
    if(schoolBusy){notify('先结束正在进行的互动或专注计时吧。');return;}
    const result=beginActivity(tick(saved),kind,id);if(!result.ok){notify(result.message);return;}
    if(kind==='restaurant'){workHeartbeat.current=Date.now();petRef.current=result.state;if(game!=='restaurant')setGame(null);setBubbleVisible(false);void window.desktop?.setCompanionPanel(false);}
    setCourseCompletion('');clearInvitation();pastimeRun.current=null;clearTimeout(timers.current.animation);setActionId(n=>n+1);setPanel(null);apply(result);setAction('idle');
  }
  function stopActivity(){
    const saved=petRef.current;if(!saved?.activity)return;
    previousActivity.current=undefined;const work=saved.activity.kind==='restaurant',next=work?finishRestaurantWork(saved):cancelActivity(saved);petRef.current=next;setPet(next);notify(work?`打工结束，已按在线时长结算 ${next.coins-saved.coins+(saved.activity.paidCoins??0)} 摩尔豆。`:'已经回来啦。这次未完成的课程不结算。');
  }
  function showSkill(id:CourseId){
    const saved=petRef.current;if(!saved||!learned(saved,id)||schoolBusy||saved.sleeping||saved.activity||saved.outing)return;
    pastimeRun.current=null;clearTimeout(timers.current.animation);
    setPanel(null);animate(`skill-${id}`);speak(id==='english'?'Good morning! Have a lovely day!':id==='language'?'我学会说话啦！今天也想和你一起慢慢长大。':`看我新学会的${courseById(id)!.skill}！`);
  }
  function showElementSkill(id:string){
    const saved=petRef.current,skill=elementSkillById(id);if(!saved||!skill||!learnedElementSkill(saved,id)||schoolBusy||saved.sleeping||saved.activity||saved.outing)return;
    pastimeRun.current=null;clearTimeout(timers.current.animation);
    setPanel(null);setBubbleVisible(false);animate(`element-${id}`);
  }
  const finishRoomDecoration=useCallback(()=>{
    if(!updateSnapshot.current()){setSaveError(true);return;}
    setPanel(null);
    void window.desktop?.flushSave?.().catch(()=>setSaveError(true));
  },[]);
  useEffect(()=>{if(panel!=='decor')return;const close=(event:KeyboardEvent)=>{if(event.key==='Escape')finishRoomDecoration()};document.addEventListener('keydown',close);return()=>document.removeEventListener('keydown',close)},[panel,finishRoomDecoration]);
  function purchaseFurniture(id:string){
    const saved=petRef.current;if(!saved)return;
    const result=buyFurniture(saved,id);
    if(!result.ok)return result.message;
    petRef.current=result.state;setPet(result.state,result.message);
  }
  function updateFurniture(id:string,x?:number,y?:number,instanceId?:string,scale?:number,order?:number){
    if(id===READING_SHELF_ID&&x!==undefined&&!instanceId&&!books.unlocked)return;
    const saved=petRef.current;if(!saved)return;const next=x===undefined?removeFurniture(saved,id):placeFurniture(saved,id,x,y!,instanceId,scale,order);petRef.current=next;setPet(next);
  }
  function copyFurniture(key:string){
    const saved=petRef.current;if(!saved)return;
    if(!books.unlocked&&saved.room?.placed.some(piece=>piece.id===READING_SHELF_ID&&placementKey(piece)===key))return;
    const next=duplicateFurniture(saved,key),copy=next.room?.placed.at(-1);
    if(next===saved||!copy)return;
    petRef.current=next;setPet(next);
    return placementKey(copy);
  }
  function openBookSettings(){
    if(panel==='decor'&&!updateSnapshot.current()){setSaveError(true);return;}
    setPanel('settings');
    requestAnimationFrame(()=>document.querySelector('.settings-section[aria-label="图书素材"]')?.scrollIntoView({block:'nearest'}));
  }
  function openShelf(book?:RamBookId){
    const selected=book??petRef.current?.reading?.lastBook??RAM_HANDBOOK_ID;
    setShelfBook(selected);
    setPanel(selected===RAM_HANDBOOK_ID?'handbook':'bookshelf');
  }
  function activateFurniture(piece:Placement){
    const {id}=piece;
    if(id==='message-board')void openBoard();
    else if(id===MUSIC_BOX_ID)setPanel('music-box');
    else if(id===READING_SHELF_ID)openShelf();
    else if(roomFurnitureAction(id)){
      const saved=petRef.current,key=placementKey(piece);
      if(!saved||floating||panel!==null||game!==null||roomSizeDraft!==null)return;
      if(furniturePlayback?.key===key){dismountFurniture();return;}
      if(getStage(saved.growth,saved.evolution)===0){speak('拉姆长到初级就能用这件家具啦。',4200,true);return;}
      const blocked=playBlockReason(saved)??interactionReason;
      if(blocked){speak(blocked,4200,true);return;}
      clearInvitation();setBubbleVisible(false);
      if(action!=='idle')animate('idle');
      setFurniturePlayback({key,serial:++furnitureSequence.current,petId:saved.createdAt,ready:false});
    }
  }
  function furnitureMotionReady(serial:number){
    setFurniturePlayback(run=>run?.serial===serial?{...run,ready:true}:run);
  }
  function finishFurnitureMotion(serial:number,success=true){
    if(success)return;
    if(activeFurniturePlayback?.serial===serial)speak('这件家具的动画暂时没能打开，可以再试一次。',4200,true);
    setFurniturePlayback(run=>run?.serial===serial?null:run);
  }
  function updateShelfPage(key:string,page:number){const saved=petRef.current;if(!saved)return;const next=changeReadingShelfPage(saved,key,page);petRef.current=next;setPet(next)}
  function closeOriginalBook(){setPanel(shelfBook===RAM_HANDBOOK_ID?'handbook':null)}
  function updateReading(reading:ReadingProgress){const saved=petRef.current;if(!saved)return;const next={...saved,reading};petRef.current=next;setPet(next)}
  function startPastime(kind:Pastime,announce=true,sequence=Math.floor(Math.random()*12)){
    const saved=petRef.current;if(!saved)return;
    const reason=playBlockReason(saved);if(reason){notify(reason);return;}
    const blocked=animationBlockReason({action,timerRunning:timer.running,careUntil:careUntil.current,dizzyUntil:dizzyUntil.current});if(blocked){notify(blocked);return;}
    if(kind==='spell'&&!learned(saved,'magic')){notify('先到拉姆学院学会魔术，再展示变身本领吧。');return}
    clearInvitation();if(!floating)setPanel(null);preparePetSound(prefs.sound);animate(kind);pastimeRun.current={petId:saved.createdAt,kind};
    if(announce)speak(autonomousActionLine(kind,saved,sequence),6500,true);
  }
  function startUploaded(id:string){
    const saved=petRef.current;if(!saved)return;const clip=uploadedMotion(petActionAppearance(saved,`uploaded-${id}`).form,`uploaded-${id}`),toy=UPLOADED_TOYS.find(t=>t.id===id)
    if(!clip||!toy)return
    const reason=playBlockReason(saved);if(reason){notify(reason);return}
    const blocked=animationBlockReason({action,timerRunning:timer.running,careUntil:careUntil.current,dizzyUntil:dizzyUntil.current});if(blocked){notify(blocked);return}
    const duration=clip.durationMs;
    clearInvitation();setPanel(null);setBubbleVisible(false);animate(`uploaded-${id}`);uploadedRun.current={petId:saved.createdAt,id,endsAt:performance.now()+duration};
  }
  function startOfficial(id:string){
    const saved=petRef.current,requested=officialClip(id);if(!saved||!requested||requested.path.includes('/tatter/'))return;
    const form=ramForm(getStage(saved.growth,saved.evolution),saved.evolution),clip=originalActionVariant(requested,form);
    if(!playbackForm(clip,form))return;
    const reason=playBlockReason(saved)??animationBlockReason({action,timerRunning:timer.running,careUntil:careUntil.current,dizzyUntil:dizzyUntil.current});if(reason){notify(reason);return}
    clearInvitation();void openPanel(null);setBubbleVisible(false);animate(`official-${clip.id}`);setMemory(m=>m?recordEvent(m,{kind:'play-original',detail:`你让我展示了${clip.name}。`}):m);
  }
  function finishUploaded(completed=true){
    const run=uploadedRun.current;uploadedRun.current=null;const saved=petRef.current
    if(!completed||!run||!saved||saved.createdAt!==run.petId||performance.now()<run.endsAt)return
    const current=tick(saved),amount=Math.min(6,100-current.stats.happiness),next={...current,stats:{...current.stats,happiness:current.stats.happiness+amount,energy:Math.max(0,current.stats.energy-3)}}
    petRef.current=next;setPet(next,'完成一起玩耍：心情奖励与精力消耗')
    if(amount>0){setCareFeedback({id:Date.now(),petId:next.createdAt,gains:[{key:'happiness',label:'心情',amount:Math.round(amount*10)/10,image:'./assets/original/ui/icon-happy.png'}]});clearTimeout(timers.current.feedback);timers.current.feedback=setTimeout(()=>setCareFeedback(null),2300)}
    const title=UPLOADED_TOYS.find(t=>t.id===run.id)!.name;setMemory(m=>m?recordEvent(m,{kind:'play-original',detail:`你陪我玩了${title}。`}):m)
  }
  function stopUploaded(){uploadedRun.current=null;clearTimeout(timers.current.animation);finishCareFeedback();setAction('idle');setActionItemId(undefined);setActionFromColor(undefined);careUntil.current=0}
  useEffect(()=>{if(!isUploadedAction(action)&&!isOfficialAction(action)&&!isSchoolAction(action)&&action!=='spell'&&!actionItemId)return;const stop=(e:KeyboardEvent)=>{if(e.key==='Escape'&&panel===null)stopUploaded()};document.addEventListener('keydown',stop);return()=>document.removeEventListener('keydown',stop)},[action,actionItemId,panel])
  function finishPastime(){
    const run=pastimeRun.current;pastimeRun.current=null;if(!run||petRef.current?.createdAt!==run.petId)return;
    setMemory(m=>m?.petId===String(run.petId)?recordEvent(m,{kind:`self-${run.kind}`,detail:PASTIME_MEMORIES[run.kind]}):m);
  }
  function startOuting(manual=false,sequence=0){
    const saved=petRef.current;if(!saved||saved.activity||timer.running||Date.now()<careUntil.current||Date.now()<dizzyUntil.current)return false;
    const next=beginOuting(saved,sequence,Date.now(),manual);if(!next){if(manual)notify(getStage(saved.growth,saved.evolution)===0?'小花盆先留在家，长成初级再去逛逛吧。':playBlockReason(saved)??'暂时不能外出，请稍后再试。');return false}
    clearInvitation();if(manual)setPanel(null);pastimeRun.current=null;clearTimeout(timers.current.animation);setAction('idle');setActionItemId(undefined);setCareFeedback(null);
    petRef.current=next;setPet(next);speak(`我去${next.outing!.place}逛逛，过几分钟就回来。想我了就叫我！`,12000);
    setMemory(m=>m?recordEvent(m,{kind:'outing-start',detail:`我出发去了${next.outing!.place}，约好几分钟后回来。`}):m);return true;
  }
  function recallPet(manual=true){
    const saved=petRef.current;if(!saved?.outing)return;
    const trip=saved.outing,next=finishOuting(saved);petRef.current=next;setPet(next);
    const text=manual?'听见你叫我啦，我这就回来！':`我回来啦！${trip.story}`;
    setMemory(m=>m?recordEvent(m,{kind:manual?'outing-recall':'outing-return',detail:manual?`你叫我从${trip.place}回家，我提前回到了你旁边。`:trip.story}):m);
    if(!document.hidden){animate('waving');speak(text,14000);playPetVoice('drop',prefs.sound)}
  }
  function checkIn(){
    const saved=petRef.current;if(!saved)return;const result=claimDailyCheckIn(saved);petRef.current=result.state;setPet(result.state);speak(result.message);
    if(result.ok){setMemory(m=>m?recordEvent(m,{kind:'check-in',detail:'我们收好了今天签到的 1000 摩尔豆。'}):m)}
  }
  function respondMood(){
    const saved=petRef.current;if(document.hidden||!saved||interactionBusy)return
    clearInvitation();const response=moodResponse(saved,currentMemory);animate(response.action);if(response.action==='mood-joy')playInteractionPreview('sparkle',prefs.sound);speak(response.line,9500)
    setMemory(m=>m?recordEvent(m,{kind:'mood-check',detail:'你关心我现在的心情，我用真实的状态回应了你。'}):m)
    return petSpeech(saved,response.line);
  }
  function watchButterfly(invited=false){
    if(document.hidden||!petRef.current||petRef.current.sleeping||Date.now()<careUntil.current||Date.now()<dizzyUntil.current)return false;
    animate('watch-butterfly');speak('看我的小网！……哎呀，它又绕回来逗我啦。',10000);
    setMemory(m=>m?recordEvent(m,{kind:'play',detail:invited?'你回应我的小邀请，陪我挥着小网，和蝴蝶玩了一会儿。':'你陪我挥着小网，和蝴蝶玩了一会儿。'}):m);
    return true;
  }
  function clearInvitation(){ invitationRef.current=null;setInvitation(null); }
  function presentInvitation(offer:CompanionInvitation){
    const saved=petRef.current;if(document.hidden||!saved||saved.sleeping)return;
    const next={petId:saved.createdAt,at:Date.now(),offer};invitationRef.current=next;setInvitation(next);speak(offer.text,14000);
  }
  function suggestTogether(){
    const saved=petRef.current;if(document.hidden||!saved||interactionBusy)return;
    const offer=createInvitation(saved,currentMemory,suggestionSequence.current++);
    if(offer)presentInvitation(offer);else speak('现在先让我缓一缓，等有精神了再一起玩。');
  }
  function acceptInvitation(){
    const pending=invitationRef.current,saved=petRef.current;
    if(document.hidden||!pending||!saved||pending.petId!==saved.createdAt||Date.now()-pending.at>=5*60000||interactionBusy)return;
    clearInvitation();
    if(pending.offer.kind==='butterfly')watchButterfly(true);
    else if(pending.offer.kind==='ball')doCare('play',undefined,'你回应我的小邀请，我们一起玩了一会儿小球。');
    else doCare('pet',undefined,'你答应我的小邀请，轻轻摸了摸我。');
  }
  function deferInvitation(){
    const pending=invitationRef.current,saved=petRef.current;
    if(document.hidden||!pending||!saved||pending.petId!==saved.createdAt||Date.now()-pending.at>=5*60000)return;clearInvitation();ambient.current=null;
    setMemory(m=>m?recordEvent(m,{kind:'companion-pause',detail:'你说先忙30分钟，我答应安静陪着。'}):m);
    speak('好呀，先忙你的。这30分钟我安静陪着，想玩时再叫我。');
  }
  function resumeCompanion(){
    if(document.hidden)return;
    setMemory(m=>m?recordEvent(m,{kind:'companion-resume',detail:'你说可以恢复主动陪伴了。'}):m);
    speak('好呀，我还是按原来的节奏陪着你。');
  }
  function callPetName(){
    const saved=petRef.current;if(document.hidden||!saved||interactionBusy||Date.now()<nameCallUntil.current)return;
    nameCallUntil.current=Date.now()+1200;
    const response=nameResponse(saved,currentMemory,nameSequence.current++);
    animate(response.action);speak(response.text,8500);playPetVoice('pet',prefs.sound);
    setMemory(m=>m?recordEvent(m,{kind:'call-name',detail:`你轻轻叫了我${saved.name}，我回应了你。`}):m);
  }
  function respondToBubble() {
    const offer=invitationRef.current;
    if(offer&&offer.petId===current.createdAt&&Date.now()-offer.at<5*60000&&bubble===offer.offer.text){void openPanel('play');return;}
    setBubbleVisible(false);
  }
  useDesktopPetStatus(pet);
  useEffect(()=>{
    // Idle bodies keep their compact frame. A costume or active original
    // action can publish a larger drawing surface without changing body size.
    const bounds=petMode&&!workingAway?drawingUnion([...(nativeDrawingBounds?[nativeDrawingBounds]:[]),...(current.wearing&&!reading?[{x:-100,y:-80,width:360,height:420}]:[])]):null;
    void window.desktop?.setPetArtworkBounds?.(bounds).catch(()=>{});
  },[petMode,current.wearing,reading,workingAway,nativeDrawingBounds]);
  const normalizedEffectAction=normalizeRamAction(action,stage);
  const effectId=normalizedEffectAction.startsWith('element-')?normalizedEffectAction.slice(8):null;
  const actualForm=ramForm(stage,current.evolution);
  const adaptedAmbient=usesAmbientAdaptation(actualForm,action,Boolean(current.wearing));
  const importedEffect=adaptedAmbient||usesAmbientFootballFrames(actualForm,action)?undefined:uploadedMotion(actionAppearance.form,action,actionItemId);
  useEffect(()=>{
    const rect=petMode?(importedEffect?frameClipRect(importedEffect,actionAppearance.form):effectId?elementEffectRect(effectId,actionAppearance.form):null):null;
    const bounds=petMode&&workingAway?DESKTOP_WORK_BOUNDS:rect?drawingUnion([{...rect,x:rect.x+30,y:rect.y+71},...(nativeDrawingBounds?[nativeDrawingBounds]:[])]):null;
    void window.desktop?.setPetEffectBounds?.(bounds).catch(()=>{});
  },[effectId,importedEffect,petMode,actionAppearance.form,workingAway,nativeDrawingBounds]);
  useEffect(()=>{if(hasPet)void window.desktop?.setPetAppearance(actionAppearance.form);},[hasPet,actionAppearance.form]);
  useEffect(() => { void window.desktop?.setPetCanMove(hasPet && stage > 0 && !reading && !pet?.sleeping && !pet?.outing && !pet?.activity); }, [hasPet,pet?.sleeping,pet?.outing,pet?.activity,stage,reading]);
  useEffect(()=>{
    const before=previousRest.current;previousRest.current=pet?{petId:pet.createdAt,sleeping:pet.sleeping}:null;
    if(!pet||before?.petId!==pet.createdAt||before.sleeping===pet.sleeping)return;
    if(!pet.sleeping&&(pet.awakeUntil??0)>Date.now())return; // Manual wake already records its actual care event.
    const text=pet.sleeping?'有点困啦，我闭上眼睡一会儿，想我时可以轻轻叫醒。':'睡饱啦，我又有精神陪你了。';
    if(!timer.running){speak(text);playPetVoice(pet.sleeping?'sleep':'wake',prefs.sound);}
    setMemory(m=>m?recordEvent(m,{kind:pet.sleeping?'auto-sleep':'auto-wake',detail:pet.sleeping?'我困了，自己闭上眼休息。':'我恢复了精力，自然醒来。'}):m);
  },[pet?.createdAt,pet?.sleeping,prefs.sound,timer.running,speak]);

  function finishCareFeedback(){
    const receipt=pendingCareFeedback.current;pendingCareFeedback.current=null;
    if(!receipt||petRef.current?.createdAt!==receipt.petId||!receipt.gains.length)return;
    clearTimeout(timers.current.feedback);setBubbleVisible(false);setCareFeedback(receipt);
    timers.current.feedback=setTimeout(()=>setCareFeedback(null),2300);
  }
  function tugReaction(){
    if(!petRef.current||petRef.current.sleeping||Date.now()-lastTug.current<6000)return;
    lastTug.current=Date.now();
    playPetVoice('lift',prefs.sound);
    if(prefs.presence){const lines=['花盆也要带好，哼……再抱一小会儿。','才、才不是想让你抱呢。轻一点嘛。','叶子要乱啦！……放下以后还要陪我哦。','我自己会飞的……不过让你抱一会儿也行。','嘿，我可是会魔法的！……好吧，再抱一下。'];speak(lines[stage],4500)}
  }
  function animate(next: string, itemId?: string, fromColor?: PetColor, feedback?:CareFeedbackData) {
    if(!isPastime(next))pastimeRun.current=null;
    if(!isUploadedAction(next))uploadedRun.current=null;
    const motion = itemId ? getItemMotion(itemId) : null;
    const p=petRef.current;
    const stage=p?getStage(p.growth,p.evolution):0;
    const form=p?petActionAppearance(p,next,itemId).form:'seed';
    const outfit=p?costumePlayback(stage,p.evolution,p.wearing):undefined;
    const actualForm=outfit?.actualForm??'seed';
    const adaptedAmbient=usesAmbientAdaptation(actualForm,next,Boolean(outfit?.clip));
    const football=!adaptedAmbient&&usesAmbientFootballFrames(actualForm,next)?footballDuration(actualForm):undefined;
    const adapted=outfit?.clip||adaptedAmbient?costumeAction(normalizeRamAction(motion?.action??next,stage),adaptedAmbient?actualForm:form,itemId):undefined;
    const original=adaptedAmbient||football?undefined:uploadedMotion(form,next,itemId);
    const recorded=dailyFrameSpec(form,next);
    const embeddedItem=p&&itemId?originalCareClip(actualForm,next,itemId)??originalItemClip(itemId,form):undefined;
    const duration = original?.durationMs ?? adapted?.duration ?? football ?? (isOfficialAction(next)||embeddedItem?OFFICIAL_DURATION:undefined) ?? (recorded&&!['focus','sleep','read-alone'].includes(next)?recorded.durationMs:undefined) ?? motion?.duration ?? getRamActionDuration(next.startsWith('ambient-element-')?next.slice(8):next,form) ?? 900;
    setActionId(n => n + 1); setActionFromColor(fromColor); setActionItemId(itemId); setAction(motion?.action ?? next);
    careUntil.current = itemId ? Date.now() + duration + 50 : 0;
    if(feedback?.gains.length){pendingCareFeedback.current=mergeCareFeedback(pendingCareFeedback.current,feedback);clearTimeout(timers.current.feedback);setCareFeedback(null);}
    else if(!itemId)finishCareFeedback();
    const hasPlayer=isOfficialAction(next)||isAmbientAction(next)||isPastime(next)||isSchoolAction(next)||
      getRamActionDuration(next,form)!==null||Boolean(motion||embeddedItem||original||recorded||football||outfit?.clip);
    clearTimeout(timers.current.animation);
    if(next==='idle'||next==='sleep')return;
    // Only visual completion records a successful performance. Keep a
    // separate recovery budget for a renderer that disappeared or got stuck.
    let timeLeft=hasPlayer?240000:duration,checked=performance.now();
    const recover=()=>{
      const now=performance.now();
      if(isPlaybackVisible())timeLeft-=Math.min(now-checked,1000);
      checked=now;
      if(timeLeft>0){timers.current.animation=setTimeout(recover,Math.min(1000,timeLeft));return;}
      uploadedRun.current=null;pastimeRun.current=null;careUntil.current=0;finishCareFeedback();
      setAction('idle');setActionItemId(undefined);setActionFromColor(undefined);
    };
    timers.current.animation=setTimeout(recover,Math.min(1000,timeLeft));
  }
  function finishPerformance(completed=true){if(action==='dizzy'||getRamActionDuration(action,petActionAppearance(current,action).form)!==null||isAmbientAction(action)||isOfficialAction(action)||action==='play'||action==='pet'||isMoodAction(action)||isPastime(action)||isSchoolAction(action)||isUploadedAction(action)||Boolean(actionItemId)||Boolean(dailyFrameSpec(petActionAppearance(current,action).form,action))){finishUploaded(completed);if(completed)finishPastime();else pastimeRun.current=null;finishCareFeedback();clearTimeout(timers.current.animation);setAction('idle');setActionItemId(undefined);setActionFromColor(undefined);careUntil.current=0}}
  function apply(result: Result, nextAction?: string, detail?: string, itemId?: string) {
    const before = petRef.current;
    if(result.ok&&before&&before.color!==result.state.color){
      // Commit the new permanent colour before consuming the potion visually.
      // A failed disk write leaves both the previous colour and inventory intact.
      try{localStorage.setItem(SAVE_KEY,JSON.stringify(result.state));setSaveError(false)}
      catch{setSaveError(true);notify('颜色未保存，药水已保留。请先备份存档并检查存储空间。');return false}
      void window.desktop?.flushSave?.().catch(()=>{setSaveError(true);notify('颜色已在本机记录，请到小屋备份存档。')});
    }
    petRef.current = result.state; setPet(result.state,result.message);
    if(nextAction==='buy'&&result.ok)setToast('');
    else{notify(result.message);speak(result.message);}
    if (result.ok) {
      if (nextAction) { if (nextAction !== 'buy' || Date.now() >= careUntil.current) { animate(nextAction, itemId, before?.color !== result.state.color ? before?.color : undefined, before&&itemId?{id:Date.now(),petId:result.state.createdAt,gains:careGains(before,result.state,itemId)}:undefined); if(nextAction==='buy'||nextAction==='reward')playGameSound(nextAction==='buy'?'purchase':'reward',prefs.gameSound);else if(nextAction==='wake'||nextAction==='sleep')playPetVoice(nextAction,prefs.sound); } setMemory(m => m ? recordCare(m, nextAction === 'reward' ? 'game' : nextAction, detail) : m); }
      if (before && getStage(before.growth, before.evolution) < getStage(result.state.growth, result.state.evolution)) { speak(`${result.state.name}长大啦！现在是${STAGES[getStage(result.state.growth, result.state.evolution)].name}！`, 10000); setMemory(m => m ? recordEvent(m, { kind: 'growth', detail: `我长成了${STAGES[getStage(result.state.growth, result.state.evolution)].name}。` }) : m); }
    }
    return result.ok;
  }
  function showDizzy() {
    if (petRef.current?.sleeping || Date.now() < dizzyUntil.current || Date.now() < careUntil.current) return;
    dizzyUntil.current = Date.now() + 3200; touches.current = [];
    animate('dizzy'); speak('晕乎乎的……让我缓一缓，轻轻摸就好啦。', 4500); playPetVoice('shake', prefs.sound);
  }
  function doCare(type: Action, itemId?: string, invitationDetail?:string) {
    preparePetSound(prefs.sound);
    if(petRef.current?.outing)recallPet();
    if(!itemId&&type!=='sleep'&&Date.now()<careUntil.current&&!(type==='wash'&&!itemId))return;
    if (['pet','play'].includes(type) && Date.now() < dizzyUntil.current) return;
    if (type === 'pet' && !petRef.current?.sleeping) {
      const now=Date.now(); touches.current=[...touches.current.filter(at=>now-at<1800),now];
      if (touches.current.length>=5) { showDizzy(); return; }
    }
    if (type === 'wash' && !itemId) { setPocketCategory('clean'); void openPanel('food'); return; }
    const saved = petRef.current; if (!saved) return;
    if(saved.activity&&type!=='sleep'){notify('先结束这一节课或工作，再来互动吧。');return;}
    if(type==='sleep')previousActivity.current=undefined;
    if (!itemId && type !== 'sleep' && Date.now() < careUntil.current) return;
    const item = getItem(itemId), next = type === 'sleep' && saved.sleeping ? 'wake' : type;
    const form=petActionAppearance(saved,next,itemId).form;
    if(item?.category==='toy'&&!originalItemClip(item.id,form)){notify('这件玩具暂无当前形态的原版动作，先留在背包里；可以试试看书、玩球或已学会的本领。');return false;}
    const detail = invitationDetail ?? (item ? `你用${item.name}照料了我。` : type === 'sleep' ? saved.sleeping ? '你轻轻叫醒了我。' : '你让我安心睡了一觉。' : undefined);
    const result=care(saved, type, itemId, Date.now());
    if(result.ok){clearInvitation();if(type==='sleep')previousRest.current={petId:result.state.createdAt,sleeping:result.state.sleeping};}
    const applied=apply(result, next, detail, itemId);
    if(applied&&(uploadedMotion(form,next,itemId)||originalCareClip(form,next,itemId)||originalItemClip(itemId,form))){setPanel(null);setBubbleVisible(false)}
    return applied;
  }
  function chooseGrowth(selection:GrowthSelection) {
    const saved = petRef.current; if (!saved) return;
    const result = configureGrowth(saved, selection);
    const appearanceChanged=selection.stage!==getStage(saved.growth,saved.evolution)||(selection.stage===4&&(selection.evolution??saved.evolution)!==saved.evolution);
    if (!result.ok || result.state === saved) { notify(result.message); return; }
    if(appearanceChanged){
    pastimeRun.current=null;result.state=cancelActivity(result.state);previousActivity.current=undefined;
    if(saved.outing){result.state=finishOuting(result.state);setMemory(m=>m?recordEvent(m,{kind:'outing-recall',detail:'你调整了我的成长形态，我先回到你身边。'}):m)}
    clearInvitation();clearTimeout(timers.current.animation); careUntil.current = 0; dizzyUntil.current = 0; touches.current = [];
    pendingCareFeedback.current=null;setCareFeedback(null);clearTimeout(timers.current.feedback);setActionItemId(undefined);setActionFromColor(undefined);setAction('idle');setStudy(null);setActionId(n => n + 1);
    }
    petRef.current = result.state; setPet(result.state,result.message); notify(result.message); speak(result.message);
    setMemory(m => m ? recordEvent(m, { kind: appearanceChanged?'stage-choice':'growth-mode', detail: `你在设置里选择了${selection.mode==='auto'?'自动成长':'固定形态'}，当前为${result.state.evolution ? EVOLUTIONS.find(v => v.id === result.state.evolution)!.name : STAGES[getStage(result.state.growth,result.state.evolution)].name}。` }) : m);
  }
  function changeOutfit(kind:'buy'|'wear',id?:string){
    const saved=petRef.current;if(!saved||(kind==='buy'&&floating))return
    const result=kind==='buy'?buyOutfit(saved,id??''):wearOutfit(saved,id)
    clearInvitation();apply(result)
    if(result.ok){
      if(kind==='buy')playGameSound('purchase',prefs.gameSound)
      else if(!saved.sleeping&&!timer.running&&!saved.activity){
        clearTimeout(timers.current.animation);careUntil.current=0;dizzyUntil.current=0;
        setAction('idle');setActionItemId(undefined);setActionFromColor(undefined);setActionId(n=>n+1);
      }
      setMemory(m=>m?recordEvent(m,{kind:kind==='buy'?'buy':'dress',detail:kind==='buy'?`你为我买了${getOutfit(id)?.name}。`:id?`你给我戴上了${getOutfit(id)?.name}。`:'你把我的装扮收好，让我恢复原来的样子。'}):m)
    }
  }
  function renamePet(nextName:string) {
    const saved=petRef.current;if(!saved)return;
    const value=Array.from(nextName.replace(/[\u0000-\u001f\u007f]/g,'').trim()).slice(0,16).join('');
    if(!value||value===saved.name)return;
    const updated={...saved,name:value};petRef.current=updated;setPet(updated);setName(value);
    setMemory(m=>m?recordEvent(m,{kind:'rename',detail:`你给我起了新名字：${value}。`}):m);
    speak(`记住啦，我叫${value}，还是一直陪着你的我。`);
  }
  function buy(id: string) { if (floating) { notify('到小屋商店挑选用品吧。'); return; } if (petRef.current) apply(buyItem(petRef.current, id), 'buy', `你为我买了${getItem(id)?.name ?? '用品'}。`); }
  function adopt(e: FormEvent) { e.preventDefault(); if (!name.trim()) return; importSequence.current++;setSaveFeedback(null);const adopted = placeFurniture(createPet(name.trim().slice(0, 12), color),MUSIC_BOX_ID,74,66); awaitingAdoption.current = false; setWaitingForReopen(false); setPet(adopted); setMemory(recordEvent(createMemory(adopted), { kind: 'adoption', detail: '你把我接回了家，我们开始一起生活。' })); if (!startInRoom&&!window.desktop&&!webEdition) setPreview(true); speak('从今天起，我就是你的小拉姆啦。请多关照！', 10000); }
  function beginWorkViewSwitch(targetMode:boolean){
    if(window.mobile&&petRef.current?.activity?.kind==='restaurant'){workPresence.current.beginViewSwitch(targetMode);workHeartbeat.current=Date.now()}
  }
  async function toDesktop() {
    try{await roomScreen.exit()}catch{notify('退出全屏失败，请重试。');return;}
    setPanel(null);setGame(null);beginWorkViewSwitch(true);
    const desktop=window.desktop;
    if(!desktop){setPreview(true);return;}
    try{
      await desktop.setCompanionPanel(false);
      await desktop.setPetEffectBounds?.(null);
      await desktop.setPetArtworkBounds?.(null);
      await desktop.setPetMode(true);
    }catch(error){
      workPresence.current.endViewSwitch();
      notify(window.mobile&&error instanceof Error?error.message:'窗口切换失败，请稍后再试。');
    }
  }
  function updateNotes(notes:PetNote[]){
    const saved=petRef.current;if(!saved)return false;
    const next={...saved,notes:normalizeNotes(notes)};
    try{localStorage.setItem(SAVE_KEY,JSON.stringify(next))}catch{setSaveError(true);notify('留言未保存，请先检查存储空间。');return false}
    petRef.current=next;setPet(next);setSaveError(false);void window.desktop?.flushSave?.().catch(()=>setSaveError(true));return true;
  }
  function openBoard(){if(petRef.current)void openPanel('notes');}
  async function openPanel(next: Panel) { if (floating && next && ['shop','games','growth','settings','decor','wardrobe','memories','school'].includes(next)) { await enterHome(next); return; } if (next === 'food'||next === 'status') setPocketVisit(v => v + 1); setPanel(next); if (petMode) { try { await window.desktop?.setCompanionPanel(next !== null, 'compact'); } catch { notify('小窗暂时无法打开，请再试一次。'); } } }
  async function enterHome(next: Panel = null) { setPanel(next); setGame(null); setPreview(false);beginWorkViewSwitch(false);try{await window.desktop?.setCompanionPanel(false); await window.desktop?.setPetEffectBounds?.(null); await window.desktop?.setPetArtworkBounds?.(null); await window.desktop?.setPetMode(false)}catch(error){workPresence.current.endViewSwitch();throw error} }
  function startTimer() {
    if (!prefs.reminders) return;
    if(petRef.current?.activity){notify('先结束当前课程或工作吧。');return;}
    if(petRef.current?.outing)recallPet();
    clearInvitation();
    dismountFurniture();
    setStudy(null);
    prepareReminderSound(); timer.start();
    notify(`开始专注，${prefs.reminderMinutes} 分钟后提醒。`);
  }
  function focusToggle() {
    if(!timer.running){startTimer();return;}
    timer.cancel();
    setStudy(null);
    clearTimeout(timers.current.toast);
    setToast('');
    if(action==='idle'&&!current.sleeping&&!current.activity&&!current.outing)animate('waving');
    speak('好，先歇一歇。我回来陪你啦！');
  }
  async function setDesktopWandering(wandering: boolean) { if (!window.desktop) { speak('在桌面应用里，我就可以在你的桌面走来走去啦。'); return; } try { await window.desktop.wander(wandering); } catch { notify('暂时无法切换走动状态。'); } }
  function startGame(kind: GameKind) {
    if(petRef.current?.activity){notify('先结束当前课程或工作吧。');return;}
    if (floating) { void enterHome('games'); return; }
    if (petRef.current?.sleeping) { notify('先轻轻叫醒拉姆吧。'); return; }
    setGame(kind);
  }
  async function abandonPet() {
    const saved = petRef.current; if (!saved) return;
    importSequence.current++;setSaveFeedback(null);
    clearInvitation();awaitingAdoption.current = true; petRef.current = null; touches.current = []; dizzyUntil.current = 0;
    try { await window.desktop?.localSaves?.forget(saved.createdAt);localStorage.removeItem(SAVE_KEY); localStorage.removeItem(memoryKey(saved)); localStorage.removeItem(presenceKey(saved)); localStorage.removeItem(greetingKey(saved)); }
    catch { awaitingAdoption.current = false; petRef.current = saved; notify('暂时无法移除存档，请稍后重试。'); return; }
    pendingCareFeedback.current=null;setCareFeedback(null);clearTimeout(timers.current.feedback);setPet(null); setMemory(null); setReset(false); setPanel(null); setGame(null); timer.cancel(); setPreview(false); setName('小拉姆'); setAdoptionStep('color'); setWaitingForReopen(true); setAction('idle'); setActionItemId(undefined);setActionFromColor(undefined); careUntil.current = 0;
    clearTimeout(timers.current.animation); clearTimeout(timers.current.bubble); setBubbleVisible(false); setToast('');
    window.desktop?.readyToShow(false); window.desktop?.hideToTray();
    await window.desktop?.setPetCanMove(false); await window.desktop?.setCompanionPanel(false); await window.desktop?.setPetMode(false);
    // Pending old renders cannot write through the guards above. This final
    // removal also covers a tick that was already queued before the farewell.
    try { localStorage.removeItem(SAVE_KEY); localStorage.removeItem(memoryKey(saved)); localStorage.removeItem(presenceKey(saved)); localStorage.removeItem(greetingKey(saved)); } catch { /* Initial removal succeeded. */ }
    window.desktop?.hideToTray();
  }
  async function exportSave(raw=false) {
    setSaveFeedback({kind:'pending',message:'正在准备导出存档…'});
    try{
      const saved=petRef.current;
      if(!raw&&!saved)throw Error();
      const text=raw?localStorage.getItem(SAVE_KEY):petBackupText(saved!,currentMemory,localStorage);
      if(text===null)throw Error();
      const filename=raw?'ramu-recovery.json':`ramu-${new Date().toISOString().slice(0,19).replaceAll(':','-')}.json`;
      if(window.mobile){
        const ok=await window.mobile.exportSave(text,filename);
        setSaveFeedback(ok?{kind:'success',message:`存档已经导出：${filename}，记得收好。`}:{kind:'info',message:'已取消导出，当前存档未更改。'});
      }else{
        const url=URL.createObjectURL(new Blob([text],{type:'application/json'}));
        try{const a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove()}
        finally{setTimeout(()=>URL.revokeObjectURL(url),1000)}
        setSaveFeedback({kind:'success',message:`已发起存档下载：${filename}。请在浏览器下载记录中确认文件已保存。`});
      }
    }catch(error){setSaveFeedback(error instanceof Error&&error.message==='已取消导出'?{kind:'info',message:'已取消导出，当前存档未更改。'}:{kind:'error',message:'存档导出失败，请检查保存位置和存储空间后重试，当前存档仍然保留。'})}
  }
  async function importSave(source:SaveImport):Promise<boolean> {
    const file='file' in source?source.file:undefined;
    const sequence=++importSequence.current,originalPetId=petRef.current?.createdAt;
    let step:'read'|'backup'|'restore'='read';
    setSaveFeedback({kind:'pending',message:'正在读取、校验并导入存档，请稍候…'});
    try {
      if (file&&file.size > MAX_BACKUP_BYTES) throw new InvalidPetBackup('size');
      const text='text' in source?source.text:await source.file.text();
      if(sequence!==importSequence.current||petRef.current?.createdAt!==originalPetId)return false;
      validatePetBackup(text);
      step='backup';
      const before=diskSnapshot.current();
      if(before){if(window.desktop?.localSaves)await window.desktop.localSaves.checkpoint(before,'before-import');else localStorage.setItem(`ramu-before-import-v1:${Date.now()}`,before)}
      else{const raw=localStorage.getItem(SAVE_KEY);if(raw!==null)localStorage.setItem(`ramu-before-import-v1:${Date.now()}`,raw)}
      if(sequence!==importSequence.current||petRef.current?.createdAt!==originalPetId)return false;
      step='restore';
      const {pet:restored,memory:restoredMemory}=restorePetBackup(text,localStorage);
      clearInvitation();clearTimeout(timers.current.animation); clearTimeout(timers.current.feedback);
      careUntil.current = 0; touches.current = []; dizzyUntil.current = 0;
      pendingCareFeedback.current=null;setCareFeedback(null); setActionItemId(undefined); setActionFromColor(undefined);
      setAction('idle'); setActionId(n => n + 1); timer.cancel();
      awaitingAdoption.current=false;petRef.current = restored; setPetRaw(restored);
      setMemory(restoredMemory);
      setPrefs(readPrefs());window.dispatchEvent(new Event('ram-save-imported'));
      setUnreadableSave(false);setName(restored.name);
      setSaveFeedback({kind:'success',message:`存档已恢复，欢迎回来！已导入「${restored.name}」的记录。`});
      return true;
    } catch(error) {
      if(sequence!==importSequence.current||petRef.current?.createdAt!==originalPetId)return false;
      const reason=error instanceof InvalidPetBackup?(error.reason==='size'?'文件超过 1 MB，无法导入。':'这个存档无法读取，请选择有效的拉姆 JSON 备份。'):step==='read'?'未能读取所选文件，请确认文件已下载到本机后重试。':step==='backup'?'导入前备份失败，请检查存储空间后重试。':'存档写入失败，请检查存储空间或应用权限后重试。';
      setSaveFeedback({kind:'error',message:`${reason}${originalPetId?'原来的拉姆仍然保留。':'当前记录未更改。'}`});
      return false;
    }
  }

  function completeGame(score: number,round?:import('./economy').RewardRound): GameReceipt {
    const now = Date.now(), saved = petRef.current;
    if (!saved) return { ok: false, coins: 0, growth: 0, food: 0, message: '当前没有可领取奖励的拉姆。' };
    const safeScore = Number.isFinite(score) ? Math.floor(Math.max(0,Math.min(10,score))) : 0;
    const before = tick(saved, now), result = rewardGame(before, safeScore, now,Math.random,round);
    const food = result.rewardItem;
    apply(result, 'reward', `我们一起在${roomMedia.background.label}完成了《${game ? GAME_LABELS[game] : '小屋游戏'}》，得到${safeScore}分，收获${result.state.coins-before.coins}摩尔豆。`);
    if(result.ok)gameFeedback.current=mergeCareFeedback(gameFeedback.current,{id:now,petId:before.createdAt,gains:gameGains(before,result.state)});
    return { ok: result.ok, coins: result.state.coins - before.coins, growth: Math.round((result.state.growth - before.growth) * 100) / 100,
      food: food ? (result.state.inventory[food.id] ?? 0) - (before.inventory[food.id] ?? 0) : 0, itemId:food?.id,prize:result.prize,baseCoins:result.baseCoins,bonusCoins:result.bonusCoins,message: result.message };
  }

  useEffect(()=>{
    if(game!==null||!gameFeedback.current)return;
    const receipt=gameFeedback.current;gameFeedback.current=null;
    if(receipt.petId!==petRef.current?.createdAt||!receipt.gains.length)return;
    clearTimeout(timers.current.feedback);setBubbleVisible(false);setCareFeedback(receipt);
    timers.current.feedback=setTimeout(()=>setCareFeedback(null),2300);
  },[game]);

  const mood = getCompanionMood(currentMemory, current);
  const habits=getPetHabits(currentMemory);
  const habitText=habits.food&&habits.food.count>1?`最近熟悉的味道：${habits.food.name}`:habits.drink&&habits.drink.count>1?`最近熟悉的味道：${habits.drink.name}`:habits.play&&habits.play.count>1?`最近的小默契：${habits.play.name}`:undefined;
  const playInvitation=<PetInvitation invitation={openInvitation?{...openInvitation,text:petSpeech(current,openInvitation.text)}:null} busy={interactionBusy} petName={current.name} habitText={habitText} snoozed={snoozed} onAccept={acceptInvitation} onDefer={deferInvitation} onSuggest={suggestTogether} onCallName={callPetName} onResume={resumeCompanion}/>;
  const visitShop = () => { setShopCategory(pocketCategory);void enterHome('shop'); };
  const visitToyShop=()=>{setShopCategory('toy');void enterHome('shop')};
  const pocket=<CarePocket pet={current} initialCategory={pocketCategory} visit={pocketVisit} compact={floating} onCare={doCare} onVisitShop={visitShop} busyItemId={actionItemId} onClose={floating?()=>void openPanel(null):undefined}/>;
  useEffect(()=>{window.desktop?.updates?.setBusy((!window.mobile&&(!pet||!floating))||panel==='food'||panel==='status'||panel==='play'||game!==null||timer.running||Boolean(pet?.activity)||action!=='idle'||saveError||memorySaveError)},[pet?.createdAt,floating,panel,game,timer.running,pet?.activity,action,saveError,memorySaveError]);
  const settingsContent = <SettingsPanel>
    <SettingsSection title="拉姆信息"><form className="settings-identity" onSubmit={e=>{e.preventDefault();renamePet(name)}}><label htmlFor="rename">拉姆的名字</label><input id="rename" aria-label="拉姆的新名字" value={name} maxLength={16} onChange={e=>setName(e.target.value)}/><button className="game-button small" disabled={!name.trim()}>保存</button></form></SettingsSection>
    <SettingsSection title={webEdition?"陪伴与小屋":"陪伴与桌面"}>
      <LaunchAtLoginSetting/>
      {!webEdition&&window.desktop?.platform !== 'android'&&<div className="settings-row"><span>桌面拉姆大小 · {Math.round((desktopState.petScale??1)*100)}%</span><button className="game-button small" onClick={()=>void window.desktop?.openSizeEditor?.().catch(()=>notify('暂时无法打开大小设置，请重试。'))}>大小变换</button></div>}
      {!webEdition&&<>
        <SettingsSwitch label="桌面散步" checked={desktopState.wandering} disabled={!window.desktop} onChange={wandering=>void setDesktopWandering(wandering)}/>
        <SettingsSwitch label="角落躲藏" checked={desktopState.edgeHiding} disabled={!window.desktop} onChange={enabled=>void window.desktop?.setEdgeHiding(enabled)}/>
      </>}
      <SettingsSwitch label="小屋随机走动" checked={prefs.roomWander} onChange={roomWander=>setPrefs(p=>({...p,roomWander}))}/>
      <SettingsSwitch label="自然小动作" checked={prefs.lively} onChange={lively=>setPrefs(p=>({...p,lively}))}/>
      <IdleIntervalSetting seconds={prefs.idleIntervalSeconds} onChange={seconds=>setPrefs(p=>({...p,idleIntervalSeconds:seconds}))}/>
      <SettingsSwitch label="随机魔法动作" checked={magicLearned&&prefs.randomMagic} disabled={!magicLearned} onChange={randomMagic=>setPrefs(p=>({...p,randomMagic}))}/>
      {!magicLearned&&<p className="settings-hint">学会魔法后可开启。</p>}
      <SettingsSwitch label="允许短暂出游" checked={prefs.outings} onChange={outings=>setPrefs(p=>({...p,outings}))}/>
      <SettingsSwitch label="主动陪伴" checked={prefs.presence} onChange={presence=>setPrefs(p=>({...p,presence}))}/>
      <label className="settings-row"><span>提示频率</span><select aria-label="主动陪伴频率" value={prefs.presenceMinutes} onChange={e=>setPrefs(p=>({...p,presenceMinutes:Number(e.target.value)}))}><option value={10}>约10分钟</option><option value={20}>约20分钟</option><option value={40}>约40分钟</option></select></label>
    </SettingsSection>
    <SettingsSection title="音效">
      <SettingsSwitch label="互动音效" checked={prefs.sound} onChange={sound=>setPrefs(p=>({...p,sound}))}/>
      <SettingsSwitch label="游戏音效" checked={prefs.gameSound} onChange={gameSound=>setPrefs(p=>({...p,gameSound}))}/>
      <label className="settings-row"><span>拉姆音量</span><input type="range" min={0} max={100} step={1} aria-label="拉姆音量" value={Math.round(prefs.soundVolume*100)} onChange={e=>setPrefs(p=>({...p,soundVolume:Number(e.target.value)/100}))}/></label>
      <div className="effect-previews" aria-label="互动音效试听">{([['smack','吃东西'],['gulp','喝水'],['clean','洗干净'],['sparkle','眼前一亮'],['boing','蹦跳']] as const).map(([kind,label])=><button className="game-button small" key={kind} disabled={!prefs.sound||prefs.soundVolume===0} onClick={()=>playInteractionPreview(kind,true)} aria-label={`试听${label}音效`}>{label}</button>)}</div>
    </SettingsSection>
    <SettingsSection title="专注计时">
      <SettingsSwitch label="启用专注计时" ariaLabel="休息与喝水提醒" checked={prefs.reminders} onChange={reminders=>setPrefs(p=>({...p,reminders}))}/>
      <label className="settings-row"><span>计时方向</span><select aria-label="计时方向" value={prefs.timerDirection} onChange={e=>setPrefs(p=>({...p,timerDirection:e.target.value as TimerDirection}))}><option value="countdown">倒数计时</option><option value="countup">正向计时</option></select></label>
      <label className="settings-row"><span>计时时长</span><span className="reminder-interval"><input type="number" min={1} max={240} step={1} aria-label="提醒间隔" defaultValue={prefs.reminderMinutes} onBlur={e=>{if(validReminderMinutes(e.target.valueAsNumber)!==e.target.valueAsNumber)e.target.value=String(prefs.reminderMinutes)}} onChange={e=>{const minutes=e.target.valueAsNumber;if(Number.isInteger(minutes)&&minutes>=1&&minutes<=240)setPrefs(p=>({...p,reminderMinutes:minutes}))}}/> 分钟</span></label>
      <SettingsSwitch label="结束提示音" ariaLabel="计时结束提示音" checked={prefs.reminderSound} onChange={reminderSound=>setPrefs(p=>({...p,reminderSound}))}/>
      <div className="timer-settings-actions"><button className="game-button small" disabled={!prefs.reminders} onClick={focusToggle}>{timer.running?'取消计时':'开始计时'}</button>{(timer.running||timer.finished)&&<span>{timer.running?reminderTime(timer.seconds):'已结束'}</span>}</div>
    </SettingsSection>
    {webEdition&&<SettingsSection title="网页版与离线使用"><WebAppHelp/></SettingsSection>}
    <AndroidSettings/>
    <SettingsSection title="动画与素材"><AnimationDiagnostics/></SettingsSection>
    {books.downloads&&<SettingsSection title="图书素材"><BookResourceSettings downloads={books.downloads} status={books.status} unavailable={books.unavailable}/></SettingsSection>}
    <SettingsSection title="存档与送别"><SaveManager onImport={importSave} onExport={()=>exportSave()} feedback={saveFeedback} onFeedback={setSaveFeedback}/><button type="button" className="plain-danger" onClick={()=>setReset(true)}>送别拉姆</button>{memorySaveError&&<p role="alert">回忆暂未保存，请导出备份。</p>}{backupError&&<p role="alert">独立备份暂时写入失败，请检查磁盘空间并导出存档；原来的浏览器存档仍保留。</p>}</SettingsSection>
    {window.desktop&&<SettingsSection title="软件与帮助"><UpdateSettings/><MacHelp/></SettingsSection>}
  </SettingsPanel>;
  const closeGame=()=>setGame(null);
  const gameOverlay=game&&<DeferredView key={game} onClose={closeGame}>
    {game==='restaurant'&&<RestaurantWorkShowcase pet={current} onClose={closeGame} onStart={()=>startActivity('restaurant')} onStop={stopActivity}/>}
    {game!=='restaurant'&&<GameSoundToggle game={game} enabled={prefs.gameSound} onToggle={()=>setPrefs(p=>({...p,gameSound:!p.gameSound}))}/>}
    {game==='color-mixer'&&<ColorMixerGame pet={current} sound={prefs.gameSound} onBrew={color=>{
      const saved=petRef.current;if(!saved)return {ok:false,message:'先领养一只拉姆吧。'};
      const result=brewColourPotion(saved,color);apply(result);
      if(result.ok)setMemory(m=>m?recordEvent(m,{kind:'craft-potion',detail:`你调制了${color.toUpperCase()}颜色的药水，装进了背包。`}):m);
      return result;
    }} onClose={closeGame} onBackpack={()=>{closeGame();setPocketCategory('medicine');setPanel('food')}}/>}
    {game==='fruit'&&<FruitGame costume={current.wearing} sound={prefs.gameSound} color={current.color} stage={stage} evolution={current.evolution} onClose={closeGame} onComplete={completeGame}/>}
    {game==='memory'&&<MemoryGame sound={prefs.gameSound} onClose={closeGame} onComplete={completeGame}/>}
    {game==='treasure'&&<TreasureGame costume={current.wearing} background={roomMedia.background} phase={roomMedia.phase} sound={prefs.gameSound} color={current.color} stage={stage} evolution={current.evolution} onClose={closeGame} onComplete={completeGame}/>}
    {(game==='rhythm'||game==='orchard'||game==='puzzle')&&<MoreGames sound={prefs.gameSound} kind={game} onClose={closeGame} onComplete={completeGame}/>}
  </DeferredView>;

  if (floating && pet) return <div className={nativePet ? 'transparent-stage' : 'desktop-preview companion-preview'}>
    {!nativePet && <div className="preview-description"><strong>拉姆 · 桌面预览</strong><span>移上来互动，点击摸摸，按住拖动。</span></div>}
    <DesktopCompanion statusContent={<StatusPocket pet={current} onClose={()=>void openPanel(null)} onBackpack={()=>{setPocketCategory('food');void openPanel('food')}} onWake={()=>doCare('sleep')}/>} pocketContent={pocket}
      notesContent={<MessageBoard compact pet={current} onChange={updateNotes} onClose={()=>void openPanel(null)}/>} moodBusy={interactionBusy} interactionReason={interactionReason} moodLabel={mood.label} onActionPainted={markStudyPainted} onActionEnd={finishDisplay} pet={current} stage={stage} action={displayAction} actionId={displayActionId} itemId={actionItemId} fromColor={actionFromColor} bubble={spokenBubble} bubbleVisible={bubbleVisible} careFeedback={careFeedback?.petId===current.createdAt?careFeedback:null}
      panel={panel==='status'||panel==='food'||panel==='play'||panel==='notes'?panel:null} native={nativePet} desktopState={desktopState}
      gameSound={prefs.gameSound} soundVolume={prefs.soundVolume} sound={prefs.sound} timerDirection={prefs.timerDirection} reminderSeconds={timer.seconds} reminders={prefs.reminders} timerRunning={timer.running} reading={reading} sleepIntro={action==='sleep'} saveError={saveError || memorySaveError} pocketCategory={pocketCategory} pocketVisit={pocketVisit} playInvitation={playInvitation}
      onMood={()=>{respondMood();void openPanel(null);}} onOuting={()=>startOuting(true)} onPanel={next => { if (next === 'food') setPocketCategory('food'); void openPanel(next); }} onCare={doCare} onHome={() => void enterHome()} onWork={()=>startActivity('restaurant')} onViewRestaurant={()=>void enterRestaurant()} onStopWork={stopActivity} onSchool={()=>void enterHome('school')} onOriginalPlay={startOfficial} onUploadedPlay={startUploaded} onStopUploaded={stopUploaded} uploadedPlaying={isUploadedAction(action)} courseCompletion={courseCompletion} onElementSkill={showElementSkill} magicLearned={learned(current,'magic')} onMagic={()=>showSkill('magic')} onShop={visitToyShop} onWardrobe={()=>void enterHome('wardrobe')} onFocus={focusToggle} onSay={speak} onTug={tugReaction} onShake={showDizzy} onBubble={respondToBubble} onRecall={()=>recallPet()} onPresence={()=>tellPresence(true)} onCurious={()=>watchButterfly()} onPet={() => doCare('pet')}/>
    {toast && toast !== bubble && <div className="compact-toast" role="status">{toast}</div>}
    <div className="save-operation-receipt"><SaveOperationFeedback feedback={saveFeedback} onDismiss={()=>setSaveFeedback(null)}/></div>
  </div>;

  if(!pet&&unreadableSave)return <main className="save-recovery"><h1>先把原来的拉姆存档保管好</h1><p>本机有存档，但暂时无法完整读取。原记录仍然保留，修复或导入有效备份后再继续。</p><SaveManager onImport={importSave} onExport={()=>exportSave(true)} exportLabel="导出原始存档" importLabel="导入有效备份" feedback={saveFeedback} onFeedback={setSaveFeedback}/></main>;
  if (!pet && waitingForReopen && !window.desktop) return <div className="farewell-page"><img src="./icons/ramu.png" alt=""/><h1>好好说了再见</h1><p>这只拉姆和它的回忆已从本机移除。</p><button className="game-button" onClick={() => location.reload()}>重新打开领养处</button></div>;

  const roomAction = displayAction;
  const roomRam = (displayAction: string, paused = false) => <Ram paused={paused} companionId={current.createdAt} costume={current.wearing} sleepIntro={action==='sleep'}
    onActionPainted={markStudyPainted} onActionEnd={finishDisplay} sound={prefs.sound} gameSound={prefs.gameSound} soundVolume={prefs.soundVolume}
    color={current.color} stage={stage} evolution={current.evolution} action={displayAction} actionId={displayActionId}
    itemId={actionItemId} fromColor={actionFromColor} sleeping={current.sleeping}/>;
  const roomBalance=<span className="coin-sign room-balance" aria-label={`${current.coins} 摩尔豆`} title="摩尔豆">
    <img src="./assets/original/room-icons/mole-bean.png" alt="" draggable={false}/>{current.coins.toLocaleString()}
  </span>;

  return <div className={`classic-app ramu-v6 ${roomScreen.fullscreen?'is-room-fullscreen':''}`}>
    {pet&&panel!=='settings'&&!reset&&<div className="save-operation-receipt"><SaveOperationFeedback feedback={saveFeedback} onDismiss={()=>setSaveFeedback(null)}/></div>}
    {pet&&window.desktop&&window.desktop.platform!=='android'&&!roomScreen.fullscreen&&!roomScreen.busy&&<RoomResizeHandles/>}
    <header className="classic-titlebar"><div>拉姆</div><div>{window.desktop && <><button onClick={() => window.desktop?.minimize()} aria-label="最小化窗口">－</button><button onClick={() => window.desktop?.close()} aria-label="关闭窗口">×</button></>}</div></header>
    <TimeScene media={roomMedia} decorating={panel==='decor'}>
      {pet&&(Boolean(pet.room?.placed.length)||panel==='decor')&&<DeferredView quiet><RoomFurnishingLayer pet={current} edit={panel==='decor'} bookShelfAvailable={books.unlocked} onPlace={updateFurniture} onDuplicate={copyFurniture} onActivate={activateFurniture}
        playback={activeFurniturePlayback} onMotionReady={furnitureMotionReady} onMotionEnd={finishFurnitureMotion}
        onReadBook={openShelf} onShelfPage={updateShelfPage} onRemove={id=>updateFurniture(id)}/></DeferredView>}
      <div className="cottage-top">
        <div className="classic-logo"><img src="./icons/ramu.png" alt="两叶拉姆"/><span>{panel==='decor'?'布置小屋':'拉姆'}</span></div>
        {pet && (panel==='decor' ? <div className="scene-top-actions">
          {roomBalance}
        </div> : <div className="scene-top-actions">
          <div className="scene-top-scroll">
            <button className="room-icon-button" aria-label={roomScreen.fullscreen?'退出小屋全屏':'全屏查看小屋'} title={roomScreen.fullscreen?'退出全屏':'全屏查看'}
              aria-pressed={roomScreen.fullscreen} disabled={roomScreen.busy} onClick={()=>void roomScreen.toggle()}>
              {roomScreen.fullscreen?<Minimize aria-hidden="true"/>:<Maximize aria-hidden="true"/>}
            </button>
            <button className="room-icon-button room-check-in" disabled={checkedInToday(current)} onClick={checkIn} aria-label={checkedInToday(current)?"今日已签到":"每日签到领取1000摩尔豆"}
              title={checkedInToday(current)?"今日已签到":"签到领取 1000 摩尔豆"}>
              <CalendarCheck aria-hidden="true"/>
            </button>
            {roomBalance}
          </div>
          {!webEdition&&<button className="game-button desktop-return-action" onClick={()=>void toDesktop()}>{window.mobile?'悬浮陪伴':'回到桌面'}</button>}
        </div>)}
      </div>
      {pet&&<nav className="room-side-tools" aria-label="小屋工具">
        <button type="button" className="room-icon-button room-decoration-action" aria-label={panel==='decor'?'完成布置':'布置小屋'}
          title={panel==='decor'?'完成布置':'布置小屋'} aria-pressed={panel==='decor'}
          onClick={()=>panel==='decor'?finishRoomDecoration():setPanel('decor')}>
          <img src="./assets/original/room-icons/decorate.png" alt="" draggable={false}/>
          {panel==='decor'&&<Check className="room-decoration-check" aria-hidden="true"/>}
        </button>
        <button type="button" className="room-icon-button" aria-label="调整小屋拉姆大小" title="拉姆大小" aria-pressed={roomSizeDraft!==null} disabled={panel==='decor'}
          onClick={()=>{if(roomSizeDraft!==null){finishRoomSize(false);return}setPanel(null);setGame(null);setRoomSizeDraft(prefs.roomPetScale)}}>
          <Scaling aria-hidden="true"/>
        </button>
        <button type="button" className="room-icon-button manor-site-button" aria-label="进入摩尔庄园" title="进入摩尔庄园"
          onClick={()=>void openManorSite().catch(()=>notify('暂时无法打开浏览器，请稍后重试。'))}>
          <img src="./assets/original/room-icons/manor.png" alt="" draggable={false}/>
        </button>
      </nav>}
      {pet && panel!=='decor' && <>
        <RoomWalker scale={roomSizeDraft??prefs.roomPetScale} sizing={roomSizeDraft!==null} onScale={setRoomSizeDraft} onSizeFinish={finishRoomSize}
          randomWalk={prefs.roomWander} furnitureSeat={furnitureSeat} onDismount={dismountFurniture} onWalkingChange={setRoomWalking}
          stage={appearance.stage} evolution={appearance.evolution}
          blocked={reading||isAmbientAction(action)||interactionBusy||current.sleeping||Boolean(current.outing)||panel!==null||game!==null||reset}>
          {walkAction=>!roomStatusOpen&&<div style={{display:activeFurniturePlayback?.ready?'none':undefined}}
            className={`scene-pet ${current.outing?'pet-is-away':''} ${workingAway?'pet-at-work':''}`}>
            <CareFeedback feedback={workingAway||panel==='food'?null:careFeedback?.petId===current.createdAt?careFeedback:null}/>
            {bubbleVisible&&!workingAway&&<button type="button" className="scene-bubble visible" aria-label="收起拉姆提示" onClick={respondToBubble}><span role="status">{spokenBubble}</span></button>}
            <button className="scene-character" aria-label="摸摸拉姆" onPointerDown={event=>{
              const hit=isRamBodyPoint(event.currentTarget,event.clientX,event.clientY);
              event.currentTarget.dataset.ramHit=String(hit);
              if(!hit)event.currentTarget.dispatchEvent(new CustomEvent('room-walk-redirect',{bubbles:true,detail:{clientX:event.clientX,clientY:event.clientY}}));
            }} onClick={event=>{
              const {ramHit}=event.currentTarget.dataset;
              delete event.currentTarget.dataset.ramHit;
              if(event.detail===0||ramHit==='true')doCare('pet');
            }}>{roomRam(walkAction??roomAction,panel!==null||game!==null)}</button>
            {workingAway&&<div className="room-work-note" role="status"><img src="./assets/generated/school/icons/restaurant.png" alt=""/><strong>拉姆去餐厅打工了</strong><ActivityCard pet={current} onCancel={stopActivity}/></div>}
            <span className="scene-pet-name">{current.outing&&<button className="game-button small" onClick={()=>recallPet()}>去{current.outing.place}了 · 叫回来</button>}
              {current.name}<small>{current.sleeping?'睡着了':mood.label}</small>
              {current.sleeping&&<button className="scene-wake" onClick={()=>doCare('sleep')}>轻轻叫醒</button>}
            </span>
          </div>}
        </RoomWalker>
        {(!workingAway&&current.activity||courseCompletion)&&<div className="school-scene-status">{current.activity?<ActivityCard pet={current} onCancel={stopActivity}/>:<span role="status">{courseCompletion}</span>}</div>}
        <RoomDock onSelect={destination=>{if(destination==='restaurant'){void enterRestaurant();return;}if(destination==='food')setPocketCategory('food');setPanel(destination)}}/></>}
      {pet&&panel==='decor'&&<DeferredView><RoomFurnishingEditor pet={current} media={roomMedia} bookShelfAvailable={books.unlocked} onDownloadBooks={openBookSettings}
        onBuy={purchaseFurniture} onPlace={updateFurniture}/></DeferredView>}
      <footer className="classic-footer">{saveError&&<div role="alert">存档未保存，请导出备份</div>}</footer>
    </TimeScene>
    {!pet && <div className="adoption-screen"><section className="adoption-panel"><header className="adoption-header"><h1>{adoptionStep === 'color' ? '领养一只拉姆' : '给它起个名字'}</h1></header><form onSubmit={e => { if (adoptionStep === 'color') { e.preventDefault(); setAdoptionStep('name'); } else adopt(e); }}>
      {adoptionStep === 'color' ? <div className="adoption-colors">{COLORS.map(c => <button key={c.id} type="button" aria-label={`选择${c.name}拉姆`} aria-pressed={color === c.id} className={`adoption-choice ${color === c.id ? 'chosen' : ''}`} onClick={() => setColor(c.id)}><Ram color={c.id} stage={0}/><span style={{ '--swatch': c.hex } as CSSProperties}>{c.name}{color === c.id && <b>✓</b>}</span></button>)}</div>
        : <><div className="adoption-selected"><Ram color={color} stage={0}/></div><div className="adoption-name"><label htmlFor="pet-name">它的名字</label><input ref={adoptionFocus} id="pet-name" maxLength={12} value={name} onChange={e => setName(e.target.value)} onInput={e => setName(e.currentTarget.value)} placeholder="给拉姆起个名字" required autoFocus/></div></>}
      <button type="submit" className="game-button adopt-cta" disabled={adoptionStep === 'name' && !name.trim()}>{adoptionStep === 'color' ? '给它起名' : '带拉姆回家！'}</button>
      {adoptionStep === 'name' && <button type="button" className="adoption-back" onClick={() => setAdoptionStep('color')}>重新选颜色</button>}
      <p className="adoption-note">从一颗种子慢慢养大。赠送 1000 摩尔豆，用品到小屋挑选。</p>{webEdition&&<WebAppHelp compact/>}<details className="adoption-save-help"><summary>以前养过拉姆？检查存档或导入备份</summary><SaveManager onImport={importSave} feedback={saveFeedback} onFeedback={setSaveFeedback}/></details>
    </form></section></div>}
    {panel && panel!=='decor' && panel!=='notes' && panel!=='bookshelf' && panel!=='handbook' && panel!=='music-box' && pet && <GameDialog title={titles[panel]} wide={['shop','growth','games','settings','wardrobe','status','food','memories','school'].includes(panel)} onClose={() => setPanel(null)}>
      <nav className="paper-tabs" aria-label="小屋页面">{(['status','food','shop','wardrobe','games','growth','school','memories','settings'] as const).map(p => <button key={p} onClick={() => setPanel(p)} className={panel === p ? 'active' : ''}>{({status:'状态',food:'背包',shop:'商店',games:'游戏',growth:'成长',memories:'回忆',decor:'布置',wardrobe:'衣橱',school:'学院',settings:'设置'})[p]}</button>)}</nav>
      {toast && toast !== bubble && <p className="panel-feedback" role="status">{toast}</p>}
      {panel === 'shop' && <DeferredView><ShopBook key={shopCategory} pet={current} onBuy={buy} initialCategory={shopCategory}/></DeferredView>}
      {panel === 'wardrobe' && <DeferredView><Wardrobe pet={current} onBuy={id=>changeOutfit('buy',id)} onWear={id=>changeOutfit('wear',id)}/></DeferredView>}
      {panel==='school'&&<RamSchoolPanel busy={schoolBusy} pet={current} onLearn={id=>startActivity('course',id)} onSkill={showSkill} onElementSkill={showElementSkill} onCancel={stopActivity}/>}
      {panel === 'games' && <><OfficialClipMenu pet={current} busy={interactionBusy} onPlay={startOfficial} onElementSkill={showElementSkill} onMagic={()=>showSkill('magic')} onStop={stopUploaded} playing={isOfficialAction(action)||isSchoolAction(action)} activities={<PetPastimes pet={current} busy={interactionBusy} onPlay={startPastime} onSleep={()=>doCare('sleep')} onOuting={()=>startOuting(true)} onRecall={()=>recallPet()}/>}/><div className="room-game-grid">{([
        { id:'color-mixer',name:'拉姆换色游戏',icon:'180005',detail:'调配颜色 · 装瓶收藏',button:'拉姆换色游戏',grown:false },
        { id:'fruit',name:'拉姆接果子',icon:'180027',detail:'20 秒 · 接住果子',button:'开始接果子',grown:true },
        { id:'memory',name:'口袋翻翻乐',icon:'180017',detail:'45 秒 · 找到相同图案',button:'开始翻牌',grown:false },
        { id:'rhythm',name:'拉姆拍拍乐',icon:'180004',detail:'20 秒 · 跟着节拍',button:'开始拍拍乐',grown:false },
        { id:'orchard',name:'草地采果',icon:'180028',detail:'15 秒 · 眼明手快',button:'开始采果',grown:false },
        { id:'puzzle',name:'小屋拼拼乐',icon:'180070',detail:'九宫格 · 拼好小屋',button:'开始拼图',grown:false },
        { id:'treasure',name:'小屋寻宝',icon:'180027',detail:'不限时 · 和拉姆找宝物',button:'开始寻宝',grown:false },
      ] as const).map(g => <article key={g.id}><img src={`./assets/original/items/${g.icon}.png`} alt=""/><h3>{g.name}</h3><p>{g.detail}</p><button className="game-button" disabled={Boolean(current.activity) || current.sleeping || (g.grown && stage === 0)} onClick={() => startGame(g.id)}>{g.button}</button></article>)}</div><p className="room-game-note">玩一局赚摩尔豆和用品。{current.sleeping ? '拉姆在休息，先叫醒它吧。' : ''}</p></>}
      {panel === 'growth' && <div className="settings-panel" aria-label="拉姆成长">
        <StageSettings pet={current} onChange={chooseGrowth}/>
        <SettingsSection title="怎样慢慢长大"><p className="settings-hint">自动成长累计状态良好时的清醒时间。断网和关闭应用期间也会累计，重新打开时最多补算 24 小时。种子到初级约 1 天，初级到中级约 3 天，之后两个阶段分别约 7 天。睡眠或状态不足时暂停。</p><p className="settings-hint">可自由选择五个阶段及全部神力形态。固定形态暂停自然成长；切回自动成长会继续原有的自然进度。手动选后期外观不会提前增加自然成长时间，课程与装扮收藏仍会保留。</p></SettingsSection>
      </div>}
      {panel === 'status' && <RoomPetPanel key={current.createdAt} pet={current} memory={currentMemory} portrait={roomRam(roomAction)}
        onRename={renamePet} onWake={()=>doCare('sleep')} onMood={respondMood} moodBusy={interactionBusy}/>}
      {panel === 'food' && pocket}
      {panel === 'memories' && <DeferredView><PetDiary memory={currentMemory}/></DeferredView>}
      {panel === 'play' && <>{playInvitation}<OfficialClipMenu pet={current} busy={interactionBusy} onPlay={startOfficial} onElementSkill={showElementSkill} onMagic={()=>showSkill('magic')} onStop={stopUploaded} playing={isOfficialAction(action)||isSchoolAction(action)} activities={<div className="panel-shortcuts"><button className="game-button" onClick={() => doCare('play')}>一起玩球</button><button className="game-button" onClick={() => doCare('sleep')}>{current.sleeping?'轻轻叫醒':'睡一会儿'}</button><button className="game-button" onClick={() => setPanel('school')}>去学院</button><button className="game-button" onClick={() => setPanel('games')}>去游戏屋</button></div>}/></>}
      {panel === 'settings' && settingsContent}
    </GameDialog>}
    {panel==='notes'&&pet&&<MessageBoard pet={current} onChange={updateNotes} onClose={()=>setPanel(null)}/>}
    {panel==='music-box'&&musicBoxPlaced&&<GameDialog title={titles[panel]} onClose={()=>setPanel(null)}><RoomMusicBox media={roomMedia} webEdition={webEdition}/></GameDialog>}
    {panel==='handbook'&&pet&&<GameDialog title={titles[panel]} wide onClose={()=>setPanel(null)}>
      {toast && toast!==bubble && <p className="panel-feedback" role="status">{toast}</p>}
      <DeferredView><ShopBook pet={current} onBuy={buy} onReadOriginal={()=>setPanel('bookshelf')}/></DeferredView>
    </GameDialog>}
    {panel==='bookshelf'&&pet&&<DeferredView onClose={closeOriginalBook}><OriginalReadingBook key={current.createdAt} progress={current.reading} initialBook={shelfBook} onProgress={updateReading} onClose={closeOriginalBook} onDownloadBooks={openBookSettings}/></DeferredView>}
    {reset && pet && <GameDialog title="和拉姆说再见？" onClose={() => setReset(false)}><div className="farewell-confirm"><div><Ram costume={current.wearing} color={current.color} stage={stage} evolution={current.evolution}/></div><h3>送别 {current.name}</h3><p>这会删除它的成长、物品和本机回忆。重新打开后，可以领养一颗新的种子。</p><SaveOperationFeedback feedback={saveFeedback}/><div className="confirm-buttons"><button className="game-button" onClick={()=>void exportSave()}>先导出存档</button><button className="game-button" onClick={() => void abandonPet()}>确认送别</button></div></div></GameDialog>}
    {gameOverlay}
  </div>;
}
