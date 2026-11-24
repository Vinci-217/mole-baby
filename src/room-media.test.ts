import {describe, expect, it} from 'vitest';
import {nextRoomMusic, normalizeRoomMedia, ROOM_MUSIC} from './room-media';

describe('room music preferences', () => {
  it('restores the old shuffle setting and keeps default single-track playback', () => {
    expect(normalizeRoomMedia({shuffle: true}).musicMode).toBe('shuffle');
    expect(normalizeRoomMedia({}).musicMode).toBe('repeat');
  });

  it('keeps the chosen order and adds missing tracks to older playlists', () => {
    const settings = normalizeRoomMedia({musicId: 'castle', musicMode: 'sequence',
      musicOrder: ['castle', 'custom', 'clothing-shop', 'castle', 'missing']});
    expect(settings.musicOrder.slice(0, 3)).toEqual(['castle', 'custom', 'clothing-shop']);
    expect(settings.musicOrder).toHaveLength(ROOM_MUSIC.length + 1);
    expect(nextRoomMusic(settings, true)).toBe('custom');
    expect(nextRoomMusic(settings, false)).toBe('clothing-shop');
    expect(nextRoomMusic({...settings, musicId: settings.musicOrder.at(-1)!}, true)).toBe('castle');
  });

  it('excludes the active track and unavailable local music from shuffle', () => {
    const settings = normalizeRoomMedia({musicId: 'castle', musicMode: 'shuffle',
      musicOrder: ['castle', 'custom', 'clothing-shop']});
    expect(nextRoomMusic(settings, false, () => 0)).toBe('clothing-shop');
  });
});
