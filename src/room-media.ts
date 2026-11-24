import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocalScenePhase } from './scene-time';
import type { ScenePhase, SceneTimeMode } from './scene-time';
import originalRoomSources from '../public/assets/original/scenes/sources.json';

export interface RoomBackground { id: string; label: string; src: string; phaseSheet?: boolean }
const originalRooms=originalRoomSources.flatMap(room=>'id' in room&&typeof room.id==='string'
  ?[{id:room.id,label:room.name,src:`./assets/original/scenes/${room.file}`}]
  :[]);
export const ROOM_BACKGROUNDS: readonly RoomBackground[] = [
  { id: 'morning', label: '晨光书桌', src: './assets/generated/morning-study.png' },
  { id: 'ramu-home', label: '拉姆小屋', src: './assets/original/scenes/ramu-home.png' },
  { id:'mystery-flower-sea',label:'神秘花海',src:'./assets/original/scenes/mystery-flower-sea.png' },
  { id: 'lake-cabin', label: '神秘湖木屋', src: './assets/original/scenes/lake-cabin.png' },
  { id: 'earthen-home', label: '树洞房', src: './assets/original/scenes/original-earthen-home.png' },
  { id: 'original-160419', label: '魔法拉姆双层小屋', src: './assets/original/scenes/room-160419.png' },
  { id: 'original-160427', label: '魔法小屋', src: './assets/original/scenes/room-160427.png' },
  { id: 'original-160803', label: '航海小屋', src: './assets/original/scenes/room-160803.png' },
  { id: 'original-160815', label: '爱学习小屋', src: './assets/original/scenes/room-160815.png' },
  { id: 'original-160841', label: '爱心公主小屋', src: './assets/original/scenes/room-160841.png' },
  ...originalRooms,
  { id: 'starlight-greenhouse', label: '星光温室', src: './assets/generated/v6-starlight-greenhouse.png', phaseSheet: true },
  { id: 'creek-treehouse', label: '溪畔树屋', src: './assets/generated/v6-creek-treehouse.png', phaseSheet: true },
  { id: 'berry-picnic', label: '浆果野餐地', src: './assets/generated/v18-berry-picnic.png', phaseSheet: true },
  { id: 'seashell-cottage', label: '海风贝壳屋', src: './assets/generated/v18-seashell-cottage.png', phaseSheet: true },
  { id: 'sky-observatory', label: '晴空观星阁', src: './assets/generated/v18-sky-observatory.png', phaseSheet: true },
];
export const ROOM_MUSIC = [
  { id:'mystery-flower-sea',label:'神秘花海',src:'./assets/original/audio/mystery-flower-sea.mp3' },
  { id: 'castle', label: '摩尔城堡', also: '淘淘乐街 · 粒粒小广场', src: './assets/original/audio/castle.mp3' },
  { id: 'pet-shop', label: '宠物店', also: '摩尔餐厅 · 游戏小屋', src: './assets/original/audio/pet-shop.mp3' },
  { id: 'clothing-shop', label: '服装店', src: './assets/original/audio/clothing-shop.mp3' },
  { id: 'ramu-school', label: '拉姆学院', src: './assets/original/audio/ramu-school.mp3' },
  { id: 'snow-rink', label: '摩尔拉雅滑冰场', also: '摩尔拉雅山顶', src: './assets/original/audio/snow-rink.mp3' },
  { id: 'magic-carriage', label: '魔法马车', src: './assets/original/audio/magic-carriage.mp3' },
  { id: 'art-street', label: '咕噜艺术街', src: './assets/original/audio/art-street.mp3' },
  { id: 'church', label: '爱心教堂内', src: './assets/original/audio/church.mp3' },
  { id: 'outpost', label: '前哨站', also: '骑士要塞塔顶', src: './assets/original/audio/outpost.mp3' },
  { id: 'hunter-cabin', label: '猎人小屋', src: './assets/original/audio/hunter-cabin.mp3' },
  { id: 'castle-cellar', label: '城堡地下', src: './assets/original/audio/castle-cellar.mp3' },
  { id: 'knight-camp', label: '骑士训练场', src: './assets/original/audio/knight-camp.mp3' },
  { id: 'snow-foothills', label: '摩尔拉雅山脚', also: '交通署', src: './assets/original/audio/snow-foothills.mp3' },
] as const;
export type RoomMusicMode = 'repeat' | 'sequence' | 'shuffle';
const defaultMusicOrder = [...ROOM_MUSIC.map(track => track.id as string), 'custom'];

