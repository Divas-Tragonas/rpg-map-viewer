'use client';
import React from 'react';
import { RotateCcw, TargetIcon, LockIcon, UnlockIcon } from '@/components/icons';
import { C } from '@/constants';
import { extraSeen } from '@/lib/camera';
import { agoLabel } from '@/lib/autosave';
import type { MapStructure, VisMap } from '@/types';

interface Props {
  ctrlPanActive: boolean;
  shiftPanActive: boolean;
  areaSelectMode: boolean;
  struct: MapStructure | null; vis: VisMap;
  enemyHighlight: boolean; highlightLocked: boolean;
  gridCalibrating: boolean;
  onResetView: () => void;
  onResetPrivate: () => void;
  onToggleEnemyHighlight: () => void;
  onToggleHighlightLocked: () => void;
  /** Pantalles de jugador connectades (id → mida en píxels CSS del seu canvas). */
  playerScreens: Record<string, { w: number; h: number; ts: number }>;
  /** Format (amplada/alçada) de l'enquadrament actual del DM; null si encara no n'hi ha. */
  camAr: number | null;
  /** Desat automàtic: estat de l'interruptor i marca de temps de l'últim desat correcte. */
  hasMap: boolean;
  autosaveEnabled: boolean;
  autosaveAt: number | null;
  onToggleAutosave: () => void;
  onSaveNow: () => void;
}

/**
 * Indicador de pantalles connectades. Amb l'enquadrament sincronitzat en coordenades de
 * MAPA cap pantalla no veu menys que el DM, però una de format diferent veu MÉS mapa als
 * costats: aquí es diu quantes n'hi ha i quant en veuen de més, que és justament el que
 * el DM no podia saber (i el motiu pel qual es pensava que tothom veia el mateix que ell).
 */
function ScreensChip({ playerScreens, camAr }: { playerScreens: Props['playerScreens']; camAr: Props['camAr'] }) {
  const ids = Object.keys(playerScreens);
  const rows = ids.map(id => {
    const s = playerScreens[id];
    const ar = s.w / Math.max(s.h, 1);
    const ex = camAr ? extraSeen({ cx: 0, cy: 0, w: camAr, h: 1 }, ar) : null;
    return { id, s, ar, ex };
  });
  const worst = rows.reduce((m, r) => Math.max(m, r.ex ? r.ex.pct : 0), 0);
  const none = ids.length === 0;
  const col = none ? C.dim : worst >= 15 ? '#e3b341' : '#4ade80';
  // Les del mateix PC arriben pel BroadcastChannel i les de fora pel WebSocket de la API
  // (relay de VIEWPORT). Una pantalla apareix aquí uns segons després d'obrir-se i marxa
  // ~50s després de tancar-se, així que val la pena dir-ho al tooltip.
  const NOTE = 'Cada pantalla reporta la seva mida en connectar-se, en canviar-la i cada 15s.';
  const title = none
    ? `Cap pantalla de jugador detectada.\n\n${NOTE}`
    : rows.map(r => `${r.s.w}×${r.s.h} (${r.ar.toFixed(2)}:1) · veu un ${r.ex ? r.ex.pct : 0}% més d'${r.ex && r.ex.axis === 'w' ? 'amplada' : 'alçada'}`).join('\n')
      + '\n\nTots els jugadors veuen com a mínim tot el teu enquadrament.'
      + `\n${NOTE}`;
  return (
    <div title={title}
      style={{ background: 'rgba(10,13,18,.92)', border: `1px solid ${col}55`, borderRadius: 6, padding: '5px 9px', fontSize: 10, color: col, fontWeight: 700, letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: 5, cursor: 'help' }}>
      🖥 {ids.length}
      {!none && worst > 0 && <span style={{ opacity: .8, fontWeight: 600 }}>+{worst}%</span>}
    </div>
  );
}

/**
 * Estat del desat automàtic. Sense això, l'autodesat seria màgia opaca: aquí es veu quan
 * s'ha desat per últim cop, es força un desat amb un clic i s'apaga amb el clic dret.
 */
