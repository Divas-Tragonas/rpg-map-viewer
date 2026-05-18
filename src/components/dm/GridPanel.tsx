'use client';
import React from 'react';
import { GridIcon } from '@/components/icons';
import { C } from '@/constants';

interface Props {
  gridVisible: boolean; gridSize: number; gridSnap: boolean;
  gridAutoSize: boolean; gridLineWidth: number; gridCalibrating: boolean;
  rGridVisible: React.MutableRefObject<boolean>;
  rGridSize: React.MutableRefObject<number>;
  rGridSnap: React.MutableRefObject<boolean>;
  rGridAutoSize: React.MutableRefObject<boolean>;
  rGridLineWidth: React.MutableRefObject<number>;
  rGridCalibrating: React.MutableRefObject<boolean>;
  rTokenSizeOverride: React.MutableRefObject<import('@/types').TokenSizeMap>;
  setGridVisible: (v: boolean) => void;
  setGridSize: (v: number) => void;
  setGridSnap: (v: boolean) => void;
  setGridAutoSize: (v: boolean) => void;
  setGridLineWidth: (v: number) => void;
  setGridCalibrating: (v: boolean) => void;
  setTokenSizeOverride: (v: import('@/types').TokenSizeMap) => void;
  onSnapAll: () => void;
  onSizeAll: () => void;
  onBroadcast: () => void;
  gridCalibRef: React.MutableRefObject<{ sx: number; sy: number } | null>;
  gridCalibCurrRef: React.MutableRefObject<{ cx: number; cy: number } | null>;
}

export function GridPanel({ gridVisible, gridSize, gridSnap, gridAutoSize, gridLineWidth, gridCalibrating, rGridVisible, rGridSize, rGridSnap, rGridAutoSize, rGridLineWidth, rGridCalibrating, rTokenSizeOverride, setGridVisible, setGridSize, setGridSnap, setGridAutoSize, setGridLineWidth, setGridCalibrating, setTokenSizeOverride, onSnapAll, onSizeAll, onBroadcast, gridCalibRef, gridCalibCurrRef }: Props) {
  return (
    <div style={{ borderTop: `1px solid ${C.border}`, padding: '10px 12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: gridVisible ? 6 : 0 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: C.dim, textTransform: 'uppercase', letterSpacing: '0.1em', flex: 1 }}>Grid</div>
        <button onClick={() => {
          const nv = !gridVisible; setGridVisible(nv); rGridVisible.current = nv;
          if (nv && !gridCalibrating) { setGridCalibrating(true); rGridCalibrating.current = true; gridCalibRef.current = null; gridCalibCurrRef.current = null; }
          if (!nv) { setGridCalibrating(false); rGridCalibrating.current = false; }
          onBroadcast();
        }} style={{ padding: '3px 9px', borderRadius: 5, border: `1px solid ${gridVisible ? C.accent : C.border}`, background: gridVisible ? `${C.accent}22` : 'transparent', cursor: 'pointer', color: gridVisible ? C.accent : C.dim, fontSize: 10, fontWeight: 600 }}>
          {gridVisible ? 'Desactivar' : 'Activar'}
        </button>
        <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, color: C.dim, cursor: 'pointer' }}>
          <input type="checkbox" checked={gridSnap} onChange={e => { setGridSnap(e.target.checked); rGridSnap.current = e.target.checked; if (e.target.checked) onSnapAll(); }} style={{ accentColor: C.accent }} />
          Snap
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, color: C.dim, cursor: 'pointer' }} title="Ajusta tots els tokens al 90% de la cel·la">
          <input type="checkbox" checked={gridAutoSize} onChange={e => {
            setGridAutoSize(e.target.checked); rGridAutoSize.current = e.target.checked;
            if (e.target.checked) onSizeAll(); else { setTokenSizeOverride({}); rTokenSizeOverride.current = {}; onBroadcast(); }
          }} style={{ accentColor: C.accent }} />
          Mida
        </label>
      </div>
      {gridVisible && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
            <button
              onClick={() => { setGridCalibrating(true); rGridCalibrating.current = true; gridCalibRef.current = null; gridCalibCurrRef.current = null; }}
              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', borderRadius: 5, border: `1px solid ${gridCalibrating ? C.accent : C.border}`, background: gridCalibrating ? `${C.accent}22` : 'transparent', cursor: 'pointer', color: gridCalibrating ? C.accent : C.dim, fontSize: 10 }}>
              <GridIcon size={10} />
              {gridCalibrating ? 'Calibrant...' : 'Calibrar cel·la'}
            </button>
            <span style={{ color: C.dim, fontSize: 10 }}>{gridSize}px</span>
            {gridCalibrating && (
              <button onClick={() => { setGridCalibrating(false); rGridCalibrating.current = false; gridCalibRef.current = null; gridCalibCurrRef.current = null; }}
                style={{ marginLeft: 'auto', padding: '3px 7px', borderRadius: 4, border: '1px solid rgba(248,81,73,.4)', background: 'transparent', cursor: 'pointer', color: '#f85149', fontSize: 10 }}>✕</button>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {[
              { label: 'Cel·la', value: gridSize, min: 1, max: 400, step: 1, set: (v: number) => { setGridSize(v); rGridSize.current = v; onBroadcast(); } },
              { label: 'Línia', value: gridLineWidth, min: 0.5, max: 10, step: 0.1, set: (v: number) => { setGridLineWidth(v); rGridLineWidth.current = v; onBroadcast(); } },
            ].map(({ label, value, min, max, step, set }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 3, flex: 1 }}>
                <span style={{ color: C.dim, fontSize: 10, flexShrink: 0 }}>{label}</span>
                <button onClick={() => set(Math.max(min, +(value - step).toFixed(1)))}
                  style={{ width: 20, height: 20, borderRadius: 4, border: `1px solid ${C.border}`, background: 'rgba(255,255,255,.04)', cursor: 'pointer', color: C.dim, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>−</button>
                <span style={{ color: C.text, fontSize: 11, minWidth: step < 1 ? 28 : 32, textAlign: 'center', flexShrink: 0 }}>{step < 1 ? value : Math.round(value)}px</span>
                <button onClick={() => set(Math.min(max, +(value + step).toFixed(1)))}
                  style={{ width: 20, height: 20, borderRadius: 4, border: `1px solid ${C.border}`, background: 'rgba(255,255,255,.04)', cursor: 'pointer', color: C.dim, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>+</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
