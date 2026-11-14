import type {RefObject} from 'react';
import type {PetColor,Stage,Evolution} from '../game';
import type {PetGaze} from '../pet-attention';
import type {PetEdge} from '../edge-motion';

export interface RamProps {
  color: PetColor
  costume?: string
  companionId?: number
  stage: Stage
  evolution?: Evolution
  action?: string
  sleeping?: boolean
  peeking?: boolean
  peekSide?: PetEdge
  edgeEntry?: PetEdge
  fromColor?: PetColor
  sound?: boolean
  gameSound?: boolean
  soundVolume?: number
  className?: string
  /** Compatibility only: every rendering path uses original game artwork. */
  artStyle?: 'classic' | 'hd'
  actionId?: number | string
  /** The exact consumed item, retained for the whole finite care animation. */
  itemId?: string
  gaze?: RefObject<PetGaze>
  dragTilt?: number
  dragging?: boolean
  shaking?: boolean
  paused?:boolean
  rawDaily?:boolean
  onActionEnd?: (completed?:boolean) => void
}
