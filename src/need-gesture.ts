import type {PetStats} from './game';
import type {RamForm} from './original-actions';

export const NEED_GESTURE_DURATION = 3600;
const gestures = {
  'ambient-hungry': {condition:'hungry', label:'肚子饿了', image:'./assets/original/ui/icon-food.png'},
  'ambient-thirsty': {condition:'thirsty', label:'口渴了', image:'./assets/original/ui/icon-water.png'},
} as const;

type NeedGesture = keyof typeof gestures;

export function needGesture(action: string) {
  return Object.hasOwn(gestures,action) ? gestures[action as NeedGesture] : undefined;
}

export function chooseNeedGesture(stats: PetStats, previous?: string): NeedGesture | undefined {
  const hungry = stats.hunger < 30;
  const thirsty = stats.thirst < 30;
  if (hungry && thirsty) {
    if (previous === 'ambient-hungry') return 'ambient-thirsty';
    if (previous === 'ambient-thirsty') return 'ambient-hungry';
    return stats.thirst < stats.hunger ? 'ambient-thirsty' : 'ambient-hungry';
  }
  const action = hungry ? 'ambient-hungry' : thirsty ? 'ambient-thirsty' : undefined;
  return action === previous ? undefined : action;
}

/** The condition atlas contains source rows for these three forms. */
export const hasOriginalNeedFrames = (form: RamForm) => ['junior','middle','senior'].includes(form);
