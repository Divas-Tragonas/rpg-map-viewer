'use client';
import React from 'react';
import { PenLine, Eraser, RotateCcw, Trash2, CrosshairIcon, TriangleIcon } from '@/components/icons';
import { C, PALETTE } from '@/constants';
import type { DrawTool, PaintedZone } from '@/types';

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
}

const TOOLS: [DrawTool, string, React.ReactNode][] = [
  ['pen',     '1:Ploma',  <PenLine size={11} />],
  ['eraser',  '2:Goma',   <Eraser size={11} />],
  ['shape',   '3:Màgies', <TriangleIcon size={11} />],
  ['pointer', '4:Senyal', <CrosshairIcon size={11} />],
];

export function DrawToolsPanel({ drawTool, drawColor, setDrawColor, drawSize, setDrawSize, canUndo, paintedZones, onSetDrawTool, onUndo, onClearDraw, onClearPaintedZones, bcRef }: Props) {
  return (
    <div style={{ padding: '10px 12px' }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: C.dim, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>Dibuix</div>
      <div style={{ display: 'flex', gap: 3, alignItems: 'center', marginBottom: 5 }}>
        {TOOLS.map(([t, label, icon]) => {
          const isPtr = t === 'pointer';
          const col = isPtr ? '#58a6ff' : drawColor;
          return (
            <button key={t} onClick={() => onSetDrawTool(dt => {
              const nt = dt === t ? 'none' : t;
              if (nt === 'none' && isPtr) bcRef.current?.postMessage({ type: 'POINTER', pos: null });
              return nt;
            })} title={label}
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, padding: '5px 2px', borderRadius: 5, border: `1px solid ${drawTool === t ? col : C.border}`, background: drawTool === t ? `${col}22` : 'transparent', cursor: 'pointer', color: drawTool === t ? col : C.dim, fontSize: 9, whiteSpace: 'nowrap', overflow: 'hidden' }}>
              {icon} {label}
            </button>
          );
        })}
        <button onClick={onUndo} disabled={!canUndo} title="Desfer (Ctrl+Z)"
          style={{ padding: '5px 6px', borderRadius: 5, border: `1px solid ${C.border}`, background: 'transparent', cursor: canUndo ? 'pointer' : 'default', color: canUndo ? C.dim : 'rgba(139,148,158,0.25)', display: 'flex', flexShrink: 0 }}>
          <RotateCcw size={11} />
        </button>
        <button onClick={onClearDraw} title="Esborrar tot"
          style={{ padding: '5px 6px', borderRadius: 5, border: `1px solid ${C.border}`, background: 'transparent', cursor: 'pointer', color: C.dim, display: 'flex', flexShrink: 0 }}>
          <Trash2 size={11} />
        </button>
        {paintedZones.length > 0 && (
          <button onClick={onClearPaintedZones} title="Esborrar zones màgiques"
            style={{ padding: '5px 5px', borderRadius: 5, border: '1px solid rgba(168,85,247,0.4)', background: 'rgba(168,85,247,0.08)', cursor: 'pointer', color: '#a855f7', fontSize: 9, display: 'flex', alignItems: 'center', flexShrink: 0 }}>
            ✨{paintedZones.length}
          </button>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 3, opacity: (drawTool === 'pen' || drawTool === 'eraser') ? 1 : 0.22, pointerEvents: (drawTool === 'pen' || drawTool === 'eraser') ? 'auto' : 'none', transition: 'opacity 0.15s' }}>
        {PALETTE.map(c => (
          <div key={c} onClick={() => setDrawColor(c)} title={c}
            style={{ width: 14, height: 14, borderRadius: '50%', background: c, cursor: 'pointer', border: `2px solid ${drawColor === c ? '#e6edf3' : 'transparent'}`, boxSizing: 'border-box', flexShrink: 0 }} />
        ))}
        <input type="range" min={2} max={30} value={drawSize} onChange={e => setDrawSize(parseInt(e.target.value))}
          style={{ flex: 1, accentColor: drawColor, minWidth: 0 }} />
        <span style={{ color: C.dim, fontSize: 10, minWidth: 22, flexShrink: 0 }}>{drawSize}px</span>
      </div>
      {(drawTool === 'pen' || drawTool === 'eraser') && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 5, padding: '4px 0' }}>
          <div style={{
            width: Math.max(8, Math.min(drawSize * 2, 60)),
            height: Math.max(8, Math.min(drawSize * 2, 60)),
            borderRadius: '50%',
            background: drawTool === 'eraser' ? 'rgba(255,255,255,0.08)' : drawColor,
            border: drawTool === 'eraser' ? '1.5px dashed rgba(255,255,255,0.4)' : 'none',
            flexShrink: 0,
            transition: 'width 0.1s, height 0.1s',
          }} />
          <span style={{ fontSize: 9, color: C.dim }}>
            {drawTool === 'eraser' ? `Goma ×4 (${drawSize * 4}px)` : `Ploma (${drawSize}px)`}
          </span>
        </div>
      )}
    </div>
  );
}
