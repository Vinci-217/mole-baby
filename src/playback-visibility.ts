// The Windows desktop window can stay on screen with another app in focus.
// Use its native visibility for both the scheduler and its players.
const nativeVisibilityEvent = 'ramu-native-playback-visibility';
let nativeVisible: boolean | undefined;

export function setNativePlaybackVisibility(visible: boolean | undefined) {
  if (nativeVisible === visible) return;
  nativeVisible = visible;
  document.dispatchEvent(new Event(nativeVisibilityEvent));
}

export function nativePlaybackVisibility() {
  return nativeVisible;
}

export function isPlaybackVisible() {
  return nativeVisible ?? !document.hidden;
}

export function onPlaybackVisibilityChange(listener: () => void) {
  document.addEventListener(nativeVisibilityEvent, listener);
  document.addEventListener('visibilitychange', listener);
  return () => {
    document.removeEventListener(nativeVisibilityEvent, listener);
    document.removeEventListener('visibilitychange', listener);
  };
}
