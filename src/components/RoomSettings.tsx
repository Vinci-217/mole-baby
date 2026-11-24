import {useEffect, useRef, type CSSProperties} from 'react';
import {ROOM_BACKGROUNDS, type RoomMediaController} from '../room-media';
import {SCENE_PHASES, sceneSheetPosition} from '../scene-time';
import './RoomSettings.css';

export default function RoomSettings({media}: {media: RoomMediaController}) {
  const backgrounds = useRef<HTMLDivElement>(null);
  const sheet = sceneSheetPosition(media.phase);

  useEffect(() => {
    const list = backgrounds.current;
    const selected = list?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (!list || !selected) return;
    const bounds = list.getBoundingClientRect();
    const card = selected.getBoundingClientRect();
    if (card.right > bounds.right) list.scrollLeft += card.right - bounds.right + 4;
    else if (card.left < bounds.left) list.scrollLeft += card.left - bounds.left - 4;
  }, [media.settings.backgroundId]);

  return <section className="room-settings" aria-label="小屋风景">
    <div className="room-time-options" role="group" aria-label="小屋时段">
      <button type="button" aria-pressed={media.timeMode === 'auto'} onClick={() => media.setTimeMode('auto')}>跟随时间</button>
      {SCENE_PHASES.map(phase => <button type="button" key={phase.id} aria-label={`预览${phase.label}`}
        aria-pressed={media.timeMode === phase.id} onClick={() => media.setTimeMode(phase.id)}>{phase.label}</button>)}
    </div>
    <div ref={backgrounds} className="room-background-options" role="group" aria-label="选择小屋背景" aria-description="可以左右滑动浏览。">
      {ROOM_BACKGROUNDS.map(background => {
        const selected = media.settings.backgroundId === background.id;
        return <button type="button" key={background.id} aria-label={background.label} aria-pressed={selected}
          onClick={() => media.update({backgroundId: background.id})}>
          <span className={`room-background-thumb ${background.phaseSheet ? 'is-phase-sheet' : ''}`}
            data-phase={media.phase} style={{'--scene-x': sheet.x, '--scene-y': sheet.y} as CSSProperties}>
            <img alt="" src={background.src} loading="lazy" draggable={false}/>
            {!background.phaseSheet && <span className="room-thumb-time-tint"/>}
          </span>
          <span className="room-background-label">{background.label}{selected && <b aria-hidden="true">✓</b>}</span>
        </button>;
      })}
    </div>
  </section>;
}
