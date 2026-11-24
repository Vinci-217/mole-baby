import index from '../public/assets/original/furniture-actions/index.json';
import {frameClipFolder,type FrameClipSpec} from './frame-clip-spec';

export interface FurnitureFramePlacement {
  left: number;
  top: number;
  width: number;
}

interface RoomFurnitureAction extends FrameClipSpec {
  label: string;
  placement: FurnitureFramePlacement;
}

export interface RoomFurniturePlayback {
  key: string;
  serial: number;
  petId: number;
  ready: boolean;
}

const motions: Record<string, RoomFurnitureAction> = index;

export const roomFurnitureAction = (id: string): RoomFurnitureAction | undefined =>
  Object.hasOwn(motions, id) ? motions[id] : undefined;
export const furnitureIdleImage = (spec: RoomFurnitureAction) => `${frameClipFolder(spec)}/idle.webp`;
