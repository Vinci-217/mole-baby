import { useEffect, useRef, useState } from 'react';

export function validReminderMinutes(value: unknown): number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 240 ? value : 40;
}
export function reminderTime(seconds: number): string {
  return `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`;
}

/** One deadline drives both the visible clock and the reminder. Pause preserves
 * remaining time; changing the interval or adopting a pet starts a new cycle. */
export function useRestReminder(petId: number | undefined, enabled: boolean, minutes: number, paused: boolean, onDue: () => void) {
  const duration = validReminderMinutes(minutes) * 60000;
  const clock = useRef({ key: '', remaining: duration });
  const callback = useRef(onDue); callback.current = onDue;
  const [seconds, setSeconds] = useState(Math.ceil(duration / 1000));
  useEffect(() => {
    const key = `${petId}:${enabled}:${duration}`;
    if (clock.current.key !== key) clock.current = { key, remaining: duration };
    setSeconds(Math.ceil(clock.current.remaining / 1000));
    if (petId === undefined || !enabled || paused) return;
    let deadline = Date.now() + clock.current.remaining;
    let timeout: ReturnType<typeof setTimeout>;
    const due = () => {
      callback.current();
      deadline = Date.now() + duration;
      setSeconds(duration / 1000);
      timeout = setTimeout(due, duration);
    };
    timeout = setTimeout(due, clock.current.remaining);
    const interval = setInterval(() => setSeconds(Math.max(0, Math.ceil((deadline - Date.now()) / 1000))), 1000);
    return () => { clearTimeout(timeout); clearInterval(interval); clock.current.remaining = Math.max(0, deadline - Date.now()); };
  }, [petId, enabled, duration, paused]);
  return seconds;
}
