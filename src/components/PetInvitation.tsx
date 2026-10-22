import { useEffect, useRef } from 'react';
import type { CompanionInvitation } from '../companion-invitation';
import './PetInvitation.css';

interface Props {
  invitation: CompanionInvitation | null;
  busy: boolean;
  onAccept: () => void;
  onDefer: () => void;
  onSuggest: () => void;
  onCallName: () => void;
  petName: string;
  habitText?: string;
  snoozed: boolean;
  onResume: () => void;
}

const icons = {
  ball: './assets/original/items/180004.png',
  butterfly: './assets/generated/v15-butterfly.png',
  pet: './assets/original/ui/icon-happy.png',
};

/** A small reply to the pet's invitation, alongside the existing play tools.
 * All actions and remembered experiences remain controlled by the parent. */
export default function PetInvitation({
  invitation, busy, onAccept, onDefer, onSuggest, onCallName, petName, habitText, snoozed, onResume,
}: Props) {
  const offer = useRef<HTMLDivElement>(null);
  const accept = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!invitation || !offer.current) return;
    // A new idea is inserted above the focused suggestion button. Move focus
    // before scrolling so the browser does not keep that old row anchored and
    // hide the reply buttons. Ordinary parent renders keep the user's focus.
    const target = !busy ? accept.current : offer.current;
    target?.focus({ preventScroll: true });
    offer.current.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'auto' });
  }, [invitation]);
  return <section className="pet-invitation" aria-label="拉姆的小主意" data-testid="pet-invitation">
    {invitation && <div ref={offer} tabIndex={-1} className="pet-invitation-offer" data-invitation-kind={invitation.kind}>
      <div className="pet-invitation-heading"><img alt="" aria-hidden="true" draggable={false} src={icons[invitation.kind]}/><h4>{invitation.title}</h4></div>
      <p className="pet-invitation-message" role="status">{invitation.text}</p>
      <div className="pet-invitation-answers">
        <button ref={accept} type="button" className="pet-invitation-accept" disabled={busy} onClick={onAccept}>{invitation.acceptLabel}</button>
        <button type="button" className="pet-invitation-defer" onClick={onDefer}>我先忙30分钟</button>
      </div>
    </div>}
    <div className="pet-invitation-manual">
      <button type="button" aria-label={`叫叫${petName}`} title={`叫叫${petName}`} disabled={busy} onClick={onCallName}><span>叫叫{petName}</span></button>
      <button type="button" disabled={busy} onClick={onSuggest}>让拉姆提个主意</button>
    </div>
    {habitText && <p className="pet-invitation-habit">{habitText}</p>}
    {snoozed && <div className="pet-invitation-snoozed"><span role="status">主动陪伴已暂停</span><button type="button" onClick={onResume}>恢复主动陪伴</button></div>}
  </section>;
}
