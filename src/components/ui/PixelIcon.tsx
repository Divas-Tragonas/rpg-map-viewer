'use client';
import React from 'react';
import { UI_ICONS_URL, UI_ICON_COLS, UI_ICON_ROWS, uiIconCell, type UiIconId } from '@/lib/sprites/uiicon';

interface Props {
  name: UiIconId;
  /** Costat en px CSS: múltiple de 16 perquè els píxels quedin quadrats (16, 32…). */
  size?: number;
  title?: string;
  style?: React.CSSProperties;
}

/** Icona de pixel art de la interfície (`ui_icons.png`), ampliada sense suavitzar. */
export function PixelIcon({ name, size = 16, title, style }: Props) {
  const { col, row } = uiIconCell(name);
  return (
    <span role="img" aria-label={title ?? name} title={title}
      style={{
        display: 'inline-block', width: size, height: size, flexShrink: 0,
        backgroundImage: `url(${UI_ICONS_URL})`, backgroundRepeat: 'no-repeat',
        backgroundSize: `${UI_ICON_COLS * size}px ${UI_ICON_ROWS * size}px`,
        backgroundPosition: `${-col * size}px ${-row * size}px`,
        imageRendering: 'pixelated', ...style,
      }} />
  );
}

/** La mateixa icona dins d'un `<svg>` (la roda de `RadialMenu`), centrada a (x, y). */
export function SvgPixelIcon({ name, x, y, size = 32 }: { name: UiIconId; x: number; y: number; size?: number }) {
  const { col, row } = uiIconCell(name);
  return (
    <svg x={x - size / 2} y={y - size / 2} width={size} height={size} viewBox={`${col * 16} ${row * 16} 16 16`} style={{ pointerEvents: 'none', overflow: 'hidden' }}>
      <image href={UI_ICONS_URL} x={0} y={0} width={UI_ICON_COLS * 16} height={UI_ICON_ROWS * 16} style={{ imageRendering: 'pixelated' }} />
    </svg>
  );
}
