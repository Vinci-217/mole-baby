import {useEffect, useRef, useState} from 'react';
import {ROOM_MUSIC, type RoomMediaController, type RoomMusicMode} from '../room-media';
import {furnitureImage, MUSIC_BOX_ID} from '../room-furnishings';
import SettingsSwitch from './SettingsSwitch';
import './RoomMusicBox.css';

export default function RoomMusicBox({media, webEdition}: {
  media: RoomMediaController;
  webEdition: boolean;
}) {
  const list = useRef<HTMLDivElement>(null);
  const [ordering, setOrdering] = useState(false);
  const available = [
    ...ROOM_MUSIC,
    ...(media.customName ? [{id: 'custom', label: media.customName}] : []),
  ];
  const tracks = media.settings.musicOrder.flatMap(id => available.filter(track => track.id === id));
  const current = tracks.find(track => track.id === media.settings.musicId) ?? tracks[0];
  useEffect(() => {
    const tray = list.current;
    const track = tray?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (!tray || !track) return;
    const bounds = tray.getBoundingClientRect();
    const row = track.getBoundingClientRect();
    if (row.bottom > bounds.bottom) tray.scrollTop += row.bottom - bounds.bottom + 4;
    else if (row.top < bounds.top) tray.scrollTop += row.top - bounds.top - 4;
  }, [current.id]);

  function moveTrack(id:string, step:number) {
    const order = [...media.settings.musicOrder];
    const position = tracks.findIndex(track => track.id === id);
    const neighbor = tracks[position + step];
    if (!neighbor) return;
    order.splice(order.indexOf(id), 1);
    order.splice(order.indexOf(neighbor.id) + (step > 0 ? 1 : 0), 0, id);
    media.update({musicOrder: order});
  }

  return <div className="room-music-controls">
  <div className="music-box-player">
    <div className="music-box-current">
      <img src={furnitureImage(MUSIC_BOX_ID)} alt="" draggable={false}/>
      <div className="music-box-now" aria-live="polite">
        <span>{!media.settings.musicEnabled ? '背景音乐已关闭' : media.playing ? '正在播放' : '已选曲目'}</span>
        <strong>{current.label}</strong>
        {'also' in current && <small>{current.also}</small>}
      </div>
      <div className="music-box-actions">
        {media.settings.musicEnabled && !media.playing && !media.error &&
          <button className="game-button small" onClick={media.resumeMusic}>播放</button>}
        <button className="game-button small" onClick={media.nextMusic}>下一首</button>
      </div>
      {media.error && <p role="status">{media.error}</p>}
    </div>
    <div className="music-box-playlist">
      <div className="music-box-playlist-heading">
        <strong>播放列表</strong>
        <button className="game-button small" type="button" aria-pressed={ordering} onClick={() => setOrdering(value => !value)}>{ordering ? '完成排序' : '调整顺序'}</button>
      </div>
      <div ref={list} className="music-box-tracks" role="group" aria-label="选择背景音乐">
      {tracks.map((track,index) => <div key={track.id} className="music-box-track-row"><button className="music-track-select" type="button" aria-label={track.label}
        aria-pressed={current.id === track.id}
        onClick={() => current.id === track.id ? media.resumeMusic() : media.update({musicId: track.id})}>
        <span aria-hidden="true">{current.id === track.id ? '♪' : '♩'}</span>
        <span>{track.label}</span>
        {current.id === track.id && <b aria-hidden="true">✓</b>}
      </button>{ordering && <div className="music-track-order">
        <button type="button" aria-label={`上移${track.label}`} disabled={index===0} onClick={() => moveTrack(track.id,-1)}>↑</button>
        <button type="button" aria-label={`下移${track.label}`} disabled={index===tracks.length-1} onClick={() => moveTrack(track.id,1)}>↓</button>
      </div>}</div>)}
      </div>
    </div>
  </div>
  <div className="music-box-options">
    <RoomMusicOptions media={media} webEdition={webEdition}/>
  </div>
  </div>;
}

function RoomMusicOptions({media, webEdition}: {
  media: RoomMediaController;
  webEdition: boolean;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function importFile(file?: File) {
    if (!file) return;
    setBusy(true);
    setMessage('');
    try {
      await media.importMusic(file);
      setMessage('音乐已保存在这台电脑。');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '音乐导入失败，请重新选择。');
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  }

  async function removeFile() {
    setBusy(true);
    setMessage('');
    try {
      await media.removeMusic();
      setMessage('已删除本地音乐。');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '删除失败，请稍后重试。');
    } finally {
      setBusy(false);
    }
  }

  const backgroundLabel = webEdition ? '允许后台播放（以浏览器支持为准）'
    : window.mobile ? '允许后台播放（悬浮陪伴和后台）' : '允许后台播放（桌面和托盘）';
  const volume = Math.round(media.settings.volume * 100);
  return <>
    <SettingsSwitch label="播放音乐" ariaLabel="播放背景音乐"
      checked={media.settings.musicEnabled} onChange={musicEnabled => media.update({musicEnabled})}/>
    <SettingsSwitch label={backgroundLabel} ariaLabel="允许后台播放音乐"
      checked={media.settings.backgroundPlayback} onChange={backgroundPlayback => media.update({backgroundPlayback})}/>
    <label className="settings-row music-playback-mode">
      <span>播放方式</span>
      <select aria-label="背景音乐播放方式" value={media.settings.musicMode}
        onChange={event => media.update({musicMode: event.target.value as RoomMusicMode})}>
        <option value="repeat">单曲循环</option>
        <option value="sequence">顺序播放</option>
        <option value="shuffle">随机播放</option>
      </select>
    </label>
    <label className="settings-row music-volume-setting">
      <span>背景音乐音量</span>
      <input type="range" min="0" max="100" aria-label="背景音乐音量" value={volume}
        onChange={event => media.update({volume: Number(event.target.value) / 100})}/>
      <output>{volume}%</output>
    </label>
    <div className="settings-actions">
      <button className="game-button small" type="button" disabled={busy} onClick={() => fileInput.current?.click()}>
        {busy ? '正在保存…' : '换成我的音乐'}
      </button>
      {media.customName && <button className="game-button small" type="button" disabled={busy} onClick={() => void removeFile()}>删除本地音乐</button>}
      <input ref={fileInput} hidden type="file" accept="audio/*,.mp3,.wav,.ogg,.m4a,.aac,.flac,.webm"
        onChange={event => void importFile(event.target.files?.[0])}/>
    </div>
    {(message || media.error) && <p className="settings-hint" role="status">{message || media.error}</p>}
  </>;
}
