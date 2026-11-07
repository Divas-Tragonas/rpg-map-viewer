'use client';
import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { X } from '@/components/icons';
import { C, FS, RADIUS } from '@/constants';
import { anchoredBox } from '@/components/dm/ContextMenuOverlay';
import { DAMAGE_TYPES, type DamageType } from '@/lib/characters';
import { applyDefenses, type Defenses } from '@/lib/rules/damage';
import type { DamagePrompt } from '@/types';

/** Alçada aproximada del pop-up, per centrar-lo respecte del token (com el menú del token). */
const POPUP_H = 190;

const field: React.CSSProperties = {
  height: 30, boxSizing: 'border-box', background: C.bg, border: `1px solid ${C.border}`,
  borderRadius: RADIUS.sm, padding: '0 8px', color: C.bright, fontSize: FS.lg, outline: 'none',
};

/**
 * Pop-up de dany d'un atac (v5): s'obre al costat del token objectiu en clicar-lo mentre s'apunta
 * un atac del menú. El DM hi escriu el dany que han tret els daus i en veu el resultat final segons
 * les defenses de l'objectiu (immunitat, resistència, vulnerabilitat), amb el perquè de cada canvi.
 * Enter aplica, Esc cancel·la; el camp del dany ja té el focus. Els atacs del menú compten com a
 * armes NO màgiques (les resistències a armes no màgiques s'apliquen).
 */
export function DamagePopup({ prompt, target, onApply, onClose }: {
  prompt: DamagePrompt;
  target: { name: string; hp: number; hpMax: number; defenses?: Defenses };
  onApply: (amount: number) => void;
  onClose: () => void;
}) {
  const [raw, setRaw] = useState('');
  const [type, setType] = useState<DamageType | ''>(prompt.damageType ?? '');
  const amount = Math.max(0, parseInt(raw) || 0);
  const { final, reasons } = applyDefenses(amount, type || undefined, target.defenses, false);
  const hpAfter = Math.max(0, target.hp - final);
  const apply = () => { if (raw.trim() !== '') onApply(final); };
  // Esc tanca també si el focus ja no és al pop-up (el DM ha clicat el mapa).
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); closeRef.current(); } };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);
  return (
    <div data-ctxmenu="1"
      onMouseDown={e => e.stopPropagation()}
      onKeyDown={e => {
        // Abans que les dreceres globals (Enter = passar torn, Esc = cancel·lar altres coses).
        if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); apply(); }

      }}
      style={{ ...anchoredBox(prompt.anchor, POPUP_H), padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ flex: 1, minWidth: 0, fontSize: FS.md, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          ⚔ {prompt.label} → <b style={{ color: C.bright }}>{target.name}</b>
        </span>
        <Button size="sm" variant="ghost" title="Cancel·lar (Esc)" onClick={onClose}><X size={12} /></Button>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <input autoFocus inputMode="numeric" placeholder="Dany" value={raw}
          onChange={e => setRaw(e.target.value.replace(/[^\d]/g, ''))}
          style={{ ...field, width: 80, fontWeight: 700, textAlign: 'center' }} />
        <select value={type} onChange={e => setType(e.target.value as DamageType | '')}
          style={{ ...field, flex: 1, fontSize: FS.md }}>
          <option value="">Sense tipus</option>
          {DAMAGE_TYPES.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
        </select>
      </div>
      {reasons.map(r => (
        <div key={r} style={{ fontSize: FS.sm, color: C.warn }}>• {r}</div>
      ))}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, fontSize: FS.md, color: C.dim }}>
        <span>Dany final <b style={{ fontSize: FS.xl, color: final !== amount ? C.warn : C.bright }}>{final}</b>
          {final !== amount && <span> (de {amount})</span>}</span>
        {target.hpMax > 0 && <span style={{ marginLeft: 'auto' }}>PV {target.hp} → <b style={{ color: hpAfter === 0 ? C.enemy : C.text }}>{hpAfter}</b></span>}
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <Button variant="primary" disabled={raw.trim() === ''} onClick={apply} style={{ flex: 1 }}>Aplicar ↵</Button>
        <Button variant="secondary" onClick={onClose}>Cancel·lar</Button>
      </div>
    </div>
  );
}
