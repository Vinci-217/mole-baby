import UpdateSettings from './components/UpdateSettings';
import {useDesktopPetStatus} from './use-desktop-pet-status';
import {elementEffectRect} from './element-playback';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties, FormEvent, ReactNode } from 'react';
import { COLORS, STAGES, EVOLUTIONS, GROWTH_MAX, evolvePet, changePetStage, GROWTH_STAGE_HOURS, buyItem, care, createPet, getItem, getPetCondition, getStage, parseSave, rewardGame, tick } from './game';
import type { Action, GameState, PetColor, Evolution, Stage } from './game';
import Ram from './components/Ram';
import FruitGame from './components/FruitGame';
import MemoryGame from './components/MemoryGame';
import TreasureGame from './components/TreasureGame';
import DesktopCompanion from './components/DesktopCompanion';
import type { CompanionPanel } from './components/DesktopCompanion';
import ShopBook from './components/ShopBook';
import Wardrobe from './components/Wardrobe';
import {buyOutfit,wearOutfit,getOutfit} from './wardrobe';
import {isMoodAction,isEmotionClip} from './mood-motion';
import {moodResponse} from './mood-companion';
import TimeScene from './components/TimeScene';
import MoreGames from './components/MoreGames';
import type { ExtraGame } from './components/MoreGames';
import { getItemMotion } from './item-motion';
import { getRamActionDuration } from './components/ram-animation';
import {ramForm} from './original-actions';
import { playPetVoice, playGameSound, preparePetSound, playInteractionPreview, configurePetSound, prepareReminderSound, playReminderSound } from './pet-audio';
import type { GameReceipt } from './components/game-receipt';
import CarePocket from './components/CarePocket';
import type {PocketCategory} from './components/CarePocket';
import RoomPetPanel,{PetDiary} from './components/RoomPetPanel';
import MacHelp from './components/MacHelp';
import StageSettings from './components/StageSettings';
import RoomSettings from './components/RoomSettings';
import RoomWalker from './components/RoomWalker';
import { useRoomMedia } from './room-media';
import { createMemory, loadMemory, recordCare, recordEvent, saveMemory, memoryKey, getCompanionMood } from './companion-memory';
import type { CompanionMemory } from './companion-memory';
import './companion-life.css';
import { usePresence } from './use-presence';
import { presenceKey, welcomeLine, wantsQuiet } from './companion-presence';
import { useIdleLife } from './use-idle-life';
import CareFeedback from './components/CareFeedback';
import {careGains,mergeCareFeedback,type CareFeedbackData} from './care-feedback';
import type { PresenceLine } from './companion-presence';
import { useRestReminder, validReminderMinutes, reminderTime, timerRecordDetail, type TimerDirection } from './use-rest-reminder';
import PetInvitation from './components/PetInvitation';
import { createInvitation, companionSnoozeUntil } from './companion-invitation';
import type { CompanionInvitation } from './companion-invitation';
import { getPetHabits, nameResponse } from './companion-instinct';
import {claimDailyCheckIn,checkedInToday} from './daily-check-in';
import {isPastime,playBlockReason,beginOuting,finishOuting,PASTIME_LINES,PASTIME_MEMORIES} from './pet-pastimes';
import type {Pastime} from './pet-pastimes';
import PetPastimes from './components/PetPastimes';
import {elementSkillById,learnedElementSkill} from './element-skills';
import RamSchoolPanel,{RestaurantCard,ActivityCard} from './components/RamSchoolPanel';
import {activityAction,beginActivity,cancelActivity,courseById,isSchoolAction,learned,petSpeech,JOB_PAY,type CourseId} from './pet-school';
import {RoomFurnishingLayer,RoomFurnishingEditor} from './components/RoomFurnishings';
import {PET_SAVE_KEY,MAX_BACKUP_BYTES,restorePetBackup} from './pet-backup';
import {buyFurniture,placeFurniture,removeFurniture,hasRoomWall} from './room-furnishings';

const SAVE_KEY = PET_SAVE_KEY;
const PREFS_KEY = 'ramu-house-preferences-v2';
type Panel = CompanionPanel | 'shop' | 'games' | 'growth' | 'settings' | 'decor' | 'wardrobe' | 'status' | 'memories' | 'school' | null;
type GameKind = 'fruit' | 'memory' | 'treasure' | ExtraGame;
const GAME_LABELS: Record<GameKind, string> = { fruit:'拉姆接果子',memory:'口袋翻翻乐',rhythm:'拉姆拍拍乐',orchard:'草地采果',puzzle:'小屋拼拼乐',treasure:'小屋寻宝' };
type Preferences = { sound: boolean; soundVolume: number; lively: boolean; outings: boolean; quiet: boolean; reminders: boolean; reminderMinutes: number; reminderSound: boolean; timerDirection:TimerDirection; presence: boolean; presenceMinutes: number };
type Result = { state: GameState; message: string; ok: boolean };
const titles = { status:'我的拉姆',food:'拉姆的背包',play:'一起玩耍',shop:'拉姆用品商店',games:'小屋游戏',growth:'一起长大',memories:'我们的小日子',settings:'小屋设置',decor:'布置小屋',wardrobe:'拉姆小衣橱',school:'拉姆学院' };
function readSave() {
 try {
  const raw=localStorage.getItem(SAVE_KEY);if(!raw)return null;
  const stored=JSON.parse(raw);let selected=false;
  try{const history=JSON.parse(localStorage.getItem(memoryKey(stored))??'null');selected=history?.version===1&&history.petId===String(stored.createdAt)&&Array.isArray(history.events)&&history.events.some((event:{kind?:string})=>event?.kind==='stage-choice')}catch{}
  return parseSave(raw,Date.now(),selected);
 }catch{return null}
}
function readPrefs(): Preferences { try { const p = JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}'); return { sound: p.sound !== false, soundVolume: typeof p.soundVolume === 'number' && Number.isFinite(p.soundVolume) ? Math.max(0,Math.min(1,p.soundVolume)) : .45, lively: p.lively !== false, outings: p.outings !== false, quiet: p.quiet === true, reminders: p.reminders !== false, reminderMinutes: validReminderMinutes(p.reminderMinutes), reminderSound: p.reminderSound !== false, timerDirection: p.timerDirection==='countup'?'countup':'countdown', presence: p.presence !== false, presenceMinutes: [10,20,40].includes(p.presenceMinutes)?p.presenceMinutes:20 }; } catch { return { sound: true, soundVolume: .45, lively: true, outings: true, quiet: false, reminders: true, reminderMinutes: 40, reminderSound: true, timerDirection:'countdown', presence: true, presenceMinutes: 20 }; } }
const ITEM_IMAGES = ['items/180027', 'items/180017', 'items/180008', 'items/180003', 'items/180004', 'ui/icon-clock'];
function ItemArt({ item, className = '' }: { item: number; className?: string }) { return <img className={`item-art ${className}`} alt="" aria-hidden="true" draggable={false} src={`./assets/original/${ITEM_IMAGES[item]}.png`}/>; }
function UiArt({ name, className = '' }: { name: string; className?: string }) { return <img className={`original-ui-art ${className}`} alt="" aria-hidden="true" draggable={false} src={`./assets/original/ui/${name}.png`}/>; }
function GameDialog({ title, children, onClose, wide = false }: { title: string; children: ReactNode; onClose: () => void; wide?: boolean }) {
  const dialog = useRef<HTMLDivElement>(null); const close = useRef(onClose); close.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null; dialog.current?.focus();
    const key = (e: KeyboardEvent) => { const stack = document.querySelectorAll('[role=dialog]'); if (stack[stack.length - 1] !== dialog.current) return; if (e.key === 'Escape') close.current(); if (e.key === 'Tab') { const items = dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled):not([type=hidden]),textarea:not(:disabled),select:not(:disabled),summary,a[href],[tabindex="0"]'); if (!items?.length) return; const first = items[0], last = items[items.length - 1]; if (e.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); } } };
    document.addEventListener('keydown', key); return () => { document.removeEventListener('keydown', key); previous?.focus(); };
  }, []);
  return <div className="game-overlay" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}><section ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title} className={`game-panel ${wide ? 'wide-panel' : ''}`}><header className="panel-header"><h2>{title}</h2><button className="round-close" onClick={onClose} aria-label="关闭面板">×</button></header><div className="panel-paper">{children}</div></section></div>;
}

