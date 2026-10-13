'use client';
import React from 'react';
import { C, FS, RADIUS, SHADOW, tint } from '@/constants';

interface Props {
  gridCalibrating: boolean;
  /** Sense mapa no hi ha res a enquadrar: el zoom no surt. */
  hasMap: boolean;
  zoom: number;
  onZoomChange: (z: number) => void;
  /** Restableix el zoom i la posició de la vista compartida. */
  onResetView: () => void;
}

const ZOOM_MIN = 0.2;
const ZOOM_MAX = 10;
const ZOOM_STEP = 0.1;

const zoomBtn: React.CSSProperties = {
  height: 28, minWidth: 28, padding: '0 6px', border: 'none', borderRadius: RADIUS.md, background: 'transparent',
  color: C.text, fontSize: FS.lg, lineHeight: 1, cursor: 'pointer',
};

/**
 * Indicadors damunt del mapa. La resta del que hi havia (pantalles, desat, ressaltar
 * enemics, dreceres) ara viu a la barra superior (`TopBar`). Aquí queden el rètol del
 * calibratge de la graella i el zoom, a la cantonada com a qualsevol editor: un clic al
 * percentatge restableix la vista (abans era un botó ⟲ a part i un lliscador al lateral).
 */
export function CanvasHUD({ gridCalibrating, hasMap, zoom, onZoomChange, onResetView }: Props) {
  const setZoom = (z: number) => onZoomChange(Math.round(Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z)) * 100) / 100);
  return (
    <>
      {gridCalibrating && (
        <div style={{ position: 'absolute', top: 14, left: '50%', transform: 'translateX(-50%)', zIndex: 20, pointerEvents: 'none', background: C.float, border: `1px solid ${C.accent}`, borderRadius: RADIUS.md, padding: '6px 14px', fontSize: FS.sm, color: C.accent, fontWeight: 600, letterSpacing: '0.04em', whiteSpace: 'nowrap', boxShadow: `0 0 12px ${tint(C.accent, 0.27)}` }}>
          🎯 Arrossega sobre el mapa per definir una casella de la graella
        </div>
      )}
      {hasMap && (
        <div style={{ position: 'absolute', top: 12, right: 12, zIndex: 10, display: 'flex', alignItems: 'center', padding: 3, borderRadius: RADIUS.lg, background: C.float, border: `1px solid ${C.border}`, boxShadow: SHADOW.float }}>
          <button onClick={() => setZoom(zoom - ZOOM_STEP)} aria-label="Allunyar" title="Allunyar" style={zoomBtn}>−</button>
          <button onClick={onResetView} title="Restablir la vista (zoom i posició)"
            style={{ ...zoomBtn, minWidth: 52, fontSize: FS.md, fontWeight: 700, color: C.bright, fontVariantNumeric: 'tabular-nums' }}>
            {Math.round(zoom * 100)}%
          </button>
          <button onClick={() => setZoom(zoom + ZOOM_STEP)} aria-label="Apropar" title="Apropar" style={zoomBtn}>+</button>
        </div>
      )}
    </>
  );
}