export function normalizeMusicOrder(value: unknown): string[] {
  const saved = Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string' && defaultMusicOrder.includes(id)) : [];
  return [...new Set([...saved, ...defaultMusicOrder])];
}

export function nextRoomMusic(settings: Pick<RoomMediaPreferences, 'musicId' | 'musicMode' | 'musicOrder'>, hasCustom: boolean, random = Math.random) {
  const tracks = settings.musicOrder.filter(id => id !== 'custom' || hasCustom);
  if (settings.musicMode !== 'shuffle') return tracks[(tracks.indexOf(settings.musicId) + 1) % tracks.length];
  const pool = tracks.filter(id => id !== settings.musicId);
  return pool[Math.floor(random() * pool.length)] ?? settings.musicId;
}
export interface RoomMediaPreferences {
  backgroundId: string;
  musicId: string;
  musicEnabled: boolean;
  backgroundPlayback: boolean;
  musicMode: RoomMusicMode;
  musicOrder: string[];
  volume: number;
}
export interface RoomMediaController {
  inRoom: boolean;
  settings: RoomMediaPreferences;
  background: RoomBackground;
  phase: ScenePhase;
  localPhase: ScenePhase;
  timeMode: SceneTimeMode;
  setTimeMode: (mode: SceneTimeMode) => void;
  customName: string | null;
  playing: boolean;
  error: string | null;
  update: (change: Partial<RoomMediaPreferences>) => void;
  importMusic: (file: File) => Promise<void>;
  removeMusic: () => Promise<void>;
  resumeMusic: () => void;
  nextMusic: () => void;
}
const STORAGE = 'ramu-room-media-v1';
const DEFAULTS: RoomMediaPreferences = { backgroundId: 'ramu-home', musicId: 'castle', musicEnabled: true, backgroundPlayback: false, musicMode: 'repeat', musicOrder: defaultMusicOrder, volume: .18 };
export function normalizeRoomMedia(value: Partial<RoomMediaPreferences> & {shuffle?: boolean}): RoomMediaPreferences {
  return {
    backgroundId: ROOM_BACKGROUNDS.some(b => b.id === value.backgroundId) ? value.backgroundId! : DEFAULTS.backgroundId,
    musicId: value.musicId === 'custom' || ROOM_MUSIC.some(m => m.id === value.musicId) ? value.musicId! : DEFAULTS.musicId,
    musicEnabled: typeof value.musicEnabled === 'boolean' ? value.musicEnabled : DEFAULTS.musicEnabled,
    backgroundPlayback: value.backgroundPlayback === true,
    musicMode: value.musicMode === 'sequence' || value.musicMode === 'shuffle' || value.musicMode === 'repeat' ? value.musicMode : value.shuffle === true ? 'shuffle' : DEFAULTS.musicMode,
    musicOrder: normalizeMusicOrder(value.musicOrder),
    volume: typeof value.volume === 'number' && Number.isFinite(value.volume) ? Math.max(0, Math.min(1, value.volume)) : DEFAULTS.volume,
  };
}
function loadPreferences() {
  try { return normalizeRoomMedia(JSON.parse(localStorage.getItem(STORAGE) || '{}') ?? {}); }
  catch { return DEFAULTS; }
}
interface LocalMusic { id: 'custom'; name: string; blob: Blob }
async function musicStore<T>(mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest<T>) {
  const database = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('ramu-local-music', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('tracks', { keyPath: 'id' });
    request.onerror = () => reject(new Error('本地音乐存储暂时不可用。'));
    request.onsuccess = () => resolve(request.result);
  });
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = database.transaction('tracks', mode);
      const request = operation(transaction.objectStore('tracks'));
      transaction.oncomplete = () => resolve(request.result);
      transaction.onerror = transaction.onabort = () => reject(new Error('本地音乐保存失败，请检查磁盘空间。'));
    });
  } finally { database.close(); }
}

/** Background playback is opt-in. Local tracks stay in IndexedDB.
 * Background music has independent volume and enable settings. */
