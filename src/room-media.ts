import { useCallback, useEffect, useRef, useState } from 'react';

export const ROOM_BACKGROUNDS = [
  { id: 'morning', label: '晨光书桌', src: './assets/generated/morning-study.png' },
  { id: 'ramu-home', label: '拉姆小屋', src: './assets/original/scenes/ramu-home.png' },
  { id: 'lake-cabin', label: '神秘湖木屋', src: './assets/original/scenes/lake-cabin.png' },
  { id: 'earthen-home', label: '树洞房', src: './assets/original/scenes/original-earthen-home.png' },
] as const;
export const ROOM_MUSIC = [
  { id: 'castle', label: '摩尔城堡', src: './assets/original/audio/castle.mp3' },
  { id: 'pet-shop', label: '宠物店', src: './assets/original/audio/pet-shop.mp3' },
  { id: 'mystery-lake', label: '神秘湖', src: './assets/original/audio/mystery-lake.mp3' },
] as const;
export interface RoomMediaPreferences {
  backgroundId: string;
  musicId: string;
  musicEnabled: boolean;
  volume: number;
}
export interface RoomMediaController {
  inRoom: boolean;
  settings: RoomMediaPreferences;
  background: (typeof ROOM_BACKGROUNDS)[number];
  customName: string | null;
  playing: boolean;
  error: string | null;
  update: (change: Partial<RoomMediaPreferences>) => void;
  importMusic: (file: File) => Promise<void>;
  removeMusic: () => Promise<void>;
  resumeMusic: () => void;
}
const STORAGE = 'ramu-room-media-v1';
const DEFAULTS: RoomMediaPreferences = { backgroundId: 'morning', musicId: 'castle', musicEnabled: true, volume: .18 };
function normalize(value: Partial<RoomMediaPreferences>): RoomMediaPreferences {
  return {
    backgroundId: ROOM_BACKGROUNDS.some(b => b.id === value.backgroundId) ? value.backgroundId! : DEFAULTS.backgroundId,
    musicId: value.musicId === 'custom' || ROOM_MUSIC.some(m => m.id === value.musicId) ? value.musicId! : DEFAULTS.musicId,
    musicEnabled: typeof value.musicEnabled === 'boolean' ? value.musicEnabled : DEFAULTS.musicEnabled,
    volume: typeof value.volume === 'number' && Number.isFinite(value.volume) ? Math.max(0, Math.min(1, value.volume)) : DEFAULTS.volume,
  };
}
function loadPreferences() {
  try { return normalize(JSON.parse(localStorage.getItem(STORAGE) || '{}') ?? {}); }
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

/** Room-only music. Blobs stay in IndexedDB; leaving the room always pauses.
 * Pass speechBusy while recording/talking to soften the music underneath it. */
export function useRoomMedia(inRoom: boolean, speechBusy = false): RoomMediaController {
  const [settings, setSettings] = useState(loadPreferences);
  const [custom, setCustom] = useState<{ name: string; url: string } | null>(null);
  const [customLoaded, setCustomLoaded] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const active = useRef(false);
  const customUrl = useRef<string | null>(null);
  const generation = useRef(0);
  active.current = inRoom && settings.musicEnabled;
  const update = useCallback((change: Partial<RoomMediaPreferences>) => {
    setSettings(previous => normalize({ ...previous, ...change }));
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
    if (!active.current || !audio.current) return;
    void audio.current.play().then(() => setError(null)).catch(reason => {
      if (reason instanceof DOMException && (reason.name === 'AbortError' || reason.name === 'NotAllowedError')) return;
      setError('这首音乐暂时无法播放，可以换一首或重新导入。');
    });
  }, []);
  const source = settings.musicId === 'custom' && custom ? custom.url : (ROOM_MUSIC.find(track => track.id === settings.musicId) ?? ROOM_MUSIC[0]).src;
  useEffect(() => {
    if (!customLoaded) return;
    const element = new Audio(source); element.loop = true; element.preload = 'metadata';
    audio.current = element;
    const started = () => setPlaying(true), stopped = () => setPlaying(false);
    const failed = () => { setPlaying(false); setError('这首音乐暂时无法播放，可以换一首或重新导入。'); };
    element.addEventListener('playing', started); element.addEventListener('pause', stopped); element.addEventListener('error', failed);
    if (active.current) resumeMusic();
    return () => {
      element.pause(); element.removeEventListener('playing', started); element.removeEventListener('pause', stopped); element.removeEventListener('error', failed);
      element.removeAttribute('src'); element.load(); if (audio.current === element) audio.current = null; setPlaying(false);
    };
  }, [source, customLoaded, resumeMusic]);
  useEffect(() => {
    if (inRoom && settings.musicEnabled) resumeMusic();
    else audio.current?.pause();
  }, [inRoom, settings.musicEnabled, resumeMusic]);
  useEffect(() => {
    if (!inRoom) return;
    const unlock = () => resumeMusic();
    document.addEventListener('pointerdown', unlock); document.addEventListener('keydown', unlock);
    return () => { document.removeEventListener('pointerdown', unlock); document.removeEventListener('keydown', unlock); };
  }, [inRoom, resumeMusic]);
  useEffect(() => {
    const adjust = () => {
      if (audio.current) audio.current.volume = settings.volume * (speechBusy || window.speechSynthesis?.speaking ? .2 : 1);
    };
    adjust();
    if (!inRoom) return;
    const timer = window.setInterval(adjust, 150);
    return () => window.clearInterval(timer);
  }, [settings.volume, speechBusy, inRoom, source, customLoaded]);
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
  return { inRoom, settings, background: ROOM_BACKGROUNDS.find(background => background.id === settings.backgroundId) ?? ROOM_BACKGROUNDS[0], customName: custom?.name ?? null, playing, error, update, importMusic, removeMusic, resumeMusic };
}
