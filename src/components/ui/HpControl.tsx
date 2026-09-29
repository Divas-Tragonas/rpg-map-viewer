'use client';
import React, { useState } from 'react';
import { C, FS, RADIUS, tint } from '@/constants';

export type HpSize = 'lg' | 'md' | 'sm';

interface Props {
  hp: number;
  hpMax: number;
  /** Suma (o resta) `delta` punts de vida. La funció de sota ja retalla a [0, hpMax]. */
  onAdjust: (delta: number) => void;
  /**
   * lg → targeta de jugador (llegible des de lluny).
   * md → menú contextual d'un token.
   * sm → files primes de la llista d'enemics (se n'hi han d'apilar molts).
   */
  size?: HpSize;
}

const DIM: Record<HpSize, { btn: number; font: number; sign: number; gap: number }> = {
  lg: { btn: 36, font: 30, sign: 20, gap: 5 },
  md: { btn: 26, font: 20, sign: 15, gap: 4 },
  sm: { btn: 20, font: 14, sign: 13, gap: 3 },
};

/** Color de la vida segons el percentatge: el mateix a totes les targetes, menús i files. */
export function hpColor(hp: number, hpMax: number): string {
  const r = hpMax > 0 ? Math.max(0, hp / hpMax) : 1;
  return r > 0.5 ? C.hpHigh : r > 0.25 ? C.hpMid : C.enemy;
}

/**
 * Control de vida únic de l'app (targeta de jugador, enemics de l'escena i menú contextual).
 * Abans n'hi havia quatre de diferents per al mateix concepte, cadascun amb la seva gramàtica.
 *
 *  − / +        → clic ±1 · clic dret ±10
 *  clic al número → s'hi escriu: «-7» o «+5» apliquen dany o cura, «12» fixa la vida.
 *                   Enter aplica, Esc o clicar fora cancel·la.
 */
export function HpControl({ hp, hpMax, onAdjust, size = 'lg' }: Props) {
  const d = DIM[size];
  const col = hpColor(hp, hpMax);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  const apply = () => {
    const t = draft.trim().replace('−', '-');
    setEditing(false);
    if (/^[+-]\d+$/.test(t)) onAdjust(parseInt(t, 10));
    else if (/^\d+$/.test(t)) onAdjust(parseInt(t, 10) - hp);
  };

  const btn = (delta: number, sign: string) => {
    const c = delta < 0 ? C.enemy : C.hpHigh;
    return (
      <button
        onClick={() => onAdjust(delta)}
        onContextMenu={e => { e.preventDefault(); onAdjust(delta * 10); }}
        title={`${sign}1 vida · clic dret ${sign}10`}
        style={{
          width: d.btn, height: d.btn, flexShrink: 0, padding: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          borderRadius: size === 'sm' ? RADIUS.sm : RADIUS.md,
          border: `1px solid ${tint(c, 0.4)}`, background: tint(c, 0.1),
          color: c, fontSize: d.sign, fontWeight: 700, lineHeight: 1, cursor: 'pointer',
        }}>
        {sign}
      </button>
    );
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: d.gap, flex: 1, minWidth: 0 }}>
      {btn(-1, '−')}
      {editing ? (
        <input
          autoFocus value={draft} placeholder="-5 · +3 · 12"
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') apply(); else if (e.key === 'Escape') setEditing(false); }}
          onBlur={() => setEditing(false)}
          style={{
            flex: 1, minWidth: 0, width: '100%', height: d.btn, boxSizing: 'border-box',
            background: C.bg, border: `1px solid ${C.accent}`, borderRadius: RADIUS.sm,
            color: C.bright, fontSize: Math.max(FS.sm, Math.round(d.font * 0.55)), fontWeight: 700,
            textAlign: 'center', outline: 'none', padding: '0 2px',
          }} />
      ) : (
        <button
          onClick={() => { setDraft(''); setEditing(true); }}
          title="Clic per escriure-hi: «-7» dany, «+5» cura, «12» vida exacta"
          style={{
            flex: 1, minWidth: 0, height: d.btn, padding: 0, border: 'none', background: 'transparent',
            display: 'flex', alignItems: 'baseline', justifyContent: 'center', overflow: 'hidden',
            cursor: 'text', whiteSpace: 'nowrap',
          }}>
          <span style={{ fontSize: d.font, fontWeight: 800, color: col, lineHeight: `${d.btn}px`, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>{hp}</span>
          <span style={{ fontSize: Math.round(d.font * 0.56), fontWeight: 700, color: tint(col, 0.6), lineHeight: 1 }}>/{hpMax}</span>
        </button>
      )}
      {btn(1, '+')}
    </div>
  );
}