export function useRoomMedia(inRoom: boolean, musicBoxPlaced: boolean, sceneMusic?:string): RoomMediaController {
  const [settings, setSettings] = useState(loadPreferences);
  useEffect(()=>{const restored=()=>setSettings(loadPreferences());window.addEventListener('ram-save-imported',restored);return()=>window.removeEventListener('ram-save-imported',restored)},[]);
  const localPhase = useLocalScenePhase();
  // Preview is transient. Stored preferences always follow the real local time.
  const [timeMode, setTimeMode] = useState<SceneTimeMode>('auto');
  const [custom, setCustom] = useState<{ name: string; url: string } | null>(null);
  const [customLoaded, setCustomLoaded] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const active = useRef(false);
  const nativeVisible = useRef(true);
  const nativeMinimized = useRef(false);
  const previousRoom=useRef(inRoom);
  const customUrl = useRef<string | null>(null);
  const generation = useRef(0);
  const musicAvailable = musicBoxPlaced || Boolean(sceneMusic);
  const backgroundPlayback = musicBoxPlaced && settings.backgroundPlayback;
  active.current = musicAvailable && settings.musicEnabled && (inRoom || backgroundPlayback);
  const backgroundAllowed = useRef(backgroundPlayback); backgroundAllowed.current = backgroundPlayback;
  const canPlayHere=()=>backgroundAllowed.current||
    (window.desktop?.isElectron ? nativeVisible.current||nativeMinimized.current
      : nativeVisible.current&&document.visibilityState!=='hidden');
  const volume = useRef(settings.volume); volume.current = settings.volume;
  const update = useCallback((change: Partial<RoomMediaPreferences>) => {
    setSettings(previous => normalizeRoomMedia({ ...previous, ...change }));
  }, []);
  useEffect(() => {
    try { localStorage.setItem(STORAGE, JSON.stringify(settings)); }
    catch { setError('房间设置暂时未能保存，请检查本地存储空间。'); }
  }, [settings]);
  useEffect(() => {
    let live = true;
    const loadGeneration = generation.current;
    void musicStore<LocalMusic | undefined>('readonly', store => store.get('custom')).then(record => {
      if (!live || generation.current !== loadGeneration) return;
      if (record?.blob instanceof Blob && record.blob.size && record.blob.size <= 20 * 1024 * 1024) {
        const url = URL.createObjectURL(record.blob); customUrl.current = url;
        setCustom({ name: record.name, url });
      }
    }).catch(() => { /* Built-in music also works when IndexedDB is unavailable. */ }).finally(() => { if (live) setCustomLoaded(true); });
    return () => { live = false; if (customUrl.current) URL.revokeObjectURL(customUrl.current); };
  }, []);
  const resumeMusic = useCallback(() => {
    // A room can remain mounted while the native window lives in the tray.
    // Guard every playback entry, including a track change while hidden.
    const current=audio.current;
    if (!active.current || !canPlayHere() || !current) { current?.pause(); return; }
    // Ordinary clicks and visibility changes resume; explicit room re-entry
    // rewinds below when background playback is disabled.
    void current.play().then(() => {if(audio.current===current)setError(null)}).catch(reason => {
      if(audio.current!==current)return;
      if (reason instanceof DOMException && (reason.name === 'AbortError' || reason.name === 'NotAllowedError')) return;
      setError('这首音乐暂时无法播放，可以换一首或重新导入。');
    });
  }, []);
  useEffect(()=>window.desktop?.onStateChanged(state=>{
    nativeVisible.current=state.windowVisible!==false;
    nativeMinimized.current=state.roomMinimized===true;
    resumeMusic();
  }),[resumeMusic]);
  const builtInTrack = ROOM_MUSIC.find(track => track.id === settings.musicId) ?? ROOM_MUSIC[0];
  const selectedTrack = settings.musicId === 'custom' && custom ? custom.url : builtInTrack.src;
  const source = active.current ? sceneMusic ?? (musicBoxPlaced ? selectedTrack : undefined) : undefined;
  const hasCustom = Boolean(custom);
  const nextMusic=useCallback(()=>{
    setSettings(previous=>({...previous,musicId:nextRoomMusic(previous,hasCustom)}));
  },[hasCustom]);
  const loop = Boolean(sceneMusic) || settings.musicMode === 'repeat';
  const playback = useRef({loop,nextMusic}); playback.current = {loop,nextMusic};
  const awaitingCustom=!sceneMusic&&settings.musicId==='custom'&&!customLoaded;
  useEffect(() => {
    if (!source || awaitingCustom) return;
    const element = new Audio(); element.loop = playback.current.loop; element.preload = 'metadata'; element.src=source;
    element.volume = volume.current;
    if(window.mobile){element.hidden=true;element.dataset.ramuBgm='true';document.body.appendChild(element);}
    audio.current = element;
    const started = () => {
      if (!canPlayHere() || !active.current) { element.pause(); return; }
      setPlaying(true);
    }, stopped = () => setPlaying(false);
    const failed = () => { setPlaying(false); setError('这首音乐暂时无法播放，可以换一首或重新导入。'); };
    const ended=()=>{setPlaying(false);if(!playback.current.loop&&active.current)playback.current.nextMusic()};
    element.addEventListener('ended',ended);
    element.addEventListener('playing', started); element.addEventListener('pause', stopped); element.addEventListener('error', failed);
    if (active.current) resumeMusic();
    return () => {
      element.pause(); element.removeEventListener('ended',ended); element.removeEventListener('playing', started); element.removeEventListener('pause', stopped); element.removeEventListener('error', failed);
      element.removeAttribute('src'); element.load();element.remove(); if (audio.current === element) audio.current = null; setPlaying(false);
    };
  }, [source, awaitingCustom, resumeMusic]);
  useEffect(() => { if (audio.current) audio.current.loop = loop; }, [loop]);
  useEffect(() => {
    const returning=inRoom&&!previousRoom.current;previousRoom.current=inRoom;
    if(returning&&!backgroundPlayback&&audio.current){
      audio.current.pause();try{audio.current.currentTime=0}catch{/* Metadata can still be loading. A new source already starts at zero. */}
    }
    if (active.current) resumeMusic();
    else audio.current?.pause();
  }, [inRoom, musicAvailable, settings.musicEnabled, backgroundPlayback, resumeMusic]);
  useEffect(() => {
    document.addEventListener('visibilitychange', resumeMusic);
    return () => document.removeEventListener('visibilitychange', resumeMusic);
  }, [resumeMusic]);
  useEffect(() => {
    if (!musicAvailable) return;
    const unlock = () => resumeMusic();
    document.addEventListener('pointerdown', unlock); document.addEventListener('keydown', unlock);
    return () => { document.removeEventListener('pointerdown', unlock); document.removeEventListener('keydown', unlock); };
  }, [musicAvailable, resumeMusic]);
  useEffect(() => {
    if (audio.current) audio.current.volume = settings.volume;
  }, [settings.volume]);
  const importMusic = useCallback(async (file: File) => {
    if (!file.size || file.size > 20 * 1024 * 1024) throw new Error('请选择 20 MB 以内的音频文件。');
    if (!file.type.startsWith('audio/') && !/\.(mp3|wav|ogg|m4a|aac|flac|webm)$/i.test(file.name)) throw new Error('请选择 MP3、WAV、OGG 等音频文件。');
    const candidate = URL.createObjectURL(file);
    try {
      await new Promise<void>((resolve, reject) => {
        const probe = new Audio(); const timeout = window.setTimeout(() => done(false), 7000);
        function done(ok: boolean) { clearTimeout(timeout); probe.onloadedmetadata = probe.onerror = null; probe.removeAttribute('src'); probe.load(); if (ok) resolve(); else reject(new Error('无法读取这段音频，请换一个有效的音频文件。')); }
        probe.onloadedmetadata = () => done(Number.isFinite(probe.duration) && probe.duration > 0);
        probe.onerror = () => done(false); probe.preload = 'metadata'; probe.src = candidate;
      });
      await musicStore('readwrite', store => store.put({ id: 'custom', name: file.name.slice(0, 120), blob: file } satisfies LocalMusic));
      generation.current++;
      if (customUrl.current) URL.revokeObjectURL(customUrl.current);
      customUrl.current = candidate; setCustom({ name: file.name.slice(0, 120), url: candidate });
      setCustomLoaded(true); update({ musicId: 'custom', musicEnabled: true }); setError(null);
    } catch (reason) { URL.revokeObjectURL(candidate); throw reason; }
  }, [update]);
  const removeMusic = useCallback(async () => {
    await musicStore('readwrite', store => store.delete('custom'));
    generation.current++;
    if (customUrl.current) URL.revokeObjectURL(customUrl.current);
    customUrl.current = null; setCustom(null); update({ musicId: 'castle' }); setError(null);
  }, [update]);
  return { inRoom, settings, background: ROOM_BACKGROUNDS.find(background => background.id === settings.backgroundId) ?? ROOM_BACKGROUNDS[0], phase: timeMode === 'auto' ? localPhase : timeMode, localPhase, timeMode, setTimeMode, customName: custom?.name ?? null, playing, error, update, importMusic, removeMusic, resumeMusic, nextMusic };
}
