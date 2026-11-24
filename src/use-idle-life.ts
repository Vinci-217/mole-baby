import { useEffect, useRef } from 'react'
import { canShowIdleGesture, chooseScheduledIdleAction, validIdleIntervalSeconds } from './idle-behavior'
import type { GameState } from './game'
import type { CompanionMemory } from './companion-memory'
import { isPlaybackVisible, onPlaybackVisibilityChange } from './playback-visibility'
import { recordAnimationLoad } from './animation-log'

interface IdleLifeOptions {
  pet?: GameState
  memory?: CompanionMemory
  enabled: boolean
  randomMagic?: boolean
  blocked: boolean
  intervalSeconds?: number
  onAction: (action: string, sequence: number) => void
}

/** Movement, interactions and visibility suspend delivery of one pending action. */
export function useIdleLife({ pet, memory, enabled, randomMagic = false, blocked, intervalSeconds, onAction }: IdleLifeOptions) {
  const identity = pet?.createdAt
  const intervalMs = validIdleIntervalSeconds(intervalSeconds) * 1000
  const paused = blocked || !pet || !canShowIdleGesture(pet)
  const live = useRef({ pet, memory, onAction, enabled, randomMagic, paused, intervalMs })
  live.current = { pet, memory, onAction, enabled, randomMagic, paused, intervalMs }
  const dueAt = useRef<number | undefined>(undefined)
  const sequence = useRef(0)
  const previous = useRef<string | undefined>(undefined)

  useEffect(() => {
    sequence.current = 0
    previous.current = undefined
  }, [identity])
  useEffect(() => {
    dueAt.current = identity !== undefined && enabled ? performance.now() + intervalMs : undefined
  }, [identity, intervalMs, enabled])

  useEffect(() => {
    if (!enabled || paused || identity === undefined) return
    let timer: ReturnType<typeof setTimeout> | undefined

    function schedule() {
      clearTimeout(timer)
      if (!isPlaybackVisible() || dueAt.current === undefined) return
      timer = setTimeout(perform, Math.max(0, Math.ceil(dueAt.current - performance.now())))
    }

    function perform() {
      const current = live.current
      if (!isPlaybackVisible() || !current.enabled || current.paused || current.intervalMs !== intervalMs || !current.pet || current.pet.createdAt !== identity) return
      const now = performance.now()
      if (dueAt.current === undefined || now < dueAt.current) { schedule(); return }
      const action = chooseScheduledIdleAction(current.pet, current.memory, sequence.current, previous.current, Math.random, Date.now(), current.randomMagic)
      // Keep future opportunities even if the current state has no eligible clip.
      dueAt.current = now + intervalMs
      schedule()
      if (!action) return
      previous.current = action
      recordAnimationLoad({ event: 'autonomous', clip: '', name: '自然小动作', form: '', action, attempt: 0 })
      current.onAction(action, sequence.current++)
    }

    schedule()
    const stopWatching = onPlaybackVisibilityChange(schedule)
    return () => {
      clearTimeout(timer)
      stopWatching()
    }
  }, [identity, enabled, paused, intervalMs])
}
