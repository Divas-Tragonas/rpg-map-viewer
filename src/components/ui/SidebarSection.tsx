'use client';
import React, { useState } from 'react';
import { C } from '@/constants';

interface Props {
  title: string;
  /** Emoji o icona petita a l'esquerra del títol. */
  icon?: React.ReactNode;
  /** Comptador que es pinta al costat del títol (p. ex. nombre de sales). */
  count?: number | null;
  countColor?: string;
  /** Botons de la dreta de la capçalera (no pleguen la secció: ja fan stopPropagation). */
  actions?: React.ReactNode;
  defaultOpen?: boolean;
  /** Alçada màxima del cos abans de fer scroll intern (evita que una llista llarga empenyi la resta). */
  maxBodyHeight?: number;
  bodyPadding?: string | number;
  children: React.ReactNode;
}

/**
 * Secció plegable de la finestra lateral. Totes les seccions del sidebar del DM (importar,
 * capes, sales, llums, jugadors) tenen la mateixa capçalera —títol, comptador i accions— i
 * es pleguen amb el mateix truc CSS `grid-template-rows: 0fr → 1fr` que el desplegable de
 * configuració del jugador (anima l'alçada sense haver de mesurar-la).
 */
export function SidebarSection({
  title, icon, count = null, countColor = C.accent, actions,
  defaultOpen = true, maxBodyHeight, bodyPadding = 0, children,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ borderBottom: `1px solid ${C.border}` }}>
      <div
        onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px 6px 8px', cursor: 'pointer', userSelect: 'none', background: open ? 'transparent' : 'rgba(255,255,255,0.02)' }}
      >
        <span style={{ fontSize: 9, color: C.dim, width: 9, flexShrink: 0, transition: 'transform .18s ease', transform: open ? 'rotate(90deg)' : 'none', display: 'inline-block' }}>▶</span>
        {icon && <span style={{ fontSize: 11, lineHeight: 1, flexShrink: 0 }}>{icon}</span>}
        <span style={{ fontSize: 10, fontWeight: 700, color: open ? C.text : C.dim, textTransform: 'uppercase', letterSpacing: '0.1em', flex: 1, minWidth: 0 }}>
          {title}
          {count !== null && count > 0 && <span style={{ color: countColor, letterSpacing: 0 }}> · {count}</span>}
        </span>
        {actions && (
          <div onClick={e => e.stopPropagation()} style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
            {actions}
          </div>
        )}
      </div>
      <div style={{ display: 'grid', gridTemplateRows: open ? '1fr' : '0fr', transition: 'grid-template-rows .2s ease' }}>
        <div style={{ overflow: 'hidden', minHeight: 0 }}>
          <div style={{ padding: bodyPadding, maxHeight: maxBodyHeight, overflowY: maxBodyHeight ? 'auto' : undefined }}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Botó petit per a la fila `actions` d'una capçalera de secció. */
export function SectionButton({ onClick, title, active, disabled, color = C.accent, children }: {
  onClick: () => void; title: string; active?: boolean; disabled?: boolean; color?: string; children: React.ReactNode;
}) {
  return (
    <button onClick={onClick} title={title} disabled={disabled}
      style={{ background: active ? `${color}22` : 'transparent', border: `1px solid ${active ? color : C.border}`, borderRadius: 5, padding: '2px 7px', cursor: disabled ? 'default' : 'pointer', color: disabled ? `${C.dim}66` : active ? color : C.dim, fontSize: 9.5, fontWeight: 700, whiteSpace: 'nowrap' }}>
      {children}
    </button>
  );
}
