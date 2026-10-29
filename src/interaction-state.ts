/** A self-directed gesture should yield when the owner asks to play. */
const INTERRUPTIBLE_ACTIONS = new Set([
  'idle','still','waiting','review','focus','look-around','watch-butterfly',
  'happy','waving','mood-joy','mood-content','mood-dozy','mood-grumpy',
  'read-alone','play-alone',
]);

export interface InteractionState {
  action: string;
  timerRunning: boolean;
  careUntil: number;
  dizzyUntil: number;
}

export function animationBlockReason(state: InteractionState, now = Date.now()): string | null {
  if (state.timerRunning) return '专注计时进行中，结束计时后再一起玩吧。';
  if (now < state.dizzyUntil || state.action === 'dizzy') return '拉姆有点晕，让它缓一缓就能继续玩。';
  if (now < state.careUntil) return '正在使用用品，等这次照料结束就能一起玩。';
  if (INTERRUPTIBLE_ACTIONS.has(state.action)) return null;
  if (state.action.startsWith('uploaded-') || state.action === 'play') return '正在玩耍，等动作结束或先结束当前动作。';
  if (state.action === 'spell' || state.action.startsWith('element-') || state.action.startsWith('skill-')) return '正在展示本领，等表演结束就能继续玩。';
  return '当前动作还没结束，稍等一下就好。';
}
