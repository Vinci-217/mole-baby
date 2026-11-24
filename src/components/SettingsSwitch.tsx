import { useRef, useState } from 'react';
import type { CSSProperties, PointerEvent } from 'react';
import './SettingsSwitch.css';

interface SettingsSwitchProps {
  label: string;
  ariaLabel?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  rowClassName?: string;
}

function pointerPosition(event: PointerEvent<HTMLButtonElement>) {
  const bounds = event.currentTarget.getBoundingClientRect();
  return Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width));
}

export default function SettingsSwitch({ label, ariaLabel = label, checked, onChange, disabled, rowClassName = 'settings-row' }: SettingsSwitchProps) {
  const pointer = useRef<{ id: number; startX: number; moved: boolean } | null>(null);
  const [dragPosition, setDragPosition] = useState<number | null>(null);

  function select(next: boolean) {
    if (!disabled && next !== checked) onChange(next);
  }

  function stopDrag(event: PointerEvent<HTMLButtonElement>) {
    if (pointer.current?.id !== event.pointerId) return;
    pointer.current = null;
    setDragPosition(null);
  }

  return <div className={`settings-switch-row ${rowClassName}`}>
    <span className="settings-switch-label">{label}</span>
    <button
      type="button"
      className="settings-slide-switch"
      role="switch"
      aria-label={ariaLabel}
      aria-checked={checked}
      disabled={disabled}
      data-dragging={dragPosition !== null || undefined}
      style={dragPosition === null ? undefined : { '--slide-position': dragPosition } as CSSProperties}
      onPointerDown={event => {
        if (disabled || !event.isPrimary || event.button !== 0) return;
        pointer.current = { id: event.pointerId, startX: event.clientX, moved: false };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={event => {
        const active = pointer.current;
        if (active?.id !== event.pointerId) return;
        active.moved ||= Math.abs(event.clientX - active.startX) >= 5;
        if (active.moved) setDragPosition(pointerPosition(event));
      }}
      onPointerUp={event => {
        const active = pointer.current;
        if (active?.id !== event.pointerId) return;
        const at = pointerPosition(event);
        const dragged = active.moved || Math.abs(event.clientX - active.startX) >= 5;
        stopDrag(event);
        select(!dragged && Math.abs(at - .5) < .05 ? !checked : at >= .5);
      }}
      onPointerCancel={stopDrag}
      onLostPointerCapture={stopDrag}
      onClick={event => {
        // Pointer releases select a side. Keyboard and assistive clicks toggle.
        if (event.detail === 0) select(!checked);
      }}
      onKeyDown={event => {
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
          event.preventDefault();
          select(event.key === 'ArrowRight');
        }
      }}
    >
      <span aria-hidden="true" className="settings-slide-off">关闭</span>
      <span aria-hidden="true" className="settings-slide-on">开启</span>
    </button>
  </div>;
}
