'use client';
import React from 'react';
import { PenLine, Eraser, RotateCcw, Trash2, CrosshairIcon, TriangleIcon, PointerIcon, GridIcon, WallIcon } from '@/components/icons';
import { C, PALETTE } from '@/constants';
import { GridPanel } from '@/components/dm/GridPanel';
import type { DrawTool, PaintedZone, TokenSizeMap } from '@/types';
import type { SyncSocket } from '@/lib/ws';

interface GridProps {
  gridVisible: boolean; gridSize: number; gridSnap: boolean;
  gridAutoSize: boolean; gridLineWidth: number; gridCalibrating: boolean;
  rGridVisible: React.MutableRefObject<boolean>;
  rGridSize: React.MutableRefObject<number>;
  rGridSnap: React.MutableRefObject<boolean>;
  rGridAutoSize: React.MutableRefObject<boolean>;
  rGridLineWidth: React.MutableRefObject<number>;
  rGridCalibrating: React.MutableRefObject<boolean>;
  rTokenSizeOverride: React.MutableRefObject<TokenSizeMap>;
  setGridVisible: (v: boolean) => void;
  setGridSize: (v: number) => void;
  setGridSnap: (v: boolean) => void;
  setGridAutoSize: (v: boolean) => void;
  setGridLineWidth: (v: number) => void;
  setGridCalibrating: (v: boolean) => void;
  setTokenSizeOverride: (v: TokenSizeMap) => void;
  onSnapAll: () => void;
  onSizeAll: () => void;
  onBroadcast: () => void;
  gridCalibRef: React.MutableRefObject<{ sx: number; sy: number } | null>;
  gridCalibCurrRef: React.MutableRefObject<{ cx: number; cy: number } | null>;
}

interface Props {
  drawTool: DrawTool;
  drawColor: string; setDrawColor: (c: string) => void;
  drawSize: number; setDrawSize: (n: number) => void;
  canUndo: boolean; paintedZones: PaintedZone[];
  onSetDrawTool: (fn: (t: DrawTool) => DrawTool) => void;
  onUndo: () => void;
  onClearDraw: () => void;
  onClearPaintedZones: () => void;
  bcRef: React.MutableRefObject<BroadcastChannel | null>;
  wsRef: React.MutableRefObject<SyncSocket | null>;
  grid: GridProps;
}

const TOOLS: [DrawTool, string, React.ReactNode][] = [
  ['none',    'Selecció',       <PointerIcon key="none" size={15} />],
  ['pen',     'Ploma (1)',      <PenLine key="pen" size={15} />],
  ['eraser',  'Goma (2)',       <Eraser key="eraser" size={15} />],
  ['shape',   'Màgies (3)',     <TriangleIcon key="shape" size={15} />],
  ['pointer', 'Senyal (4)',     <CrosshairIcon key="pointer" size={15} />],
  ['wall',    'Parets (5)',     <WallIcon key="wall" size={15} />],
];

const btnBase: React.CSSProperties = {
  width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center',
  borderRadius: 6, border: `1px solid ${C.border}`, background: 'transparent', cursor: 'pointer',
};

