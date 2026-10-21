import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { ROOM_BACKGROUNDS, ROOM_MUSIC } from '../room-media';
import type { RoomMediaController } from '../room-media';
import { SCENE_PHASES, sceneSheetPosition } from '../scene-time';
import './RoomSettings.css';

export default function RoomSettings({ media }: { media: RoomMediaController }) {
  const fileInput = useRef<HTMLInputElement>(null);
  const backgroundList = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const phaseLabel = SCENE_PHASES.find(phase => phase.id === media.phase)?.label;
  const selectedTrack = media.settings.musicId === 'custom' && media.customName
    ? media.customName : ROOM_MUSIC.find(track => track.id === media.settings.musicId)?.label ?? ROOM_MUSIC[0].label;
  useEffect(() => {
    // Reveal the saved choice within the gallery, without moving the whole dialog.
    const list = backgroundList.current;
    const selected = list?.querySelector<HTMLButtonElement>('[aria-pressed="true"]');
    if (!list || !selected) return;
    const bounds = list.getBoundingClientRect(), card = selected.getBoundingClientRect();
    if (card.bottom > bounds.bottom) list.scrollTop += card.bottom - bounds.bottom + 4;
    else if (card.top < bounds.top) list.scrollTop -= bounds.top - card.top + 4;
  }, [media.settings.backgroundId]);
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
    <div className="room-decoration-section">
      <header className="room-section-heading"><h3>选一处喜欢的风景</h3><span className="room-selection-label">{media.background.label} · {ROOM_BACKGROUNDS.length}处可选</span></header>
      <div className="room-time-row">
        <div className="room-time-options" role="group" aria-label="小屋时段">
          <button type="button" aria-pressed={media.timeMode === 'auto'} onClick={() => media.setTimeMode('auto')}>跟随时间</button>
          {SCENE_PHASES.map(phase => <button type="button" key={phase.id} aria-label={`预览${phase.label}`} aria-pressed={media.timeMode === phase.id} onClick={() => media.setTimeMode(phase.id)}>{phase.label}</button>)}
        </div>
        <p className="room-time-status" role="status">{media.timeMode === 'auto' ? '本地时间' : '时段预览'} · {phaseLabel}</p>
      </div>
      <div ref={backgroundList} className="room-background-options" role="group" aria-label="选择小屋背景" aria-description={`共${ROOM_BACKGROUNDS.length}处风景，可上下滚动浏览。`}>
        {ROOM_BACKGROUNDS.map(background => {
          const selected = media.settings.backgroundId === background.id;
          return <button type="button" key={background.id} aria-label={background.label} aria-pressed={selected} onClick={() => media.update({ backgroundId: background.id })}>
            <span className={`room-background-thumb ${background.phaseSheet ? 'is-phase-sheet' : ''}`} data-phase={media.phase} style={{ '--scene-x': sceneSheetPosition(media.phase).x, '--scene-y': sceneSheetPosition(media.phase).y } as CSSProperties}><img alt="" src={background.src} loading="lazy"/>{!background.phaseSheet && <span className="room-thumb-time-tint"/>}</span>
            <span className="room-background-label"><span>{background.label}</span>{selected && <b aria-hidden="true">✓ 已选</b>}</span>
          </button>;
        })}
      </div>
    </div>
    <div className="room-music-section">
      <header className="room-section-heading"><h3>熟悉的旋律</h3><span>{ROOM_MUSIC.length} 首经典配乐</span></header>
      <div className="room-music-current">
        <span className="room-music-disc" aria-hidden="true">♪</span>
        <div className="room-now-playing" aria-live="polite"><span>{!media.settings.musicEnabled ? '配乐已关闭' : media.playing ? '正在播放' : '已选配乐'}</span><strong title={selectedTrack}>{selectedTrack}</strong></div>
        <label className="room-music-switch"><span>进入小屋时播放</span><input type="checkbox" aria-label="小屋背景音乐" checked={media.settings.musicEnabled} onChange={event => media.update({ musicEnabled: event.target.checked })}/></label>
      </div>
      <div className="room-track-list" role="group" aria-label="选择背景音乐">
        {ROOM_MUSIC.map(track => <button type="button" key={track.id} aria-label={track.label} aria-pressed={media.settings.musicId === track.id} title={'also' in track ? `${track.label} · ${track.also}` : track.label} onClick={() => media.update({ musicId: track.id })}><span aria-hidden="true">{media.settings.musicId === track.id ? '♪' : '♩'}</span><span className="room-track-name">{track.label}</span></button>)}
        {media.customName && <button type="button" className="room-custom-track" aria-label={media.customName} aria-pressed={media.settings.musicId === 'custom'} onClick={() => media.update({ musicId: 'custom' })}><span aria-hidden="true">♪</span><span className="room-track-name">{media.customName}</span></button>}
      </div>
      <label className="room-volume">音量<input type="range" min="0" max="100" aria-label="背景音乐音量" value={Math.round(media.settings.volume * 100)} onChange={event => media.update({ volume: Number(event.target.value) / 100 })}/><span>{Math.round(media.settings.volume * 100)}%</span></label>
      <div className="room-music-import"><button type="button" disabled={busy} onClick={() => fileInput.current?.click()}>{busy ? '正在保存…' : '换成我的音乐'}</button>{media.customName && <button type="button" disabled={busy} onClick={() => void removeFile()}>删除本地音乐</button>}{media.inRoom && media.settings.musicEnabled && !media.playing && !media.error && <button className="room-play-music" type="button" onClick={media.resumeMusic}>播放音乐</button>}<input ref={fileInput} hidden type="file" accept="audio/*,.mp3,.wav,.ogg,.m4a,.aac,.flac,.webm" onChange={event => void importFile(event.target.files?.[0])}/><span className="room-music-note">离开小屋自动暂停</span></div>
      {(message || media.error) && <p className="room-music-message" role="status">{message || media.error}</p>}
    </div>
  </section>;
}
