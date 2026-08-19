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

const COLS = 4;

/**
 * Graella d'estats del menú contextual.
 *
 * Cada estat és una fitxa amb el seu **isotip** i el nom **en català**; en passar-hi
 * el cursor per sobre surt una finestreta amb les traduccions al castellà i a
 * l'anglès (els noms que hi ha a la làmina oficial), que és per on els busca tothom
 * a la taula. Les fitxes actives s'omplen del color de l'estat: així el menú i el
 * distintiu del token parlen el mateix idioma visual.
 */
export function ConditionPicker({ active, onToggle, onClear, multi }: Props) {
  const [hover, setHover] = useState<string | null>(null);

  return (
    <div style={{ padding: '7px 8px 8px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <span style={{ fontSize: 9, color: C.dim, textTransform: 'uppercase', letterSpacing: '0.09em', fontWeight: 700 }}>
          Estats
        </span>
        {!multi && active.length > 0 && (
          <span style={{ fontSize: 9, color: C.accent, fontWeight: 700 }}>{active.length}</span>
        )}
        {onClear && (multi || active.length > 0) && (
          <button onMouseDown={e => { e.stopPropagation(); onClear(); }}
            style={{ marginLeft: 'auto', padding: '2px 7px', borderRadius: 5, border: `1px solid ${C.border}`, background: 'transparent', color: C.dim, cursor: 'pointer', fontSize: 9.5 }}>
            Netejar
          </button>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${COLS}, 1fr)`, gap: 4 }}>
        {CONDITIONS.map((cond, i) => {
          const on = !multi && active.includes(cond.id);
          const hot = hover === cond.id;
          const row = Math.floor(i / COLS), col = i % COLS;
          const below = row < Math.ceil(CONDITIONS.length / COLS) / 2;
          const tip: React.CSSProperties = {
            position: 'absolute', zIndex: 40, width: 148, pointerEvents: 'none',
            ...(below ? { top: '100%', marginTop: 5 } : { bottom: '100%', marginBottom: 5 }),
            ...(col === 0 ? { left: -4 } : col === COLS - 1 ? { right: -4 } : { left: '50%', transform: 'translateX(-50%)' }),
          };
          return (
            <div key={cond.id} style={{ position: 'relative' }}>
              <button
                onMouseDown={e => { e.stopPropagation(); onToggle(cond.id); }}
                onMouseEnter={() => setHover(cond.id)}
                onMouseLeave={() => setHover(h => (h === cond.id ? null : h))}
                style={{
                  width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                  padding: '6px 2px 5px', borderRadius: 7, cursor: 'pointer',
                  border: `1px solid ${on ? cond.color : hot ? `${cond.color}88` : 'transparent'}`,
                  background: on ? `${cond.color}2e` : hot ? 'rgba(255,255,255,0.05)' : 'transparent',
                  transition: 'background .12s, border-color .12s',
                }}>
                <span style={{
                  width: 26, height: 26, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: on || hot ? cond.color : 'rgba(255,255,255,0.07)',
                  boxShadow: on ? `0 0 8px ${cond.color}77` : 'none',
                  opacity: on || hot ? 1 : 0.75,
                }}>
                  <ConditionIcon id={cond.id} size={19}
                    color={on || hot ? conditionInk(cond.color) : cond.color}
                    on={on || hot ? cond.color : 'rgba(0,0,0,0)'} />
                </span>
                <span style={{
                  fontSize: 8.5, lineHeight: 1.1, textAlign: 'center', letterSpacing: '-0.01em',
                  color: on ? C.bright : C.dim, fontWeight: on ? 700 : 500,
                }}>
                  {cond.label}
                </span>
              </button>

              {hot && (
                <div style={{
                  ...tip,
                  background: 'rgba(10,13,18,.98)', border: `1px solid ${cond.color}66`, borderRadius: 7,
                  boxShadow: '0 6px 20px rgba(0,0,0,0.7)', padding: '6px 8px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: cond.color, flexShrink: 0 }} />
                    <b style={{ color: C.bright, fontSize: 10.5 }}>{cond.label}</b>
                  </div>
                  <div style={{ fontSize: 9, color: C.dim, lineHeight: 1.5 }}>
                    <div>🇪🇸 {cond.es}</div>
                    <div>🇬🇧 {cond.en}</div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
