'use client';
import React, { useState } from 'react';
import { C, CONDITIONS, FS, RADIUS, tint } from '@/constants';
import { conditionInk } from '@/lib/conditions';
import { ConditionIcon } from './ConditionIcon';

interface Props {
  /** Ids dels estats actius. Buit en multi-selecció (no hi ha un estat comú). */
  active: string[];
  onToggle: (condId: string) => void;
  onClear?: () => void;
  /** Multi-selecció: els botons apliquen a tots els tokens i no marquen res. */
  multi?: boolean;
}

const COLS = 8;

/** `a` barrejat amb `b` (colors `#rrggbb`): el cercle d'un estat apagat ha de ser opac. */
function mix(a: string, b: string, t: number): string {
  const ch = (h: string, i: number) => parseInt(h.slice(1 + i * 2, 3 + i * 2), 16);
  return '#' + [0, 1, 2].map(i => Math.round(ch(a, i) * t + ch(b, i) * (1 - t)).toString(16).padStart(2, '0')).join('');
}

/**
 * Estats del menú contextual en **dues files d'isotips** (8 × 2). Abans era una graella de
 * 4 columnes amb el nom sota cada icona, que ocupava mig menú.
 *
 * El nom no es perd: la línia de capçalera diu quins estats té el token i, en passar per sobre
 * d'una icona, el nom en català amb les traduccions (també al `title` natiu del botó). Els
 * actius s'omplen del color de l'estat, com el distintiu del token al mapa.
 */
export function ConditionPicker({ active, onToggle, onClear, multi }: Props) {
  const [hover, setHover] = useState<string | null>(null);
  const hot = hover ? CONDITIONS.find(c => c.id === hover) : undefined;
  const activeLabels = multi ? [] : CONDITIONS.filter(c => active.includes(c.id)).map(c => c.label);

  // Capçalera: el que es passa per sobre mana; si no, quins estats té.
  const line = hot
    // El nom no va del color de l'estat: n'hi ha de molt foscos (Encegat) que no es llegirien.
    ? <><span style={{ color: C.bright, fontWeight: 700 }}>{hot.label}</span><span style={{ color: C.dim }}> · {hot.es} · {hot.en}</span></>
    : activeLabels.length > 0
      ? <span style={{ color: C.text, fontWeight: 600 }}>{activeLabels.join(', ')}</span>
      : <span style={{ color: tint(C.dim, 0.7) }}>{multi ? 'S\'aplica a tots' : 'Cap'}</span>;

  return (
    <div style={{ padding: '5px 8px 7px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, height: 18, marginBottom: 3 }}>
        <span style={{ fontSize: FS.xs, color: C.dim, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, flexShrink: 0 }}>
          Estats
        </span>
        <span style={{ flex: 1, minWidth: 0, fontSize: FS.xs, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{line}</span>
        {onClear && (multi || active.length > 0) && (
          <button onMouseDown={e => { e.stopPropagation(); onClear(); }}
            title="Treure tots els estats"
            style={{ flexShrink: 0, padding: '0 6px', height: 18, borderRadius: RADIUS.sm, border: `1px solid ${C.border}`, background: 'transparent', color: C.dim, cursor: 'pointer', fontSize: FS.xs }}>
            Netejar
          </button>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${COLS}, 1fr)`, gap: 2 }} onMouseLeave={() => setHover(null)}>
        {CONDITIONS.map(cond => {
          const on = !multi && active.includes(cond.id);
          const lit = on || hover === cond.id;
          // Opac (no `tint`): les parts `bg` de l'isotip (la barra d'Ensordit) es pinten
          // d'aquest color i, transparent, no tapaven la silueta.
          const disc = lit ? cond.color : mix(cond.color, C.panel, 0.3);
          return (
            <button key={cond.id}
              aria-label={cond.label} aria-pressed={multi ? undefined : on}
              title={`${cond.label}\nCastellà: ${cond.es}\nAnglès: ${cond.en}`}
              onMouseDown={e => { e.stopPropagation(); onToggle(cond.id); }}
              onMouseEnter={() => setHover(cond.id)}
              style={{
                height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
                borderRadius: RADIUS.sm, cursor: 'pointer',
                border: `1px solid ${on ? cond.color : 'transparent'}`,
                background: on ? tint(cond.color, 0.19) : 'transparent',
              }}>
              <span style={{
                width: 22, height: 22, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                // Apagat: isotip clar sobre un cercle tenyit del color de l'estat. Amb l'isotip
                // del color de l'estat, els foscos (Encegat, Inconscient, Moribund) no es veien.
                background: disc, transition: 'background .1s',
              }}>
                <ConditionIcon id={cond.id} size={15}
                  color={lit ? conditionInk(cond.color) : C.text}
                  on={disc} />
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