export default function App() {
  const [pet, setPet] = useState<GameState | null>(readSave);
  const [prefs, setPrefs] = useState<Preferences>(readPrefs);
  const [panel, setPanel] = useState<Panel>(null);
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
  const pendingCareFeedback=useRef<CareFeedbackData|null>(null);
  const lastTug=useRef(0);
  const [action, setAction] = useState('idle');
  const [courseCompletion,setCourseCompletion]=useState('');
  const [petMode, setPetMode] = useState(false);
  const [preview, setPreview] = useState(() => !window.desktop && readSave() !== null);
  const [actionId, setActionId] = useState(0);
  const [desktopState, setDesktopState] = useState<DesktopState>({ petMode:false,alwaysOnTop:false,wandering:true,companionPanel:false,panelSide:'right',edgeHiding:true,edgeSide:null,edgePose:'visible' });
  const [toast, setToast] = useState('');
  const [bubble, setBubble] = useState('拉姆～ 我来陪你啦！');
  const [bubbleVisible, setBubbleVisible] = useState(false);
  const [invitation, setInvitation] = useState<{ petId:number; at:number; offer:CompanionInvitation } | null>(null);
  const invitationRef = useRef(invitation); invitationRef.current = invitation;
  const suggestionSequence = useRef(0), nameSequence = useRef(0), nameCallUntil = useRef(0);
  const [game, setGame] = useState<GameKind | null>(null);
  const [reset, setReset] = useState(false);
  const [evolutionChoice, setEvolutionChoice] = useState<Evolution>('super');
  const [pocketCategory, setPocketCategory] = useState<PocketCategory>('food');
  const [pocketVisit, setPocketVisit] = useState(0);
  const [memory, setMemory] = useState<CompanionMemory | null>(() => { const saved = readSave(); return saved ? loadMemory(saved) : null; });
  const [memorySaveError, setMemorySaveError] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const petRef = useRef(pet); petRef.current = pet;
  const timers = useRef<{ animation?: ReturnType<typeof setTimeout>; toast?: ReturnType<typeof setTimeout>; bubble?: ReturnType<typeof setTimeout>; feedback?: ReturnType<typeof setTimeout>;course?:ReturnType<typeof setTimeout> }>({});
  const ambient = useRef<{line:PresenceLine;at:number}|null>(null);
  const previousRest = useRef<{petId:number;sleeping:boolean}|null>(null);
  const pastimeRun=useRef<{petId:number;kind:Pastime}|null>(null);
  const importInput = useRef<HTMLInputElement>(null);
  const importSequence=useRef(0);
  useEffect(()=>()=>{importSequence.current++},[]);

  const updateSnapshot=useRef<()=>boolean>(()=>false);
  useEffect(()=>window.desktop?.updates?.onPrepare(()=>updateSnapshot.current()),[]);
  const adoptionFocus = useRef<HTMLInputElement>(null);
  const hasPet = pet !== null;
  const current = pet ?? createPet('小拉姆', color);
  const stage = getStage(current.growth, current.evolution);
  const nextStage = stage < 4 ? STAGES[stage + 1] : undefined;
  const progress = nextStage ? (current.growth - STAGES[stage].threshold) / (nextStage.threshold - STAGES[stage].threshold) * 100 : 100;
  const floating = petMode || preview;
  const condition = getPetCondition(current);
  const spokenBubble=petSpeech(current,bubble);
  const renderedAction = activityAction(current.activity) ?? (action !== 'idle' ? action : desktopState.motion === 'left' ? 'walk-left' : desktopState.motion === 'right' ? 'walk-right' : condition.action);
  const roomMedia = useRoomMedia(hasPet && !floating, hasPet);
  useEffect(()=>window.desktop?.onMusicToggle?.(enabled=>roomMedia.update({musicEnabled:enabled,...(enabled?{backgroundPlayback:true}:{})})),[roomMedia.update]);
  useEffect(()=>{void window.desktop?.setMusicState?.({playing:roomMedia.playing,enabled:roomMedia.settings.musicEnabled,background:roomMedia.settings.backgroundPlayback})},[roomMedia.playing,roomMedia.settings.musicEnabled,roomMedia.settings.backgroundPlayback]);
  useEffect(()=>{configurePetSound({enabled:prefs.sound,volume:prefs.soundVolume})},[prefs.sound,prefs.soundVolume]);
  const currentMemory = memory?.petId === String(current.createdAt) ? memory : createMemory(current);
  updateSnapshot.current=()=>{try{const saved=petRef.current;if(awaitingAdoption.current)return false;if(saved){localStorage.setItem(SAVE_KEY,JSON.stringify(saved));if(currentMemory.petId===String(saved.createdAt)&&!saveMemory(saved,currentMemory))return false}localStorage.setItem(PREFS_KEY,JSON.stringify(prefs));return true}catch{return false}};
  const snoozed = companionSnoozeUntil(currentMemory) > Date.now();
  const openInvitation = invitation?.petId === current.createdAt && Date.now()-invitation.at < 5*60000 ? invitation.offer : null;
  const days = Math.max(1, Math.floor((Date.now() - current.createdAt) / 86400000) + 1);

  const speak = useCallback((text: string, duration = 6500) => { ambient.current = null; setBubble(text); setBubbleVisible(true); clearTimeout(timers.current.bubble); timers.current.bubble = setTimeout(() => setBubbleVisible(false), duration); }, []);
  const notify = useCallback((text: string) => { setToast(text); clearTimeout(timers.current.toast); timers.current.toast = setTimeout(() => setToast(''), 3800); }, []);
  useEffect(() => { setCourseCompletion('');clearTimeout(timers.current.course);clearInvitation(); suggestionSequence.current=0; nameSequence.current=0; nameCallUntil.current=0; }, [pet?.createdAt]);
  useEffect(() => { if(pet?.sleeping||prefs.quiet)clearInvitation(); }, [pet?.sleeping,prefs.quiet]);
  useEffect(() => {
    if (!invitation) return;
    const expiry = setTimeout(() => {
      if (invitationRef.current === invitation) clearInvitation();
    }, Math.max(0, invitation.at + 5 * 60000 - Date.now()));
    return () => clearTimeout(expiry);
  }, [invitation]);
  useEffect(() => { if (pet && petRef.current?.createdAt === pet.createdAt && !awaitingAdoption.current) { try { localStorage.setItem(SAVE_KEY, JSON.stringify(pet)); setSaveError(false); } catch { setSaveError(true); } } }, [pet]);
  useEffect(() => { try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch { /* Pet save has its own error notice. */ } }, [prefs]);
  useEffect(() => { const timer = setInterval(() => setPet(p => p ? tick(p, Date.now()) : p), 15000); return () => clearInterval(timer); }, []);
  useEffect(() => {
    const desktop = window.desktop; if (!desktop) return;
    const unsubscribe = desktop.onStateChanged(state => { setDesktopState(state); setPetMode(state.petMode); document.documentElement.classList.toggle('pet-mode', state.petMode); });
    return () => { unsubscribe(); document.documentElement.classList.remove('pet-mode'); };
  }, []);
  useEffect(() => {
    const desktop = window.desktop; if (!desktop) return;
    if (awaitingAdoption.current) { desktop.readyToShow(false); return; }
    let cancelled = false;
    void desktop.setPetMode(hasPet).then(() => requestAnimationFrame(() => requestAnimationFrame(() => { if (!cancelled) desktop.readyToShow(hasPet); }))).catch(() => notify('窗口暂时未能准备好，请从托盘重试。'));
    if (hasPet && petRef.current) speak(welcomeLine(petRef.current, loadMemory(petRef.current)));
    return () => { cancelled = true; };
  }, [hasPet, notify, speak]);
  useEffect(() => { if (floating && game) setGame(null); }, [floating, game]);
  useEffect(() => { if (!hasPet) adoptionFocus.current?.focus(); }, [hasPet]);
  useEffect(() => () => { Object.values(timers.current).forEach(clearTimeout); }, []);
  useEffect(() => { if (pet && memory?.petId !== String(pet.createdAt)) setMemory(loadMemory(pet)); }, [pet, memory?.petId]);
  useEffect(() => { if (pet && petRef.current?.createdAt === pet.createdAt && !awaitingAdoption.current && memory?.petId === String(pet.createdAt)) setMemorySaveError(!saveMemory(pet, memory)); }, [pet, memory]);
  const timer = useRestReminder(pet?.createdAt, prefs.reminders, prefs.reminderMinutes, () => {
    const text = '计时结束啦！站起来伸伸懒腰，喝口水，看看远处吧。';
    speak(text, 15000); notify(text); playReminderSound(prefs.reminderSound);
    window.desktop?.notify('拉姆 · 计时结束', text);
  },prefs.timerDirection,record=>setMemory(m=>m?.petId===String(record.petId)?recordEvent(m,{kind:'focus-timer',detail:timerRecordDetail(record),at:record.endedAt}):m));
  const interactionBusy = Boolean(current.activity) || current.sleeping || Boolean(current.outing) || timer.running || action !== 'idle' || Date.now() < careUntil.current || Date.now() < dizzyUntil.current;
  const schoolBusy = timer.running || Date.now()<careUntil.current || ['play','dizzy'].includes(action);
  const tellPresence = usePresence({pet,memory:currentMemory,enabled:prefs.presence,minutes:prefs.presenceMinutes,reading:timer.running,
    blocked:!floating||prefs.quiet||snoozed||current.sleeping||Boolean(current.activity)||Boolean(current.outing)||panel!==null||game!==null||!['idle','focus'].includes(action)||bubbleVisible||desktopState.edgeSide!==null||(desktopState.motion!==undefined&&desktopState.motion!=='idle'),
    onLine:line=>{if(line.invitation)presentInvitation({...line.invitation,text:line.text});else{clearInvitation();speak(line.text,14000);}ambient.current={line,at:Date.now()};}
  });
  useIdleLife({petId:pet?.createdAt,pet:pet??undefined,memory:currentMemory,enabled:prefs.lively&&!wantsQuiet(currentMemory),blocked:!floating||prefs.quiet||snoozed||current.sleeping||Boolean(current.activity)||Boolean(current.outing)||timer.running||panel!==null||game!==null||action!=='idle'||bubbleVisible||desktopState.edgeSide!==null||(desktopState.motion!==undefined&&desktopState.motion!=='idle')||current.stats.health<35||current.stats.energy<25||current.stats.hunger<25||current.stats.thirst<25,onAction:(next,sequence)=>{if(prefs.outings&&sequence%5===4&&startOuting(false,sequence))return;if(isPastime(next))startPastime(next==='spell'&&!learned(current,'magic')?'read-alone':next);else animate(next)}});
  const returnRef=useRef((manual=false)=>recallPet(manual));returnRef.current=recallPet;
  useEffect(()=>{
    if(!pet?.outing)return;
    const due=setTimeout(()=>returnRef.current(false),Math.max(0,pet.outing.returnsAt-Date.now()));
    return()=>clearTimeout(due);
  },[pet?.createdAt,pet?.outing?.id]);
  useEffect(()=>{if(petRef.current?.outing&&(prefs.quiet||!prefs.outings))returnRef.current(true)},[prefs.quiet,prefs.outings]);
  useEffect(()=>{
    if(action!=='read-alone'||!prefs.presence||prefs.quiet)return;
    const reading=setTimeout(()=>{if(!document.hidden)speak('这一页说，学会一件事之前，总会有几次摇摇晃晃。我觉得很有道理。',9500)},8500);
    return()=>clearTimeout(reading);
  },[action,actionId,prefs.presence,prefs.quiet,speak]);
  const previousActivity=useRef(pet?.activity);
  useEffect(()=>{
    if(!pet?.activity)return;
    const id=pet.activity.id,due=setTimeout(()=>setPet(p=>p?.activity?.id===id?tick(p,Date.now()):p),Math.max(0,pet.activity.endsAt-Date.now()+5));
    return()=>clearTimeout(due);
  },[pet?.activity?.id]);
  useEffect(()=>{
    const before=previousActivity.current;previousActivity.current=pet?.activity;
    if(!pet||!before||!before.id.startsWith(`${pet.createdAt}:`)||pet.activity?.id===before.id||Date.now()<before.endsAt)return;
    const c=courseById(before.course),text=before.kind==='restaurant'?`工作完成！摩尔豆 +${JOB_PAY}`:before.course==='magic'?'魔法课学习完成！获得魔法法杖，已放进衣橱。':`${c!.name}学习完成！已掌握。`;
    notify(text);speak(text);playGameSound('reward',prefs.sound);
    if(before.kind==='course'){setCourseCompletion(text);clearTimeout(timers.current.course);timers.current.course=setTimeout(()=>setCourseCompletion(''),6500)}
    if(before.kind==='restaurant'){
      clearTimeout(timers.current.feedback);setBubbleVisible(false);setCareFeedback({id:Date.now(),petId:pet.createdAt,gains:[{key:'coins',label:'摩尔豆',amount:JOB_PAY,image:'./assets/original/ui/icon-medal.png'}]});timers.current.feedback=setTimeout(()=>setCareFeedback(null),2300);
    }
    setMemory(m=>m?recordEvent(m,{kind:before.kind==='restaurant'?'job-complete':'course-complete',detail:text}):m);
  },[pet?.activity,pet?.education]);
  function startActivity(kind:'course'|'restaurant',id?:CourseId){
    const saved=petRef.current;if(!saved)return;
    if(schoolBusy){notify('先结束正在进行的互动或专注计时吧。');return;}
    const result=beginActivity(tick(saved),kind,id);if(!result.ok){notify(result.message);return;}
    setCourseCompletion('');clearInvitation();pastimeRun.current=null;clearTimeout(timers.current.animation);setActionId(n=>n+1);setPanel(null);apply(result);setAction('idle');
  }
  function stopActivity(){
    const saved=petRef.current;if(!saved?.activity)return;
    previousActivity.current=undefined;const next=cancelActivity(saved);petRef.current=next;setPet(next);notify('已经回来啦。这次未完成的活动不结算。');
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
  useEffect(()=>{if(panel!=='decor')return;const close=(event:KeyboardEvent)=>{if(event.key==='Escape')setPanel(null)};document.addEventListener('keydown',close);return()=>document.removeEventListener('keydown',close)},[panel]);
  function updateFurniture(id:string,x?:number,y?:number){
    const saved=petRef.current;if(!saved)return;const next=x===undefined?removeFurniture(saved,id):placeFurniture(saved,id,x,y!);petRef.current=next;setPet(next);
  }
  function startPastime(kind:Pastime){
    const saved=petRef.current;if(!saved)return;
    const reason=playBlockReason(saved);if(reason){notify(reason);return;}
    if(timer.running||Date.now()<careUntil.current||Date.now()<dizzyUntil.current){notify('先结束当前互动或专注计时吧。');return;}
    if(kind==='spell'&&!learned(saved,'magic')){notify('先到拉姆学院学会魔术，再展示变身本领吧。');return}
    clearInvitation();if(!floating)setPanel(null);preparePetSound(prefs.sound);animate(kind);pastimeRun.current={petId:saved.createdAt,kind};
    if(prefs.presence&&!prefs.quiet)speak(PASTIME_LINES[kind],9500);
  }
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
    if(!document.hidden&&!prefs.quiet){animate('waving');speak(text,14000);playPetVoice('drop',prefs.sound)}
  }
  function checkIn(){
    const saved=petRef.current;if(!saved)return;const result=claimDailyCheckIn(saved);petRef.current=result.state;setPet(result.state);speak(result.message);
    if(result.ok){playGameSound('reward',prefs.sound);setMemory(m=>m?recordEvent(m,{kind:'check-in',detail:'我们收好了今天签到的 1000 摩尔豆。'}):m)}
  }
  function respondMood(){
    const saved=petRef.current;if(document.hidden||!saved||interactionBusy)return
    clearInvitation();const response=moodResponse(saved,currentMemory);animate(response.action);if(response.action==='mood-joy')playInteractionPreview('sparkle',prefs.sound);speak(response.line,9500)
    setMemory(m=>m?recordEvent(m,{kind:'mood-check',detail:'你关心我现在的心情，我用真实的状态回应了你。'}):m)
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
  const effectId=action.startsWith('element-')?action.slice(8):null;
  const previousEffectMode=useRef(floating);
  useEffect(()=>{
    const changedMode=previousEffectMode.current!==floating;previousEffectMode.current=floating;
    const interrupted=Boolean(effectId&&(changedMode||panel!==null||game!==null));
    if(interrupted)finishPerformance();
    const rect=!interrupted&&petMode&&effectId?elementEffectRect(effectId,ramForm(stage,pet?.evolution)):null;
    void window.desktop?.setPetEffectBounds?.(rect?{...rect,x:rect.x+30,y:rect.y+71}:null).catch(()=>{});
  },[effectId,petMode,stage,pet?.evolution,floating,panel,game]);
  useEffect(()=>{if(hasPet)void window.desktop?.setPetAppearance(ramForm(stage,pet?.evolution));},[hasPet,stage,pet?.evolution]);
  useEffect(() => { void window.desktop?.setPetCanMove(hasPet && stage > 0 && !pet?.sleeping && !pet?.outing && !pet?.activity); }, [hasPet,pet?.sleeping,pet?.outing,pet?.activity,stage]);
  useEffect(()=>{
    const before=previousRest.current;previousRest.current=pet?{petId:pet.createdAt,sleeping:pet.sleeping}:null;
    if(!pet||before?.petId!==pet.createdAt||before.sleeping===pet.sleeping)return;
    if(!pet.sleeping&&(pet.awakeUntil??0)>Date.now())return; // Manual wake already records its actual care event.
    const text=pet.sleeping?'有点困啦，我闭上眼睡一会儿，想我时可以轻轻叫醒。':'睡饱啦，我又有精神陪你了。';
    if(!prefs.quiet&&!timer.running){speak(text);playPetVoice(pet.sleeping?'sleep':'wake',prefs.sound);}
    setMemory(m=>m?recordEvent(m,{kind:pet.sleeping?'auto-sleep':'auto-wake',detail:pet.sleeping?'我困了，自己闭上眼休息。':'我恢复了精力，自然醒来。'}):m);
  },[pet?.createdAt,pet?.sleeping,prefs.quiet,prefs.sound,timer.running,speak]);

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
    if(prefs.presence&&!prefs.quiet){const lines=['花盆也要带好，哼……再抱一小会儿。','才、才不是想让你抱呢。轻一点嘛。','叶子要乱啦！……放下以后还要陪我哦。','我自己会飞的……不过让你抱一会儿也行。','嘿，我可是会魔法的！……好吧，再抱一下。'];speak(lines[stage],4500)}
  }
  function animate(next: string, itemId?: string, fromColor?: PetColor, feedback?:CareFeedbackData) {
    if(!isPastime(next))pastimeRun.current=null;
    const motion = itemId ? getItemMotion(itemId) : null;
    const p=petRef.current;
    const duration = motion?.duration ?? getRamActionDuration(next,p?ramForm(getStage(p.growth,p.evolution),p.evolution):'seed') ?? 900;
    setActionId(n => n + 1); setActionFromColor(fromColor); setActionItemId(itemId); setAction(motion?.action ?? next);
    careUntil.current = itemId ? Date.now() + duration + 50 : 0;
    if(feedback?.gains.length){pendingCareFeedback.current=mergeCareFeedback(pendingCareFeedback.current,feedback);clearTimeout(timers.current.feedback);setCareFeedback(null);}
    else if(!itemId)finishCareFeedback();
    clearTimeout(timers.current.animation); timers.current.animation = setTimeout(() => { finishCareFeedback();finishPastime();setAction('idle'); setActionItemId(undefined);setActionFromColor(undefined); }, duration + (next==='play'||next==='play-alone'||next==='skill-magic'||next==='spell'||next.startsWith('element-')||isEmotionClip(next)?5000:50));
  }
  function finishPerformance(){if(action==='play'||isMoodAction(action)||isPastime(action)||isSchoolAction(action)){finishPastime();clearTimeout(timers.current.animation);setAction('idle');setActionItemId(undefined);setActionFromColor(undefined)}}
  function apply(result: Result, nextAction?: string, detail?: string, itemId?: string) {
    const before = petRef.current; petRef.current = result.state; setPet(result.state); notify(result.message); speak(result.message);
    if (result.ok) {
      if (nextAction) { if (nextAction !== 'buy' || Date.now() >= careUntil.current) { animate(nextAction, itemId, before?.color !== result.state.color ? before?.color : undefined, before&&itemId?{id:Date.now(),petId:result.state.createdAt,gains:careGains(before,result.state,itemId)}:undefined); if(nextAction==='buy'||nextAction==='reward')playGameSound(nextAction==='buy'?'purchase':'reward',prefs.sound);else if(nextAction==='wake'||nextAction==='sleep')playPetVoice(nextAction,prefs.sound); } setMemory(m => m ? recordCare(m, nextAction === 'reward' ? 'game' : nextAction, detail) : m); }
      if (before && getStage(before.growth, before.evolution) < getStage(result.state.growth, result.state.evolution)) { speak(`${result.state.name}长大啦！现在是${STAGES[getStage(result.state.growth, result.state.evolution)].name}！`, 10000); setMemory(m => m ? recordEvent(m, { kind: 'growth', detail: `我长成了${STAGES[getStage(result.state.growth, result.state.evolution)].name}。` }) : m); }
    }
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
    const detail = invitationDetail ?? (item ? `你用${item.name}照料了我。` : type === 'sleep' ? saved.sleeping ? '你轻轻叫醒了我。' : '你让我安心睡了一觉。' : undefined);
    const result=care(saved, type, itemId, Date.now());
    if(result.ok){clearInvitation();if(type==='sleep')previousRest.current={petId:result.state.createdAt,sleeping:result.state.sleeping};}
    apply(result, next, detail, itemId);
    return result.ok;
  }
  function chooseStage(next: Stage, evolution?: Evolution) {
    const saved = petRef.current; if (!saved) return;
    const result = changePetStage(saved, next, evolution);
    if (!result.ok || result.state === saved) { notify(result.message); return; }
    pastimeRun.current=null;result.state=cancelActivity(result.state);previousActivity.current=undefined;
    if(saved.outing){result.state=finishOuting(result.state);setMemory(m=>m?recordEvent(m,{kind:'outing-recall',detail:'你调整了我的成长形态，我先回到你身边。'}):m)}
    clearInvitation();clearTimeout(timers.current.animation); careUntil.current = 0; dizzyUntil.current = 0; touches.current = [];
    pendingCareFeedback.current=null;setCareFeedback(null);clearTimeout(timers.current.feedback);setActionItemId(undefined);setActionFromColor(undefined); setAction(timer.running ? 'focus' : 'idle'); setActionId(n => n + 1);
    petRef.current = result.state; setPet(result.state); notify(result.message); speak(result.message);
    setMemory(m => m ? recordEvent(m, { kind: 'stage-choice', detail: `你在设置里把我的形态切换为${result.state.evolution ? EVOLUTIONS.find(v => v.id === result.state.evolution)!.name : STAGES[next].name}。` }) : m);
  }
  function changeOutfit(kind:'buy'|'wear',id?:string){
    const saved=petRef.current;if(!saved||(kind==='buy'&&floating))return
    const result=kind==='buy'?buyOutfit(saved,id??''):wearOutfit(saved,id)
    clearInvitation();apply(result)
    if(result.ok){
      if(kind==='buy')playGameSound('purchase',prefs.sound)
      else if(!saved.sleeping&&action==='idle'&&!timer.running&&Date.now()>=careUntil.current)animate('mood-content')
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
  function adopt(e: FormEvent) { e.preventDefault(); if (!name.trim()) return; const adopted = createPet(name.trim().slice(0, 12), color); awaitingAdoption.current = false; setWaitingForReopen(false); setPet(adopted); setMemory(recordEvent(createMemory(adopted), { kind: 'adoption', detail: '你把我接回了家，我们开始一起生活。' })); if (!window.desktop) setPreview(true); speak('从今天起，我就是你的小拉姆啦。请多关照！', 10000); }
  async function toDesktop() { setPanel(null); setGame(null); await window.desktop?.setCompanionPanel(false); if (window.desktop) { try { await window.desktop.setPetMode(true); } catch { notify('窗口切换失败，请稍后再试。'); } } else setPreview(true); }
  async function openPanel(next: Panel) { if (floating && next && ['shop','games','growth','settings','decor','wardrobe','status','memories','school'].includes(next)) { await enterHome(next); return; } if (next === 'food'||next === 'status') setPocketVisit(v => v + 1); setPanel(next); if (petMode) { try { await window.desktop?.setCompanionPanel(next !== null, 'compact'); } catch { notify('小窗暂时无法打开，请再试一次。'); } } }
  async function enterHome(next: Panel = null) { setPanel(next); setGame(null); setPreview(false); await window.desktop?.setCompanionPanel(false); await window.desktop?.setPetMode(false); }
  function startTimer() {
    if (!prefs.reminders) return;
    if(petRef.current?.activity){notify('先结束当前课程或工作吧。');return;}
    if(petRef.current?.outing)recallPet();
    clearInvitation();
    prepareReminderSound(); timer.start(); if (Date.now() >= careUntil.current) animate('focus');
    speak(`我翻开书陪你读一会儿，${prefs.timerDirection==='countup'?'从零开始计时，':''}${prefs.reminderMinutes} 分钟后提醒你。`);
  }
  function focusToggle() { if (timer.running) { timer.cancel(); if (action === 'focus') { clearTimeout(timers.current.animation); setAction('idle'); } speak('计时已取消，想开始时再叫我。'); } else startTimer(); }
  async function toggleWander() { if (!window.desktop) { speak('在桌面应用里，我就可以在你的桌面走来走去啦。'); return; } try { await window.desktop.wander(!desktopState.wandering); } catch { notify('暂时无法切换走动状态。'); } }
  function startGame(kind: GameKind) {
    if(petRef.current?.activity){notify('先结束当前课程或工作吧。');return;}
    if (floating) { void enterHome('games'); return; }
    if (petRef.current?.sleeping) { notify('先轻轻叫醒拉姆吧。'); return; }
    setGame(kind);
  }
  async function abandonPet() {
    const saved = petRef.current; if (!saved) return;
    importSequence.current++;
    clearInvitation();awaitingAdoption.current = true; petRef.current = null; touches.current = []; dizzyUntil.current = 0;
    try { localStorage.removeItem(SAVE_KEY); localStorage.removeItem(memoryKey(saved)); localStorage.removeItem(presenceKey(saved)); }
    catch { awaitingAdoption.current = false; petRef.current = saved; notify('暂时无法移除存档，请稍后重试。'); return; }
    pendingCareFeedback.current=null;setCareFeedback(null);clearTimeout(timers.current.feedback);setPet(null); setMemory(null); setReset(false); setPanel(null); setGame(null); timer.cancel(); setPreview(false); setName('小拉姆'); setAdoptionStep('color'); setWaitingForReopen(true); setAction('idle'); setActionItemId(undefined);setActionFromColor(undefined); careUntil.current = 0;
    clearTimeout(timers.current.animation); clearTimeout(timers.current.bubble); setBubbleVisible(false); setToast('');
    window.desktop?.readyToShow(false); window.desktop?.hideToTray();
    await window.desktop?.setPetCanMove(false); await window.desktop?.setCompanionPanel(false); await window.desktop?.setPetMode(false);
    // Pending old renders cannot write through the guards above. This final
    // removal also covers a tick that was already queued before the farewell.
    try { localStorage.removeItem(SAVE_KEY); localStorage.removeItem(memoryKey(saved)); localStorage.removeItem(presenceKey(saved)); } catch { /* Initial removal succeeded. */ }
    window.desktop?.hideToTray();
  }
  function exportSave() { if (!pet) return; const url = URL.createObjectURL(new Blob([JSON.stringify({ ...pet, companionMemory: currentMemory }, null, 2)], { type: 'application/json' })); const a = document.createElement('a'); a.href = url; a.download = `ramu-${new Date().toISOString().slice(0, 10)}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); notify('存档已经导出，记得收好。'); }
  async function importSave(file?: File) {
    if (!file) return;
    const sequence=++importSequence.current,originalPetId=petRef.current?.createdAt;
    try {
      if (file.size > MAX_BACKUP_BYTES) throw Error();
      const text=await file.text();
      if(sequence!==importSequence.current||petRef.current?.createdAt!==originalPetId)return;
      const {pet:restored,memory:restoredMemory}=restorePetBackup(text,localStorage);
      clearInvitation();clearTimeout(timers.current.animation); clearTimeout(timers.current.feedback);
      careUntil.current = 0; touches.current = []; dizzyUntil.current = 0;
      pendingCareFeedback.current=null;setCareFeedback(null); setActionItemId(undefined); setActionFromColor(undefined);
      setAction('idle'); setActionId(n => n + 1); timer.cancel();
      petRef.current = restored; setPet(restored);
      setMemory(restoredMemory);
      setName(restored.name); notify('存档已恢复，欢迎回来！');
    } catch { notify('这个存档无法读取，原来的拉姆仍然保留。'); }
    if (sequence===importSequence.current&&importInput.current) importInput.current.value = '';
  }

  function completeGame(score: number): GameReceipt {
    const now = Date.now(), saved = petRef.current;
    if (!saved) return { ok: false, coins: 0, growth: 0, food: 0, message: '当前没有可领取奖励的拉姆。' };
    const safeScore = Number.isFinite(score) ? Math.floor(Math.max(0,Math.min(10,score))) : 0;
    const before = tick(saved, now), result = rewardGame(before, safeScore, now);
    const food = result.rewardItem;
    apply(result, 'reward', `我们一起在${roomMedia.background.label}完成了《${game ? GAME_LABELS[game] : '小屋游戏'}》，得到${safeScore}分，收获${result.state.coins-before.coins}摩尔豆。`);
    return { ok: result.ok, coins: result.state.coins - before.coins, growth: Math.round((result.state.growth - before.growth) * 100) / 100,
      food: food ? (result.state.inventory[food.id] ?? 0) - (before.inventory[food.id] ?? 0) : 0, itemId:food?.id, message: result.message };
  }

  const mood = getCompanionMood(currentMemory, current);
  const habits=getPetHabits(currentMemory);
  const habitText=habits.food&&habits.food.count>1?`最近熟悉的味道：${habits.food.name}`:habits.drink&&habits.drink.count>1?`最近熟悉的味道：${habits.drink.name}`:habits.play&&habits.play.count>1?`最近的小默契：${habits.play.name}`:undefined;
  const playInvitation=<PetInvitation invitation={openInvitation?{...openInvitation,text:petSpeech(current,openInvitation.text)}:null} busy={interactionBusy} petName={current.name} habitText={habitText} snoozed={snoozed} onAccept={acceptInvitation} onDefer={deferInvitation} onSuggest={suggestTogether} onCallName={callPetName} onResume={resumeCompanion}/>;
  const visitShop = () => { void enterHome('shop'); };
  const pocket=<CarePocket pet={current} initialCategory={pocketCategory} visit={pocketVisit} compact={floating} onCare={doCare} onVisitShop={visitShop} busyItemId={actionItemId} onClose={floating?()=>void openPanel(null):undefined}/>;
  useEffect(()=>{window.desktop?.updates?.setBusy(!pet||!floating||panel==='food'||panel==='play'||game!==null||timer.running||Boolean(pet?.activity)||action!=='idle'||saveError||memorySaveError)},[pet?.createdAt,floating,panel,game,timer.running,pet?.activity,action,saveError,memorySaveError]);
  const extraSettings = <><MacHelp/><UpdateSettings/><div className="life-settings">
    <label><span>允许短暂出游</span><input type="checkbox" aria-label="允许短暂出游" checked={prefs.outings} onChange={e=>setPrefs(p=>({...p,outings:e.target.checked}))}/></label>
    <label><span>自然小动作</span><input type="checkbox" aria-label="自然小动作" checked={prefs.lively} onChange={e=>setPrefs(p=>({...p,lively:e.target.checked}))}/></label>
    <label><span>拉姆音量</span><input type="range" min={0} max={100} step={1} aria-label="拉姆音量" value={Math.round(prefs.soundVolume*100)} onChange={e=>setPrefs(p=>({...p,soundVolume:Number(e.target.value)/100}))}/></label>
    <div className="effect-previews" aria-label="互动音效试听">{([['smack','吃东西'],['gulp','喝水'],['clean','洗干净'],['sparkle','眼前一亮'],['boing','蹦跳']] as const).map(([kind,label])=><button className="game-button small" key={kind} disabled={!prefs.sound||prefs.soundVolume===0} onClick={()=>playInteractionPreview(kind,true)} aria-label={`试听${label}音效`}>{label}</button>)}</div>
    <label><span>主动陪伴</span><input type="checkbox" aria-label="主动陪伴" checked={prefs.presence} onChange={e=>setPrefs(p=>({...p,presence:e.target.checked}))}/></label>
    <label><span>提示频率</span><select aria-label="主动陪伴频率" value={prefs.presenceMinutes} onChange={e=>setPrefs(p=>({...p,presenceMinutes:Number(e.target.value)}))}><option value={10}>约10分钟</option><option value={20}>约20分钟</option><option value={40}>约40分钟</option></select></label>
    <label><span>专注计时</span><input type="checkbox" aria-label="休息与喝水提醒" checked={prefs.reminders} onChange={e => setPrefs(p => ({ ...p, reminders: e.target.checked }))}/></label>
    <label><span>计时方向</span><select aria-label="计时方向" value={prefs.timerDirection} onChange={e=>setPrefs(p=>({...p,timerDirection:e.target.value as TimerDirection}))}><option value="countdown">倒数计时</option><option value="countup">正向计时</option></select></label>
    <label><span>计时时长</span><span className="reminder-interval"><input type="number" min={1} max={240} step={1} aria-label="提醒间隔" defaultValue={prefs.reminderMinutes} onBlur={e => { if (validReminderMinutes(e.target.valueAsNumber) !== e.target.valueAsNumber) e.target.value = String(prefs.reminderMinutes); }} onChange={e => { const minutes = e.target.valueAsNumber; if (Number.isInteger(minutes) && minutes >= 1 && minutes <= 240) setPrefs(p => ({ ...p, reminderMinutes: minutes })); }}/> 分钟</span></label>
    <label><span>结束提示音</span><input type="checkbox" aria-label="计时结束提示音" checked={prefs.reminderSound} onChange={e => setPrefs(p => ({...p,reminderSound:e.target.checked}))}/></label>
    <div className="timer-settings-actions"><button className="game-button small" disabled={!prefs.reminders} onClick={focusToggle}>{timer.running ? '取消计时' : '开始计时'}</button><span>{timer.running ? reminderTime(timer.seconds) : timer.finished ? '已结束，等待下次开始' : '点击开始后才计时'}</span></div>
    {memorySaveError && <p role="alert">回忆暂未保存，请导出备份。</p>}
  </div></>;
  const gameOverlay = <>{game === 'fruit' && <FruitGame costume={current.wearing} sound={prefs.sound} color={current.color} stage={stage} evolution={current.evolution} onClose={() => setGame(null)} onComplete={completeGame}/>} {game === 'memory' && <MemoryGame sound={prefs.sound} onClose={() => setGame(null)} onComplete={completeGame}/>} {game === 'treasure' && <TreasureGame costume={current.wearing} background={roomMedia.background} phase={roomMedia.phase} sound={prefs.sound} color={current.color} stage={stage} evolution={current.evolution} onClose={() => setGame(null)} onComplete={completeGame}/>} {game && !['fruit','memory','treasure'].includes(game) && <MoreGames sound={prefs.sound} kind={game as ExtraGame} onClose={() => setGame(null)} onComplete={completeGame}/>}</>;

  if (floating && pet) return <div className={petMode ? 'transparent-stage' : 'desktop-preview companion-preview'}>
    {!petMode && <div className="preview-description"><strong>拉姆 · 桌面预览</strong><span>移上来互动，点击摸摸，按住拖动。</span></div>}
    <DesktopCompanion pocketContent={pocket} moodBusy={interactionBusy} moodLabel={mood.label} onMood={respondMood} onActionEnd={finishPerformance} pet={current} stage={stage} action={timer.running && action === 'idle' ? 'focus' : renderedAction} actionId={actionId} itemId={actionItemId} fromColor={actionFromColor} bubble={spokenBubble} bubbleVisible={bubbleVisible} careFeedback={careFeedback?.petId===current.createdAt?careFeedback:null}
      panel={panel && ['food','play'].includes(panel) ? panel as CompanionPanel : null} native={petMode} desktopState={desktopState}
      sound={prefs.sound} timerDirection={prefs.timerDirection} reminderSeconds={timer.seconds} reminders={prefs.reminders} timerRunning={timer.running} saveError={saveError || memorySaveError} pocketCategory={pocketCategory} pocketVisit={pocketVisit} playInvitation={playInvitation}
      onPanel={next => { if (next === 'food') setPocketCategory('status'); void openPanel(next); }} onCare={doCare} onHome={() => void enterHome()} onWork={()=>startActivity('restaurant')} onSchool={()=>void enterHome('school')} courseCompletion={courseCompletion} onElementSkill={showElementSkill} magicLearned={learned(current,'magic')} onMagic={()=>showSkill('magic')} onShop={visitShop} onFocus={focusToggle} onSay={speak} onTug={tugReaction} onShake={showDizzy} onBubble={respondToBubble} onRecall={()=>recallPet()} onPresence={()=>tellPresence(true)} onCurious={()=>watchButterfly()} onPet={() => doCare('pet')}/>
    {toast && toast !== bubble && <div className="compact-toast" role="status">{toast}</div>}
  </div>;

  if (!pet && waitingForReopen && !window.desktop) return <div className="farewell-page"><img src="./icons/ramu.png" alt=""/><h1>好好说了再见</h1><p>这只拉姆和它的回忆已从本机移除。</p><button className="game-button" onClick={() => location.reload()}>重新打开领养处</button></div>;

  return <div className="classic-app ramu-v6">
    <header className="classic-titlebar"><div>拉姆</div><div>{window.desktop && <><button onClick={() => window.desktop?.minimize()} aria-label="最小化到托盘">－</button><button onClick={() => window.desktop?.close()} aria-label="关闭窗口">×</button></>}</div></header>
    <TimeScene media={roomMedia}>
      {pet&&<RoomFurnishingLayer pet={current} edit={panel==='decor'} onPlace={(id,x,y)=>updateFurniture(id,x,y)} hasWall={hasRoomWall(roomMedia.background.id)}/>}
      <div className="cottage-top"><div className="classic-logo"><img src="./icons/ramu.png" alt="两叶拉姆"/><span>拉姆</span></div>{pet && <div className="scene-top-actions"><button className="room-change-button" onClick={() => setPanel(p=>p==='decor'?null:'decor')}>{panel==='decor'?'完成布置':'布置小屋'}</button><button className="daily-check-in" disabled={checkedInToday(current)} onClick={checkIn} aria-label={checkedInToday(current)?"今日已签到":"每日签到领取1000摩尔豆"}>{checkedInToday(current)?"今日已签到":"签到 +1000 豆"}</button><span className="coin-sign">{current.coins} 摩尔豆</span><button className="game-button" onClick={() => void toDesktop()}>回到桌面</button></div>}</div>
      {pet && panel!=='decor' && <><button className="pet-plaque" onClick={() => setPanel('status')}><span>我的拉姆</span><strong>{current.name}</strong><small>{STAGES[stage].name} · 第 {days} 天</small></button>
        <RoomWalker stage={stage} evolution={current.evolution} blocked={interactionBusy||panel!==null||game!==null||reset}>{walkAction=><div className={`scene-pet ${current.outing?"pet-is-away":""}`}><CareFeedback feedback={panel==='food'||panel==='status'?null:careFeedback?.petId===current.createdAt?careFeedback:null}/>{bubbleVisible && <button type="button" className="scene-bubble visible" aria-label="收起拉姆提示" onClick={respondToBubble}><span role="status">{spokenBubble}</span></button>}<button className="scene-character" aria-label="摸摸拉姆" onClick={() => doCare('pet')}><Ram companionId={current.createdAt} costume={current.wearing} onActionEnd={action==='play'||isMoodAction(action)||isPastime(action)||isSchoolAction(action)?finishPerformance:undefined} sound={prefs.sound} color={current.color} stage={stage} evolution={current.evolution} action={walkAction??(timer.running && action === 'idle' ? 'focus' : renderedAction)} actionId={actionId} itemId={actionItemId} fromColor={actionFromColor} sleeping={current.sleeping}/></button><span className="scene-pet-name">{current.outing&&<button className="game-button small" onClick={()=>recallPet()}>去{current.outing.place}了 · 叫回来</button>}{current.name}<small>{current.sleeping ? '睡着了' : mood.label}</small>{current.sleeping && <button className="scene-wake" onClick={()=>doCare('sleep')}>轻轻叫醒</button>}</span></div>}</RoomWalker>
        {(current.activity||courseCompletion)&&<div className="school-scene-status">{current.activity?<ActivityCard pet={current} onCancel={stopActivity}/>:<span role="status">{courseCompletion}</span>}</div>}
        <nav className="classic-dock room-dock" aria-label="小屋功能">
          <button aria-label="我的拉姆" onClick={() => setPanel('status')}><UiArt name="status-health"/><b>状态</b></button>
          <button aria-label="打开背包" onClick={() => { setPocketCategory('food'); setPanel('food'); }}><UiArt name="toolbar-bag-normal"/><b>背包</b></button>
          <button aria-label="进入商店" onClick={() => setPanel('shop')}><UiArt name="icon-book-large"/><b>商店</b></button>
          <button aria-label="游乐时光" onClick={() => setPanel('games')}><ItemArt item={4}/><b>游戏</b></button>
          <button aria-label="进入拉姆学院" onClick={() => setPanel('school')}><UiArt name="icon-book-large"/><b>学院</b></button>
          <button aria-label="成长手册" onClick={() => setPanel('growth')}><UiArt name="sprout"/><b>成长</b></button>
          <button aria-label="照料回忆" onClick={() => setPanel('memories')}><UiArt name="icon-book-large"/><b>回忆</b></button>
          <button aria-label="拉姆小衣橱" onClick={()=>setPanel('wardrobe')}><img className="original-ui-art" src="./assets/original/wardrobe/party-cap.png" alt=""/><b>衣橱</b></button>
          <button aria-label="陪伴设置" onClick={() => setPanel('settings')}><UiArt name="icon-save"/><b>设置</b></button>
        </nav></>}
      {pet&&panel==='decor'&&<aside className="room-decor-drawer" aria-label="小屋布置工具"><header><strong>布置小屋</strong><button aria-label="完成布置" onClick={()=>setPanel(null)}>完成</button></header><RoomFurnishingEditor inline pet={current} media={roomMedia} onBuy={id=>apply(buyFurniture(petRef.current!,id))} onPlace={(id,x,y)=>updateFurniture(id,x,y)} onRemove={id=>updateFurniture(id)}/><RoomSettings media={roomMedia}/></aside>}
      <footer className="classic-footer">{saveError ? '存档未保存，请导出备份' : 'mole-baby · 本地自动保存'}<span>非官方同人桌宠</span></footer>
    </TimeScene>
    {!pet && <div className="adoption-screen"><section className="adoption-panel"><header className="adoption-header"><h1>{adoptionStep === 'color' ? '领养一只拉姆' : '给它起个名字'}</h1></header><form onSubmit={e => { if (adoptionStep === 'color') { e.preventDefault(); setAdoptionStep('name'); } else adopt(e); }}>
      {adoptionStep === 'color' ? <div className="adoption-colors">{COLORS.map(c => <button key={c.id} type="button" aria-label={`选择${c.name}拉姆`} aria-pressed={color === c.id} className={`adoption-choice ${color === c.id ? 'chosen' : ''}`} onClick={() => setColor(c.id)}><Ram color={c.id} stage={0}/><span style={{ '--swatch': c.hex } as CSSProperties}>{c.name}{color === c.id && <b>✓</b>}</span></button>)}</div>
        : <><div className="adoption-selected"><Ram color={color} stage={0}/></div><div className="adoption-name"><label htmlFor="pet-name">它的名字</label><input ref={adoptionFocus} id="pet-name" maxLength={12} value={name} onChange={e => setName(e.target.value)} placeholder="给拉姆起个名字" required autoFocus/></div></>}
      <button type="submit" className="game-button adopt-cta" disabled={adoptionStep === 'name' && !name.trim()}>{adoptionStep === 'color' ? '给它起名' : '带拉姆回家！'}</button>
      {adoptionStep === 'name' && <button type="button" className="adoption-back" onClick={() => setAdoptionStep('color')}>重新选颜色</button>}
      <p className="adoption-note">从一颗种子慢慢养大。赠送 100 摩尔豆，用品到小屋挑选。</p>
    </form></section></div>}
    {panel && panel!=='decor' && pet && <GameDialog title={titles[panel]} wide={['shop','growth','games','settings','wardrobe','status','food','memories','school'].includes(panel)} onClose={() => setPanel(null)}>
      <nav className="paper-tabs" aria-label="小屋页面">{(['status','food','shop','wardrobe','games','growth','school','memories','settings'] as const).map(p => <button key={p} onClick={() => setPanel(p)} className={panel === p ? 'active' : ''}>{({status:'状态',food:'背包',shop:'商店',games:'游戏',growth:'成长',memories:'回忆',decor:'布置',wardrobe:'衣橱',school:'学院',settings:'设置'})[p]}</button>)}</nav>
      {toast && toast !== bubble && <p className="panel-feedback" role="status">{toast}</p>}
      {panel === 'shop' && <ShopBook pet={current} onBuy={buy}/>}
      {panel === 'wardrobe' && <Wardrobe pet={current} onBuy={id=>changeOutfit('buy',id)} onWear={id=>changeOutfit('wear',id)}/>}
      {panel==='school'&&<RamSchoolPanel busy={schoolBusy} pet={current} onLearn={id=>startActivity('course',id)} onSkill={showSkill} onElementSkill={showElementSkill} onCancel={stopActivity}/>}
      {panel === 'games' && <><RestaurantCard pet={current} onStart={()=>startActivity('restaurant')} onCancel={stopActivity}/><PetPastimes pet={current} busy={Boolean(current.activity)||timer.running||Date.now()<careUntil.current} onPlay={startPastime} onSleep={()=>doCare('sleep')} onOuting={()=>startOuting(true)} onRecall={()=>recallPet()}/><div className="room-game-grid">{([
        { id:'fruit',name:'拉姆接果子',icon:'180027',detail:'20 秒 · 接住果子',button:'开始接果子',grown:true },
        { id:'memory',name:'口袋翻翻乐',icon:'180017',detail:'45 秒 · 找到相同图案',button:'开始翻牌',grown:false },
        { id:'rhythm',name:'拉姆拍拍乐',icon:'180004',detail:'20 秒 · 跟着节拍',button:'开始拍拍乐',grown:false },
        { id:'orchard',name:'草地采果',icon:'180028',detail:'15 秒 · 眼明手快',button:'开始采果',grown:false },
        { id:'puzzle',name:'小屋拼拼乐',icon:'180070',detail:'九宫格 · 拼好小屋',button:'开始拼图',grown:false },
        { id:'treasure',name:'小屋寻宝',icon:'180027',detail:'不限时 · 和拉姆找宝物',button:'开始寻宝',grown:false },
      ] as const).map(g => <article key={g.id}><img src={`./assets/original/items/${g.icon}.png`} alt=""/><h3>{g.name}</h3><p>{g.detail}</p><button className="game-button" disabled={Boolean(current.activity) || current.sleeping || (g.grown && stage === 0)} onClick={() => startGame(g.id)}>{g.button}</button></article>)}</div><p className="room-game-note">玩一局赚摩尔豆和用品。{current.sleeping ? '拉姆在休息，先叫醒它吧。' : ''}</p></>}
      {panel === 'growth' && <><div className="classic-stage-grid">{STAGES.map((s,i) => <article key={s.name} className={stage === i ? 'current-stage' : ''}><div><Ram costume={current.wearing} color={current.color} stage={i as 0|1|2|3|4} evolution={i === 4 ? current.evolution ?? evolutionChoice : undefined}/></div><h3>{s.name}</h3><span>{stage === i ? '现在的我' : stage > i ? '一起走过' : `约 ${GROWTH_STAGE_HOURS[i - 1]} 小时`}</span></article>)}</div><div className="slow-growth"><h3>慢慢长大，长久陪伴</h3><p>种子到初级约 1 天，再到中级约 3 天，高级再约 7 天；高级后再健康陪伴 7 天，可选择神力形态。</p><p>只累计状态良好时的真实陪伴；摸摸、喂食和游戏都不会让成长跳级。</p><progress max={100} value={progress}/><span>{nextStage ? `距${nextStage.name}的健康陪伴进度 ${Math.floor(progress)}%` : current.evolution ? '已经长成神力拉姆啦' : '可以选择神力形态啦'}</span></div></>}
      {panel === 'growth' && <section className="evolution-selection" aria-label="神力进化">
        <h3>{current.evolution ? EVOLUTIONS.find(form => form.id === current.evolution)?.name : '选择未来的神力形态'}</h3>
        <div className="evolution-grid">{EVOLUTIONS.map(form => <button key={form.id} type="button" aria-label={`选择${form.name}`} aria-pressed={(current.evolution ?? evolutionChoice) === form.id} disabled={Boolean(current.evolution)} onClick={() => setEvolutionChoice(form.id)}><Ram costume={current.wearing} color={current.color} stage={4} evolution={form.id} action="still"/><b>{form.name}</b></button>)}</div>
        {!current.evolution && <button className="game-button" disabled={current.growth < GROWTH_MAX || current.sleeping} onClick={() => { if (petRef.current) apply(evolvePet(petRef.current, evolutionChoice), 'happy', `我选择成为${EVOLUTIONS.find(form => form.id === evolutionChoice)?.name}。`); }}>{current.growth < GROWTH_MAX ? '健康成长后开启' : current.sleeping ? '先叫醒拉姆' : '确认进化'}</button>}
        <p>神力形态选择后保留。身体颜色、名字和我们的回忆都会一直在。</p>
      </section>}
      {panel === 'status' && <RoomPetPanel pet={current} memory={currentMemory} onRename={renamePet} onWake={()=>doCare('sleep')} onMood={respondMood}/>}
      {panel === 'food' && pocket}
      {panel === 'memories' && <PetDiary memory={currentMemory}/>}
      {panel === 'play' && <>{playInvitation}<div className="panel-shortcuts"><button className="game-button" onClick={() => doCare('play')}>一起玩球</button><button className="game-button" disabled={current.sleeping} onClick={respondMood}>看看我的心情</button><button className="game-button" onClick={() => startActivity('restaurant')}>餐厅打工</button><button className="game-button" onClick={() => doCare('sleep')}>{current.sleeping?'轻轻叫醒':'睡一会儿'}</button><button className="game-button" onClick={() => setPanel('school')}>去学院</button><button className="game-button" onClick={() => setPanel('games')}>去游戏屋</button></div></>}
      {panel === 'settings' && <><section className="room-preferences"><form className="room-rename" onSubmit={e => { e.preventDefault(); if (name.trim()) { setPet(p => p ? { ...p, name: name.trim().slice(0,12) } : p); notify('名字保存好啦。'); } }}><label htmlFor="rename">拉姆的名字</label><input id="rename" aria-label="拉姆的新名字" value={name} maxLength={12} onChange={e => setName(e.target.value)}/><button className="game-button small" disabled={!name.trim()}>保存</button></form>
        {([['安静陪伴',prefs.quiet,() => setPrefs(p => ({...p,quiet:!p.quiet})),false],['互动音效',prefs.sound,() => setPrefs(p => ({...p,sound:!p.sound})),false],['桌面散步',desktopState.wandering,() => void toggleWander(),!window.desktop],['角落躲藏',desktopState.edgeHiding,() => void window.desktop?.setEdgeHiding(!desktopState.edgeHiding),!window.desktop]] as const).map(([label,checked,callback,disabled]) => <label className="room-toggle-row" key={label}><span>{label}</span><button role="switch" aria-label={label} aria-checked={checked} disabled={disabled} onClick={callback}>{checked ? '开启' : '关闭'}</button></label>)}
        <div className="room-backup"><button className="game-button small" onClick={exportSave}>导出存档</button><button className="game-button small" onClick={() => importInput.current?.click()}>导入存档</button><input ref={importInput} hidden type="file" accept="application/json,.json" onChange={e => void importSave(e.target.files?.[0])}/><button className="plain-danger" onClick={() => setReset(true)}>送别拉姆</button></div></section><section className="life-settings" aria-label="背景音乐设置"><h3>背景音乐</h3><label>播放音乐<input type="checkbox" aria-label="播放背景音乐" checked={roomMedia.settings.musicEnabled} onChange={e=>roomMedia.update({musicEnabled:e.target.checked})}/></label><label>允许后台播放（桌面和托盘）<input type="checkbox" aria-label="允许后台播放音乐" checked={roomMedia.settings.backgroundPlayback} onChange={e=>roomMedia.update({backgroundPlayback:e.target.checked})}/></label><button className="game-button small" onClick={()=>setPanel('decor')}>选择配乐</button></section><StageSettings pet={current} onChange={chooseStage}/>{extraSettings}</>}
    </GameDialog>}
    {reset && pet && <GameDialog title="和拉姆说再见？" onClose={() => setReset(false)}><div className="farewell-confirm"><div><Ram costume={current.wearing} color={current.color} stage={stage} evolution={current.evolution}/></div><h3>送别 {current.name}</h3><p>这会删除它的成长、物品和本机回忆。重新打开后，可以领养一颗新的种子。</p><div className="confirm-buttons"><button className="game-button" onClick={exportSave}>先导出存档</button><button className="game-button" onClick={() => void abandonPet()}>确认送别</button></div></div></GameDialog>}
    {gameOverlay}
  </div>;
}
