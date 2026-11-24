import visibility from '../electron/edge-visibility.json';
import {registeredFrameRect} from './frame-registration';
import type {RamForm} from './original-actions';

export interface FrameClipSpec {
  assetRoot?: string;
  assetKey: string;
  form: string;
  id: string;
  frames: number;
  durationMs: number;
  width: number;
  height: number;
  registration: {
    scale: number;
    cssPixelsPerAtlasPixel: number;
    displayScale?: number;
    centerX: number;
    baseY: number;
  };
}

export interface FrameAtlasPage {
  readonly neutral: string;
  readonly mask: string;
  readonly width: number;
  readonly height: number;
}

export function frameClipFolder({assetRoot = 'uploaded-actions', assetKey}: Pick<FrameClipSpec, 'assetKey' | 'assetRoot'>) {
  return `./assets/original/${assetRoot}/${assetKey}`;
}

export function frameClipRect(spec: FrameClipSpec, form: RamForm) {
  const source = visibility.forms[spec.form as RamForm]?.body;
  const target = visibility.forms[form].body;
  const ratio = source ? (target[2] - target[0]) / (source[2] - source[0]) : 1;
  const registration = spec.registration;
  const scale = registration.cssPixelsPerAtlasPixel * (registration.displayScale ?? 1) * ratio;
  return registeredFrameRect(spec, target[3], scale);
}
