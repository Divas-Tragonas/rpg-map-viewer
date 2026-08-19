'use client';
import React, { useState } from 'react';
import { C, CONDITIONS } from '@/constants';
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

/**
 * Graella d'estats del menú contextual.
 *
 * Cada estat és una fitxa amb el seu **isotip** i el nom **en català**; les
 * traduccions al castellà i a l'anglès van al **`title` natiu** del botó — la
 * finestreta grisa del sistema, com la resta de botons de l'app (`PlayersPanel`,
 * `BottomControls`, `CanvasHUD`). Abans era una finestreta pròpia que ocupava
 * espai i obligava el menú a portar `overflow: visible`.
 *
 * Les fitxes actives s'omplen del color de l'estat: així el menú i el distintiu
 * del token parlen el mateix idioma visual.
 */
export function ConditionPicker({ active, onToggle, onClear, multi }: Props) {
  const [hover, setHover] = useState<string | null>(null);

  return (
    <div style={{ padding: '5px 6px 6px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '0 2px 4px' }}>
        <span style={{ fontSize: 8.5, color: C.dim, textTransform: 'uppercase', letterSpacing: '0.09em', fontWeight: 700 }}>
          Estats
        </span>
        {!multi && active.length > 0 && (
          <span style={{ fontSize: 8.5, color: C.accent, fontWeight: 700 }}>{active.length}</span>
        )}
        {onClear && (multi || active.length > 0) && (
          <button onMouseDown={e => { e.stopPropagation(); onClear(); }}
            title="Treure tots els estats"
            style={{ marginLeft: 'auto', padding: '1px 6px', borderRadius: 4, border: `1px solid ${C.border}`, background: 'transparent', color: C.dim, cursor: 'pointer', fontSize: 9 }}>
            Netejar
          </button>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 2 }}>
        {CONDITIONS.map(cond => {
          const on = !multi && active.includes(cond.id);
          const hot = hover === cond.id;
          return (
            <button key={cond.id}
              title={`${cond.label}\nCastellà: ${cond.es}\nAnglès: ${cond.en}`}
              onMouseDown={e => { e.stopPropagation(); onToggle(cond.id); }}
              onMouseEnter={() => setHover(cond.id)}
              onMouseLeave={() => setHover(h => (h === cond.id ? null : h))}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                padding: '4px 1px 3px', borderRadius: 5, cursor: 'pointer',
                border: `1px solid ${on ? cond.color : 'transparent'}`,
                background: on ? `${cond.color}30` : hot ? 'rgba(255,255,255,0.06)' : 'transparent',
              }}>
              <span style={{
                width: 22, height: 22, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: on || hot ? cond.color : 'rgba(255,255,255,0.07)',
              }}>
                <ConditionIcon id={cond.id} size={16}
                  color={on || hot ? conditionInk(cond.color) : cond.color}
                  on={on || hot ? cond.color : 'rgba(0,0,0,0)'} />
              </span>
              <span style={{
                fontSize: 7.5, lineHeight: 1.05, textAlign: 'center', letterSpacing: '-0.02em',
                color: on ? C.bright : C.dim, fontWeight: on ? 700 : 500,
              }}>
                {cond.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
