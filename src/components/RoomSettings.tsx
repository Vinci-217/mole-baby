import { useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { ROOM_BACKGROUNDS, ROOM_MUSIC } from '../room-media';
import type { RoomMediaController } from '../room-media';
import { SCENE_PHASES, sceneSheetPosition } from '../scene-time';
import './RoomSettings.css';

export default function RoomSettings({ media }: { media: RoomMediaController }) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  async function importFile(file?: File) {
    if (!file) return;
    setBusy(true); setMessage('');
    try { await media.importMusic(file); setMessage('音乐已保存在这台电脑。'); }
    catch (error) { setMessage(error instanceof Error ? error.message : '音乐导入失败，请重新选择。'); }
    finally { setBusy(false); if (fileInput.current) fileInput.current.value = ''; }
  }
  async function removeFile() {
    setBusy(true); setMessage('');
    try { await media.removeMusic(); setMessage('已删除本地音乐。'); }
    catch (error) { setMessage(error instanceof Error ? error.message : '删除失败，请稍后重试。'); }
    finally { setBusy(false); }
  }
  return <section className="room-settings" aria-label="小屋布置与音乐">
    <h3>小屋布置</h3>
    <div className="room-background-options" role="group" aria-label="选择小屋背景">
      {ROOM_BACKGROUNDS.map(background => <button type="button" key={background.id} aria-pressed={media.settings.backgroundId === background.id} onClick={() => media.update({ backgroundId: background.id })}>
        <span className={`room-background-thumb ${background.phaseSheet ? 'is-phase-sheet' : ''}`} style={{ '--scene-x': sceneSheetPosition(media.phase).x, '--scene-y': sceneSheetPosition(media.phase).y } as CSSProperties}><img alt="" src={background.src} loading="lazy"/></span><span>{background.label}</span>
      </button>)}
    </div>
    <div className="room-time-options" role="group" aria-label="小屋时段">
      <button type="button" aria-pressed={media.timeMode === 'auto'} onClick={() => media.setTimeMode('auto')}>跟随时间</button>
      {SCENE_PHASES.map(phase => <button type="button" key={phase.id} aria-label={`预览${phase.label}`} aria-pressed={media.timeMode === phase.id} onClick={() => media.setTimeMode(phase.id)}>{phase.label}</button>)}
    </div>
    <p className="room-time-status">{media.timeMode === 'auto' ? `现在是${SCENE_PHASES.find(phase => phase.id === media.localPhase)?.label}，小屋与你一起作息。` : '正在预览。点击“跟随时间”回到现在。'}</p>
    <h3>小屋音乐</h3>
    <label className="room-music-switch"><span>进入小屋时播放</span><input type="checkbox" aria-label="小屋背景音乐" checked={media.settings.musicEnabled} onChange={event => media.update({ musicEnabled: event.target.checked })}/></label>
    <div className="room-track-list" role="group" aria-label="选择背景音乐">
      {ROOM_MUSIC.map(track => <button type="button" key={track.id} aria-pressed={media.settings.musicId === track.id} title={'also' in track ? `${track.label} · ${track.also}` : track.label} onClick={() => media.update({ musicId: track.id })}><span aria-hidden="true">{media.settings.musicId === track.id ? '♪' : '♩'}</span>{track.label}</button>)}
      {media.customName && <button type="button" className="room-custom-track" aria-pressed={media.settings.musicId === 'custom'} onClick={() => media.update({ musicId: 'custom' })}><span aria-hidden="true">♪</span>{media.customName}</button>}
    </div>
    <label className="room-volume">音量<input type="range" min="0" max="100" aria-label="背景音乐音量" value={Math.round(media.settings.volume * 100)} onChange={event => media.update({ volume: Number(event.target.value) / 100 })}/><span>{Math.round(media.settings.volume * 100)}%</span></label>
    <div className="room-music-import"><button type="button" disabled={busy} onClick={() => fileInput.current?.click()}>{busy ? '正在保存…' : '换成我的音乐'}</button>{media.customName && <button type="button" disabled={busy} onClick={() => void removeFile()}>删除本地音乐</button>}<input ref={fileInput} hidden type="file" accept="audio/*,.mp3,.wav,.ogg,.m4a,.aac,.flac,.webm" onChange={event => void importFile(event.target.files?.[0])}/></div>
    <p className="room-music-note">12 首原页游配乐 · 离开小屋自动暂停</p>
    {media.inRoom && media.settings.musicEnabled && !media.playing && !media.error && <button className="room-play-music" type="button" onClick={media.resumeMusic}>播放音乐</button>}
    {(message || media.error) && <p className="room-music-message" role="status">{message || media.error}</p>}
  </section>;
}