export function FloatingToolbar({ drawTool, drawColor, setDrawColor, drawSize, setDrawSize, canUndo, paintedZones, onSetDrawTool, onUndo, onClearDraw, onClearPaintedZones, bcRef, wsRef, grid }: Props) {
  const [gridOpen, setGridOpen] = React.useState(false);
  const showDrawFlyout = drawTool === 'pen' || drawTool === 'eraser' || drawTool === 'pointer' || drawTool === 'wall';

  const selectTool = (t: DrawTool) => onSetDrawTool(dt => {
    const nt = dt === t ? 'none' : t;
    if (nt === 'none' && dt === 'pointer') {
      bcRef.current?.postMessage({ type: 'POINTER', pos: null });
      bcRef.current?.postMessage({ type: 'MEASURE', a: null, b: null });
      wsRef.current?.send(JSON.stringify({ type: 'POINTER', pos: null }));
      wsRef.current?.send(JSON.stringify({ type: 'MEASURE', a: null, b: null }));
    }
    return nt;
  });

  // pointerEvents 'none' al contenidor perquè el seu box (columna + gap + espai buit
  // sobre el flyout) no capturi els clics/traços del canvas de sota; només els dos
  // panells visibles reactiven pointerEvents. Sense això la goma/pinzell no dibuixen
  // a tota la cantonada inferior esquerra (hitbox invisible enorme).
  return (
    <div style={{ position: 'absolute', bottom: 12, left: 12, zIndex: 10, display: 'flex', alignItems: 'flex-end', gap: 8, pointerEvents: 'none' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, padding: 4, borderRadius: 9, background: 'rgba(10,13,18,.92)', border: `1px solid ${C.border}`, boxShadow: '0 4px 16px rgba(0,0,0,0.5)', pointerEvents: 'auto' }}>
        {TOOLS.map(([t, label, icon]) => {
          const isPtr = t === 'pointer';
          const isNone = t === 'none';
          const isWall = t === 'wall';
          const col = isWall ? C.accent : isPtr ? '#58a6ff' : isNone ? C.accent : drawColor;
          const active = drawTool === t;
          return (
            <button key={t} onClick={() => selectTool(t)} title={label}
              style={{ ...btnBase, border: `1px solid ${active ? col : C.border}`, background: active ? `${col}22` : 'transparent', color: active ? col : C.dim }}>
              {icon}
            </button>
          );
        })}
        <div style={{ height: 1, background: C.border, margin: '2px 2px' }} />
        <button onClick={onUndo} disabled={!canUndo} title="Desfer (Ctrl+Z)"
          style={{ ...btnBase, cursor: canUndo ? 'pointer' : 'default', color: canUndo ? C.dim : 'rgba(139,148,158,0.25)' }}>
          <RotateCcw size={15} />
        </button>
        <button onClick={onClearDraw} title="Esborrar tot"
          style={{ ...btnBase, color: C.dim }}>
          <Trash2 size={15} />
        </button>
        {paintedZones.length > 0 && (
          <button onClick={onClearPaintedZones} title="Esborrar zones màgiques"
            style={{ ...btnBase, border: `1px solid ${C.magic}66`, background: `${C.magic}14`, color: C.magic, fontSize: 10, fontWeight: 700 }}>
            ✨{paintedZones.length}
          </button>
        )}
        <div style={{ height: 1, background: C.border, margin: '2px 2px' }} />
        <button onClick={() => setGridOpen(o => !o)} title="Grid (configuració)"
          style={{ ...btnBase, border: `1px solid ${gridOpen || grid.gridVisible ? C.accent : C.border}`, background: gridOpen || grid.gridVisible ? `${C.accent}22` : 'transparent', color: gridOpen || grid.gridVisible ? C.accent : C.dim }}>
          <GridIcon size={15} />
        </button>
      </div>

      {(showDrawFlyout || gridOpen) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {gridOpen && (
            <GridPanel {...grid} />
          )}
          {showDrawFlyout && (
        <div style={{ padding: '8px 10px', borderRadius: 9, background: 'rgba(10,13,18,.92)', border: `1px solid ${C.border}`, boxShadow: '0 4px 16px rgba(0,0,0,0.5)', minWidth: 150, pointerEvents: 'auto' }}>
          {(drawTool === 'pen' || drawTool === 'eraser') && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              {PALETTE.map(c => (
                <div key={c} onClick={() => setDrawColor(c)} title={c}
                  style={{ width: 15, height: 15, borderRadius: '50%', background: c, cursor: 'pointer', border: `2px solid ${drawColor === c ? '#e6edf3' : 'transparent'}`, boxSizing: 'border-box', flexShrink: 0 }} />
              ))}
              <input type="range" min={2} max={30} value={drawSize} onChange={e => setDrawSize(parseInt(e.target.value))}
                style={{ flex: 1, minWidth: 60, accentColor: drawColor }} />
              <span style={{ color: C.dim, fontSize: 10, minWidth: 22, flexShrink: 0 }}>{drawSize}px</span>
            </div>
          )}
          {drawTool === 'pointer' && (
            <div style={{ fontSize: 9.5, color: C.dim, lineHeight: 1.4, maxWidth: 220 }}>
              📏 Clica per marcar l&apos;inici, torna a clicar per fixar el final (regla en peus) i un tercer clic l&apos;elimina.
            </div>
          )}
          {drawTool === 'wall' && (
            <div style={{ fontSize: 9.5, color: C.dim, lineHeight: 1.5, maxWidth: 230 }}>
              🧱 <b style={{ color: C.text }}>Parets:</b> clica per anar posant parets; s&apos;enganxen a línies i vèrtexs existents. En tancar una geometria es crea una sala automàticament. Clic dret sobre la sala → marcar-la <b style={{ color: C.text }}>fosca</b>; l&apos;ull la revela.
              <div style={{ marginTop: 4, color: C.dim }}>Backspace = desfà l&apos;última · Esc = cancel·la la cadena{grid.gridSnap ? ' · snap a graella' : ''}</div>
              <div style={{ marginTop: 2, color: C.dim }}>Amagar una sala revelada: activa <b style={{ color: C.text }}>Shift</b> i clica-la.</div>
            </div>
          )}
        </div>
          )}
        </div>
      )}
    </div>
  );
}
