import { useEffect, useRef, useState } from 'react';

export function validReminderMinutes(value: unknown): number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 240 ? value : 40;
}
export function reminderTime(seconds: number): string {
  return `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`;
}

/** A manual, one-shot timer. Pet sleep/quiet mode never changes its deadline.
 * Reopening, changing pets/duration or disabling reminders returns to idle. */
export function useRestReminder(petId: number | undefined, enabled: boolean, minutes: number, onDue: () => void) {
  const duration = validReminderMinutes(minutes) * 60000;
  const callback = useRef(onDue); callback.current = onDue;
  const [deadline, setDeadline] = useState<number | null>(null);
  const [seconds, setSeconds] = useState(duration / 1000);
  const [finished, setFinished] = useState(false);
  const generation = useRef(0);
  const cancel = () => { generation.current++; setDeadline(null); setFinished(false); setSeconds(duration / 1000); };
  const start = () => {
    if (petId === undefined || !enabled) return;
    generation.current++; setFinished(false); setSeconds(duration / 1000); setDeadline(Date.now() + duration);
  };
  useEffect(() => { generation.current++; setDeadline(null); setFinished(false); setSeconds(duration / 1000); }, [petId, enabled, duration]);
  useEffect(() => {
    if (deadline === null) return;
    const token = generation.current;
    let fired = false;
    const due = () => {
      if (fired || token !== generation.current) return;
      fired = true; setSeconds(0); setDeadline(null); setFinished(true); callback.current();
    };
    const update = () => { if (token === generation.current) setSeconds(Math.max(0, Math.ceil((deadline - Date.now()) / 1000))); };
    update();
    const interval = setInterval(update, 1000);
    const timeout = setTimeout(due, Math.max(0, deadline - Date.now()));
    return () => { clearTimeout(timeout); clearInterval(interval); };
  }, [deadline]);
  return { seconds, running: deadline !== null, finished, start, cancel };
}
