'use client';
import React from 'react';
import { CONDITION_ICONS, ICON_BOX, conditionInk } from '@/lib/conditions';

interface Props {
  id: string;
  /** Costat de la caixa en píxels. */
  size?: number;
  /** Color de la tinta. Per defecte, el que contrasta amb `on` (o blanc). */
  color?: string;
  /** Color de fons damunt del qual es pinta (per triar la tinta automàticament). */
  on?: string;
  style?: React.CSSProperties;
}

/**
 * Isotip d'un estat com a SVG: **la mateixa font vectorial que el canvas**
 * (`src/lib/conditions/icons.ts`), o sigui que es veu nítid a qualsevol mida i
 * no cal mantenir dues versions del dibuix.
 */
export function ConditionIcon({ id, size = 20, color, on, style }: Props) {
  const parts = CONDITION_ICONS[id];
  if (!parts) return null;
  const ink = color ?? (on ? conditionInk(on) : '#fff');
  const bg = on ?? '#0d1117';
  return (
    <svg width={size} height={size} viewBox={`0 0 ${ICON_BOX} ${ICON_BOX}`} style={{ display: 'block', flexShrink: 0, ...style }} aria-hidden>
      {parts.map((p, i) => (
        p.w
          ? <path key={i} d={p.d} fill="none" stroke={p.bg ? bg : ink} strokeWidth={p.w} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={p.dash?.join(' ')} />
          : <path key={i} d={p.d} fill={p.bg ? bg : ink} fillRule="evenodd" />
      ))}
    </svg>
  );
}
