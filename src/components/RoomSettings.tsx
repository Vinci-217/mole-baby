import { useRef, useState } from 'react';
import { ROOM_BACKGROUNDS, ROOM_MUSIC } from '../room-media';
import type { RoomMediaController } from '../room-media';
import './RoomSettings.css';

export default function RoomSettings({ media }: { media: RoomMediaController }) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  async function importFile(file?: File) {
    if (!file) return;
    setBusy(true); setMessage('');
    try { await media.importMusic(file); setMessage('已保存在这台电脑，下次进入小屋会继续使用。'); }
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
        <img alt="" src={background.src} loading="lazy"/><span>{background.label}</span>
      </button>)}
    </div>
    <h3>小屋音乐</h3>
    <label className="room-music-switch"><span>进入小屋时播放</span><input type="checkbox" aria-label="小屋背景音乐" checked={media.settings.musicEnabled} onChange={event => media.update({ musicEnabled: event.target.checked })}/></label>
    <label className="room-music-select">曲目<select aria-label="选择背景音乐" value={media.settings.musicId === 'custom' && !media.customName ? 'castle' : media.settings.musicId} onChange={event => media.update({ musicId: event.target.value })}>
      {ROOM_MUSIC.map(track => <option key={track.id} value={track.id}>{track.label} · 原页游</option>)}
      {media.customName && <option value="custom">我的音乐 · {media.customName}</option>}
    </select></label>
    <label className="room-volume">音量<input type="range" min="0" max="100" aria-label="背景音乐音量" value={Math.round(media.settings.volume * 100)} onChange={event => media.update({ volume: Number(event.target.value) / 100 })}/><span>{Math.round(media.settings.volume * 100)}%</span></label>
    <div className="room-music-import"><button type="button" disabled={busy} onClick={() => fileInput.current?.click()}>{busy ? '正在保存…' : '换成我的音乐'}</button>{media.customName && <button type="button" disabled={busy} onClick={() => void removeFile()}>删除本地音乐</button>}<input ref={fileInput} hidden type="file" accept="audio/*,.mp3,.wav,.ogg,.m4a,.aac,.flac,.webm" onChange={event => void importFile(event.target.files?.[0])}/></div>
    <p className="room-music-note">原页游音乐已随小屋保存。也能选择 20 MB 以内的本地音频；离开小屋自动暂停，对话时会轻声播放。</p>
    {media.inRoom && media.settings.musicEnabled && !media.playing && !media.error && <button className="room-play-music" type="button" onClick={media.resumeMusic}>播放音乐</button>}
    {(message || media.error) && <p className="room-music-message" role="status">{message || media.error}</p>}
  </section>;
}
