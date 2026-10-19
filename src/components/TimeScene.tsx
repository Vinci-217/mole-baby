import type { CSSProperties, ReactNode } from 'react';
import type { RoomMediaController } from '../room-media';
import { sceneSheetPosition } from '../scene-time';
import './TimeScene.css';

/** Only the artwork is tinted. UI, pet sprites and dialog text keep their colors. */
export default function TimeScene({ media, children }: { media: RoomMediaController; children: ReactNode }) {
  const sheet = sceneSheetPosition(media.phase);
  const variables = { '--scene-x': sheet.x, '--scene-y': sheet.y } as CSSProperties;
  return <main className={`cottage-scene time-scene ${media.background.phaseSheet ? 'has-phase-art' : 'has-time-light'}`} data-background={media.background.id} data-phase={media.phase} data-time-mode={media.timeMode} style={variables}>
    <div className="time-scene-art" aria-hidden="true">
      <img className={media.background.phaseSheet ? 'time-scene-sheet' : 'time-scene-image'} src={media.background.src} alt=""/>
      {!media.background.phaseSheet && <><div className="time-scene-tint"/><div className="time-scene-window-light"/><div className="time-scene-lamp"/></>}
    </div>
    {children}
  </main>;
}
