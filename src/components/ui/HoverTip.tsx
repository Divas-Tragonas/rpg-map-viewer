'use client';
import React from 'react';
import { C, FS, RADIUS, SHADOW } from '@/constants';

type Side = 'right' | 'bottom';

interface Props {
  /** Es mostra només amb el cursor sobre el botó (l'estat el porta el pare). */
  show: boolean;
  /** 'right' → enganxada a la dreta del botó (barra d'eines vertical); 'bottom' → a sota (barra superior). */
  side?: Side;
  title: string;
  /** Drecera de teclat, si en té (es pinta com una tecla a la dreta del títol). */
  hint?: string;
  /** Una línia curta. Si cal explicar-ne més, va a la finestra de dreceres (?). */
  children?: React.ReactNode;
}

/**
 * Finestreta flotant d'explicació d'un botó: nom, tecla i UNA línia del que fa. S'ajusta al
 * text (fins a 300 px); abans feia 240 px fixos i hi cabien paràgrafs sencers. Apareix en passar-hi el cursor per sobre,
 * enganxada al botó, en lloc d'ocupar espai fix a la barra quan l'eina està seleccionada.
 *
 * ⚠️ El contenidor del botó ha de ser `position: relative` (és qui l'ancora), i la
 * finestreta va amb `pointerEvents: none` perquè no robi els clics del botó ni del canvas.
 */
export function HoverTip({ show, side = 'right', title, hint, children }: Props) {
  if (!show) return null;
  // A la dreta s'alinea per BAIX (no centrada): la barra d'eines viu a la cantonada
  // inferior, i una finestreta centrada sobre l'últim botó sortiria de la pantalla.
  // Alineada per baix, sempre creix cap amunt, on hi ha canvas de sobres.
  const place: React.CSSProperties = side === 'right'
    ? { left: '100%', bottom: 0, marginLeft: 9 }
    : { top: '100%', left: 0, marginTop: 9 };
  return (
    <div style={{
      position: 'absolute', ...place, zIndex: 60, width: 'max-content', maxWidth: 300, pointerEvents: 'none',
      background: 'rgba(10,13,18,.97)', border: `1px solid ${C.border}`, borderRadius: RADIUS.md,
      boxShadow: SHADOW.float, padding: '6px 9px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: children ? 2 : 0 }}>
        <b style={{ color: C.bright, fontSize: FS.sm, letterSpacing: '0.02em' }}>{title}</b>
        {hint && (
          <span style={{ marginLeft: 'auto', flexShrink: 0, fontSize: FS.xs, fontWeight: 700, color: C.dim, border: `1px solid ${C.border}`, background: 'rgba(255,255,255,0.04)', borderRadius: RADIUS.sm, padding: '1px 5px', letterSpacing: '0.04em' }}>
            {hint}
          </span>
        )}
      </div>
      {children && <div style={{ fontSize: FS.xs, color: C.dim, lineHeight: 1.45 }}>{children}</div>}
    </div>
  );
}
