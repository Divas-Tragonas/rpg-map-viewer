'use client';
import React from 'react';
import { Eye, LockIcon, ExternalLink, X, TargetIcon } from '@/components/icons';
import { C, FS, RADIUS, SHADOW, tint } from '@/constants';
import { useCompactLayout } from '@/hooks/useCompact';

interface Props {
  gridCalibrating: boolean;
  /** Sense mapa no hi ha res a enquadrar: ni càmera ni zoom. */
  hasMap: boolean;
  zoom: number;
  onZoomChange: (z: number) => void;
  /** Restableix el zoom i la posició de la vista compartida. */
  onResetView: () => void;
  /** Vista privada (els jugadors no et segueixen) i vista compartida temporal (toc de Ctrl). */
  privateView: boolean;
  tempShared: boolean;
  onSetPrivate: (on: boolean) => void;
  /** Envia als jugadors el que veus en privat. */
  onSendView: () => void;
  /** Surt de la vista temporal: tothom torna a l'enquadrament d'abans. */
  onEndTemp: () => void;
}

const ZOOM_MIN = 0.2;
const ZOOM_MAX = 10;
const ZOOM_STEP = 0.1;

const box: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 2, padding: 3, borderRadius: RADIUS.lg,
  background: C.float, border: `1px solid ${C.border}`, boxShadow: SHADOW.float,
};

const zoomBtn: React.CSSProperties = {
  height: 28, minWidth: 28, padding: '0 6px', border: 'none', borderRadius: RADIUS.md, background: 'transparent',
  color: C.text, fontSize: FS.lg, lineHeight: 1, cursor: 'pointer',
};

function segment(on: boolean, color: string): React.CSSProperties {
  return {
    height: 28, display: 'flex', alignItems: 'center', gap: 6, padding: '0 10px', border: 'none', borderRadius: RADIUS.md,
    background: on ? tint(color, 0.16) : 'transparent', color: on ? color : C.dim,
    fontSize: FS.sm, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', transition: 'background .15s, color .15s',
  };
}

/**
 * Controls damunt del mapa. A la cantonada superior dreta, tot el que és de la vista: el
 * **selector de càmera** (què veuen els jugadors) i el **zoom**. Abans la càmera eren dos
 * botons «CTRL» i «MAJ» a la barra d'eines, amb el nom de la tecla en lloc del que fan.
 * Aquí també hi queda el rètol del calibratge de la graella.
 */
export function CanvasHUD({ gridCalibrating, hasMap, zoom, onZoomChange, onResetView, privateView, tempShared, onSetPrivate, onSendView, onEndTemp }: Props) {
  // Mòbil: només les icones de la càmera, perquè hi càpiga el menú de llocs a l'esquerra.
  const compact = useCompactLayout();
  const setZoom = (z: number) => onZoomChange(Math.round(Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z)) * 100) / 100);
  return (
    <>
      {gridCalibrating && (
        <div style={{ position: 'absolute', top: 14, left: '50%', transform: 'translateX(-50%)', zIndex: 20, pointerEvents: 'none', background: C.float, border: `1px solid ${tint(C.room, 0.6)}`, borderRadius: RADIUS.md, padding: '6px 14px', fontSize: FS.sm, color: C.room, fontWeight: 600, letterSpacing: '0.04em', whiteSpace: 'nowrap', boxShadow: SHADOW.float }}>
          <TargetIcon size={13} style={{ verticalAlign: '-2px', marginRight: 6 }} />Arrossega sobre el mapa per definir una casella de la graella
        </div>
      )}
      {hasMap && (
        <div style={{ position: 'absolute', top: 12, right: 12, zIndex: 10, display: 'flex', alignItems: 'center', gap: compact ? 6 : 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {tempShared && (
            <div style={{ ...box, borderColor: tint(C.ok, 0.5), color: C.ok, fontSize: FS.xs, fontWeight: 700, padding: '3px 3px 3px 10px', gap: 6 }}
              title="Vista compartida temporal (toc de Ctrl): els jugadors et segueixen i, en sortir-ne, tothom torna a l'enquadrament d'abans.">
              Temporal · tornarà on era
              <button onClick={onEndTemp} aria-label="Sortir de la vista temporal" title="Sortir: tothom torna a l'enquadrament d'abans"
                style={{ ...zoomBtn, minWidth: 24, height: 24, color: C.ok, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={12} />
              </button>
            </div>
          )}

          {privateView && (
            <button onClick={onSendView} title="Els jugadors passen a veure el que veus ara. Continues en vista privada."
              style={{ ...box, ...segment(false, C.room), height: 36, padding: '0 12px', color: C.room, borderColor: tint(C.room, 0.45), background: C.float }}>
              <ExternalLink size={13} /> {compact ? 'Enviar' : 'Enviar aquesta vista'}
            </button>
          )}

          <div role="radiogroup" aria-label="Què veuen els jugadors" style={box}>
            <button role="radio" aria-checked={!privateView} onClick={() => onSetPrivate(false)} style={segment(!privateView, C.ok)}
              title="Vista compartida: els jugadors veuen el que tu veus i et segueixen quan mous el mapa o fas zoom.">
              <Eye size={13} /> {!compact && 'Compartida'}
            </button>
            <button role="radio" aria-checked={privateView} onClick={() => onSetPrivate(true)} style={segment(privateView, C.room)}
              title="Vista privada (toc de Maj): mou-te i fes zoom sense que els jugadors ho vegin; la seva pantalla es queda on era. També cal per amagar una sala ja revelada.">
              <LockIcon size={12} /> {!compact && 'Privada'}
            </button>
          </div>

          <div style={box}>
            <button onClick={() => setZoom(zoom - ZOOM_STEP)} aria-label="Allunyar" title="Allunyar" style={zoomBtn}>−</button>
            <button onClick={onResetView} title="Restablir la vista (zoom i posició)"
              style={{ ...zoomBtn, minWidth: compact ? 44 : 52, fontSize: FS.md, fontWeight: 700, color: C.bright, fontVariantNumeric: 'tabular-nums' }}>
              {Math.round(zoom * 100)}%
            </button>
            <button onClick={() => setZoom(zoom + ZOOM_STEP)} aria-label="Apropar" title="Apropar" style={zoomBtn}>+</button>
          </div>
        </div>
      )}
    </>
  );
}
