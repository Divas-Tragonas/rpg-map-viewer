'use client';
import React from 'react';
import { AlertTriangle } from '@/components/icons';
import { DropZone } from '@/components/ui/DropZone';
import { SidebarSection, SectionButton } from '@/components/ui/SidebarSection';
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
  React.useEffect(() => {
    if (warnings.length === 0 || parseError || warningsDismissed) return;
    const t = setTimeout(() => setWarningsDismissed(true), 10000);
    return () => clearTimeout(t);
  }, [warnings, parseError, warningsDismissed, setWarningsDismissed]);

  return (
    // Un cop hi ha mapa carregat la secció es plega sola: no cal tenir sempre a la vista
    // les dues caixes d'importació, que és espai que treu a les sales i als jugadors.
    // (el `key` fa que en carregar el primer mapa la secció es torni a muntar ja plegada)
    <SidebarSection key={bgLoaded ? 'loaded' : 'empty'} title="Importar" icon="📂" defaultOpen={!bgLoaded} bodyPadding="0 12px 7px"
      actions={
        <SectionButton onClick={onLoadDemo} title="Carregar demo (mapa + PSD)" active color={C.accent}>DEMO</SectionButton>
      }>
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
    </SidebarSection>
  );
}
