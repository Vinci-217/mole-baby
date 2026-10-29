import { describe, expect, it } from 'vitest';
import { animationBlockReason } from './interaction-state';
import { IDLE_ACTIONS } from './idle-behavior';

const NOW = 10000;
const idle = { action: 'idle', timerRunning: false, careUntil: 0, dizzyUntil: 0 };

describe('manual interaction takes priority over self-directed daily gestures', () => {
  it('allows manual play during reading, self-play and every passive idle gesture', () => {
    for (const action of IDLE_ACTIONS.filter(action => action !== 'spell')) {
      expect(animationBlockReason({ ...idle, action }, NOW), action).toBeNull();
    }
  });
  it('keeps an active focus timer protected but releases its last reading pose after completion', () => {
    expect(animationBlockReason({ ...idle, action: 'focus', timerRunning: true }, NOW)).toContain('专注计时');
    expect(animationBlockReason({ ...idle, action: 'focus' }, NOW)).toBeNull();
  });
  it('does not interrupt a committed care animation or dizziness with a passive pose', () => {
    expect(animationBlockReason({ ...idle, action: 'read-alone', careUntil: NOW + 1 }, NOW)).toContain('用品');
    expect(animationBlockReason({ ...idle, action: 'read-alone', dizzyUntil: NOW + 1 }, NOW)).toContain('晕');
    expect(animationBlockReason({ ...idle, action: 'read-alone', careUntil: NOW, dizzyUntil: NOW }, NOW)).toBeNull();
  });
  it('keeps finite reward-bearing and magic clips protected, including unknown future actions', () => {
    for (const action of ['play','uploaded-180004','spell','skill-magic','element-water-1','future-performance']) {
      expect(animationBlockReason({ ...idle, action }, NOW), action).toBeTruthy();
    }
  });
});
