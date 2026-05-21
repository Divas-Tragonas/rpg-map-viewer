'use client';
import React from 'react';
import { AlertTriangle } from '@/components/icons';
import { DropZone } from '@/components/ui/DropZone';
import { C } from '@/constants';
import type { MapStructure, PSDInfo } from '@/types';

interface Props {
  bgLoaded: boolean; bgName: string;
  parsing: boolean; struct: MapStructure | null; psdInfo: PSDInfo | null;
  parseError: string | null;
  warnings: string[]; warningsDismissed: boolean;
  setWarningsDismissed: (v: boolean) => void;
  onLoadBg: (f: File) => void;
  onLoadPSD: (f: File) => void;
  onLoadDemo: () => void;
}

export function ImportPanel({ bgLoaded, bgName, parsing, struct, psdInfo, parseError, warnings, warningsDismissed, setWarningsDismissed, onLoadBg, onLoadPSD, onLoadDemo }: Props) {
  return (
    <div style={{ padding: '6px 12px 7px', borderBottom: `1px solid ${C.border}` }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: C.dim, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Importar</div>
        <button onClick={onLoadDemo} title="Carregar demo (mapa + PSD)"
          style={{ background: `${C.accent}18`, border: `1px solid ${C.accent}`, borderRadius: 5, padding: '2px 8px', cursor: 'pointer', color: C.accent, fontSize: 10, fontWeight: 700, letterSpacing: '0.04em' }}>
          DEMO
        </button>
      </div>
      <div style={{ display: 'flex', gap: 4 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <DropZone accept="image/*,video/*"
            label={bgLoaded ? bgName : 'Img/Vídeo'} sub={bgLoaded ? '✓ OK' : 'Clic o arrastre'}
            active={bgLoaded} color={bgLoaded ? C.ok : C.dim}
            onFile={onLoadBg} onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) onLoadBg(f); }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <DropZone accept=".psd"
            label={parsing ? 'Procesando...' : struct ? 'PSD ✓' : 'PSD'}
            sub={psdInfo ? `${psdInfo.width}×${psdInfo.height}` : parseError ? 'Error' : 'Clic o arrastre'}
            active={!!struct} color={struct ? C.ok : parseError ? C.enemy : C.room}
            onFile={onLoadPSD} onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) onLoadPSD(f); }} disabled={parsing} />
        </div>
      </div>
      {parsing && <div style={{ marginTop: 6, color: C.dim, fontSize: 11, textAlign: 'center' }}>Extrayendo imágenes de capas...</div>}
      {parseError && (
        <div style={{ marginTop: 5, padding: '6px 9px', borderRadius: 6, background: 'rgba(248,81,73,.1)', border: '1px solid rgba(248,81,73,.3)', color: '#ffa0a0', fontSize: 12, lineHeight: 1.5 }}>
          <AlertTriangle size={12} style={{ verticalAlign: 'middle', marginRight: 5 }} />{parseError}
        </div>
      )}
      {warnings.length > 0 && !parseError && !warningsDismissed && (
        <div style={{ marginTop: 5, padding: '5px 9px', borderRadius: 5, background: 'rgba(210,153,34,.08)', border: '1px solid rgba(210,153,34,.25)', color: C.warn, fontSize: 11, lineHeight: 1.6, position: 'relative' }}>
          <button onClick={() => setWarningsDismissed(true)}
            style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', right: 4, background: 'none', border: 'none', cursor: 'pointer', color: C.dim, fontSize: 12 }}>✕</button>
          {warnings.map((w, i) => <div key={i}>• {w}</div>)}
        </div>
      )}
    </div>
  );
}