function AutosaveChip({ enabled, savedAt, onToggle, onSaveNow }: {
  enabled: boolean; savedAt: number | null; onToggle: () => void; onSaveNow: () => void;
}) {
  // Es refresca sol perquè l'etiqueta («fa 2 min») no es quedi congelada entre desats.
  const [, tick] = React.useState(0);
  React.useEffect(() => {
    const iv = setInterval(() => tick(n => n + 1), 15_000);
    return () => clearInterval(iv);
  }, []);
  const col = !enabled ? C.dim : savedAt ? '#4ade80' : C.dim;
  const title = enabled
    ? `Desat automàtic actiu (cada 30 s i en amagar la pestanya).\n${savedAt ? `Últim desat: ${agoLabel(savedAt)}.` : 'Encara no s\'ha desat res.'}\n\nClic per desar ara · clic dret per apagar-lo.`
    : 'Desat automàtic apagat: si tanques o refresques, perdràs la partida.\n\nClic per encendre\'l.';
  return (
    <button
      onClick={() => (enabled ? onSaveNow() : onToggle())}
      onContextMenu={e => { e.preventDefault(); if (enabled) onToggle(); }}
      title={title}
      style={{ background: 'rgba(10,13,18,.92)', border: `1px solid ${col}55`, borderRadius: 6, padding: '5px 9px', fontSize: 10, color: col, fontWeight: 700, letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer' }}>
      {enabled ? '⟳' : '⊘'}
      <span style={{ opacity: .85, fontWeight: 600 }}>
        {!enabled ? 'sense desar' : savedAt ? agoLabel(savedAt) : 'desant…'}
      </span>
    </button>
  );
}

export function CanvasHUD({ ctrlPanActive, shiftPanActive, areaSelectMode, struct, vis, enemyHighlight, highlightLocked, gridCalibrating, onResetView, onResetPrivate, onToggleEnemyHighlight, onToggleHighlightLocked, playerScreens, camAr, hasMap, autosaveEnabled, autosaveAt, onToggleAutosave, onSaveNow }: Props) {
  return (
    <>
      {gridCalibrating && (
        <div style={{ position: 'absolute', top: 50, left: '50%', transform: 'translateX(-50%)', zIndex: 20, pointerEvents: 'none', background: 'rgba(10,13,18,0.90)', border: `1px solid ${C.accent}`, borderRadius: 7, padding: '6px 14px', fontSize: 11, color: C.accent, fontWeight: 600, letterSpacing: '0.04em', whiteSpace: 'nowrap', boxShadow: `0 0 12px ${C.accent}44` }}>
          🎯 Arrastra sobre el mapa para definir una celda del grid
        </div>
      )}
      <div style={{ position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 6, alignItems: 'center', pointerEvents: 'auto', zIndex: 10 }}>
        {ctrlPanActive && (
          <div title="Mode pan compartit actiu — prem CTRL per desactivar"
            style={{ background: 'rgba(74,222,128,.15)', border: '1px solid #4ade80', borderRadius: 6, padding: '5px 9px', color: '#4ade80', display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700, animation: 'pulse 1.5s infinite', pointerEvents: 'none', letterSpacing: '0.05em' }}>
            CTRL
          </div>
        )}
        {shiftPanActive && (
          <div title="Mode pan DM actiu — prem SHIFT per desactivar"
            style={{ background: 'rgba(88,166,255,.15)', border: '1px solid #58a6ff', borderRadius: 6, padding: '5px 9px', color: '#58a6ff', display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700, animation: 'pulse 1.5s infinite', pointerEvents: 'none', letterSpacing: '0.05em' }}>
            SHIFT
          </div>
        )}
        {areaSelectMode && (
          <div title="Mode selecció per àrea actiu — arrossega per seleccionar tokens · prem A o ESC per sortir"
            style={{ background: 'rgba(88,166,255,.15)', border: '1px solid #58a6ff', borderRadius: 6, padding: '5px 9px', color: '#58a6ff', display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700, animation: 'pulse 1.5s infinite', pointerEvents: 'none', letterSpacing: '0.05em' }}>
            ▣ SELECCIÓ
          </div>
        )}
        <div style={{ background: 'rgba(10,13,18,.92)', border: `1px solid ${C.border}`, borderRadius: 6, padding: '5px 11px', fontSize: 11, color: C.dim }}>
          <span style={{ color: C.accent, fontWeight: 700 }}>DM</span>
        </div>
        <ScreensChip playerScreens={playerScreens} camAr={camAr} />
        {/* Sense mapa carregat no hi ha res a desar: el xip no apareix fins que n'hi ha un. */}
        {hasMap && <AutosaveChip enabled={autosaveEnabled} savedAt={autosaveAt} onToggle={onToggleAutosave} onSaveNow={onSaveNow} />}
        <button onClick={onResetView} title="Reset zoom y posición"
          style={{ background: 'rgba(10,13,18,.92)', border: `1px solid ${C.border}`, borderRadius: 6, padding: '5px 7px', cursor: 'pointer', color: C.dim, display: 'flex' }}>
          <RotateCcw size={11} />
        </button>
        {struct && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <button onClick={onToggleEnemyHighlight}
              title={`Resaltar enemigos${highlightLocked ? ' (bloqueado ∞)' : ' (3.5s)'}`}
              style={{ background: enemyHighlight ? `${C.enemyHL}2e` : 'rgba(10,13,18,.92)', border: enemyHighlight ? `1px solid ${C.enemyHL}` : `1px solid ${C.border}`, borderRadius: '6px 0 0 6px', padding: '5px 8px', cursor: 'pointer', color: enemyHighlight ? C.enemyHL : C.dim, display: 'flex', alignItems: 'center', gap: 4, boxShadow: enemyHighlight ? `0 0 10px ${C.enemyHL}40` : 'none', transition: 'all 0.2s' }}>
              <TargetIcon size={11} />
              <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.04em' }}>Resaltar</span>
            </button>
            <button onClick={onToggleHighlightLocked}
              title={highlightLocked ? 'Bloqueado permanente' : 'Timer 3.5s'}
              style={{ background: highlightLocked ? `${C.enemyHL}2e` : 'rgba(10,13,18,.92)', border: highlightLocked ? `1px solid ${C.enemyHL}` : `1px solid ${C.border}`, borderLeft: 'none', borderRadius: '0 6px 6px 0', padding: '5px 6px', cursor: 'pointer', color: highlightLocked ? C.enemyHL : C.dim, display: 'flex', alignItems: 'center', transition: 'all 0.2s' }}>
              {highlightLocked ? <LockIcon size={10} /> : <UnlockIcon size={10} />}
            </button>
          </div>
        )}
      </div>
    </>
  );
}
