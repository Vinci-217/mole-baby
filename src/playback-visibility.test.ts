import { afterEach, expect, it, vi } from 'vitest'
import { isPlaybackVisible, onPlaybackVisibilityChange, setNativePlaybackVisibility } from './playback-visibility'

afterEach(() => {
  setNativePlaybackVisibility(undefined)
  vi.unstubAllGlobals()
})

it('follows the native desktop window through conflicting page visibility and tray transitions', () => {
  const page = Object.assign(new EventTarget(), { hidden: true })
  vi.stubGlobal('document', page)
  const changes: boolean[] = []
  const unsubscribe = onPlaybackVisibilityChange(() => changes.push(isPlaybackVisible()))

  expect(isPlaybackVisible()).toBe(false)
  setNativePlaybackVisibility(true)
  setNativePlaybackVisibility(true)
  expect(isPlaybackVisible()).toBe(true)

  page.hidden = false
  setNativePlaybackVisibility(false)
  expect(isPlaybackVisible()).toBe(false)

  setNativePlaybackVisibility(true)
  expect(changes).toEqual([true, false, true])
  unsubscribe()
  setNativePlaybackVisibility(undefined)
  expect(isPlaybackVisible()).toBe(true)
  expect(changes).toHaveLength(3)
})
