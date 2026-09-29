'use client';
import React from 'react';
import { C, FS, RADIUS, tint } from '@/constants';

/**
 * Botons base del DM. Abans cada panell es pintava els seus botons a mà (22 mides de lletra,
 * 10 radis, el vermell escrit a mà ~40 cops) i el mateix concepte es veia diferent a cada
 * lloc. Qualsevol botó nou ha de sortir d'aquí:
 *
 *  - `primary`   → l'acció principal d'un bloc (fons accent). N'hi hauria d'haver una.
 *  - `secondary` → accions normals (contorn neutre).
 *  - `ghost`     → accions discretes, sense contorn (enllaços, icones de fila).
 *  - `danger`    → accions destructives (tint vermell).
 *  - `tint`      → botó de color propi (`color`), p. ex. màgia o el ✚ de vida.
 *
 * `active` marca un botó commutador encès (mateix tint que `tint`, però amb el color accent
 * si no se'n passa cap altre).
 */
export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'tint';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface Props extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Color del tint (variant `tint` i estat `active`). */
  color?: string;
  active?: boolean;
  /** Ocupa tota l'amplada disponible. */
  block?: boolean;
}

const SIZES: Record<ButtonSize, React.CSSProperties> = {
  sm: { padding: '3px 8px', fontSize: FS.xs, borderRadius: RADIUS.sm, gap: 4 },
  md: { padding: '6px 10px', fontSize: FS.sm, borderRadius: RADIUS.md, gap: 5 },
  lg: { padding: '9px 14px', fontSize: FS.md, borderRadius: RADIUS.md, gap: 7 },
};

export function buttonStyle(variant: ButtonVariant, size: ButtonSize, opts: { color?: string; active?: boolean; disabled?: boolean; block?: boolean } = {}): React.CSSProperties {
  const { color, active, disabled, block } = opts;
  const base: React.CSSProperties = {
    ...SIZES[size],
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    fontWeight: 600, lineHeight: 1.2, whiteSpace: 'nowrap',
    cursor: disabled ? 'default' : 'pointer',
    width: block ? '100%' : undefined,
    boxSizing: 'border-box',
    transition: 'background .15s, border-color .15s, color .15s',
  };
  if (disabled) {
    return { ...base, border: `1px solid ${C.border}`, background: 'transparent', color: tint(C.dim, 0.4) };
  }
  const col = color ?? C.accent;
  if (active) return { ...base, border: `1px solid ${col}`, background: tint(col, 0.14), color: col };
  switch (variant) {
    case 'primary':   return { ...base, border: `1px solid ${C.accent}`, background: C.accent, color: C.onAccent, fontWeight: 700 };
    case 'secondary': return { ...base, border: `1px solid ${C.border}`, background: 'rgba(255,255,255,0.03)', color: C.text };
    case 'ghost':     return { ...base, border: '1px solid transparent', background: 'transparent', color: C.dim };
    case 'danger':    return { ...base, border: `1px solid ${tint(C.enemy, 0.35)}`, background: tint(C.enemy, 0.12), color: C.enemy };
    case 'tint':      return { ...base, border: `1px solid ${tint(col, 0.4)}`, background: tint(col, 0.12), color: col };
  }
}

export function Button({ variant = 'secondary', size = 'md', color, active, block, disabled, style, children, ...rest }: Props) {
  return (
    <button {...rest} disabled={disabled}
      style={{ ...buttonStyle(variant, size, { color, active, disabled, block }), ...style }}>
      {children}
    </button>
  );
}

/** Botó quadrat d'una sola icona (barres d'eines, capçaleres, files). */
export function IconButton({ size = 28, variant = 'secondary', color, active, disabled, style, children, ...rest }: Omit<Props, 'size' | 'block'> & { size?: number }) {
  return (
    <button {...rest} disabled={disabled}
      style={{
        ...buttonStyle(variant, 'md', { color, active, disabled }),
        width: size, height: size, padding: 0, flexShrink: 0,
        ...style,
      }}>
      {children}
    </button>
  );
}
