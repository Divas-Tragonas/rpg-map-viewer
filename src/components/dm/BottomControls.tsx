'use client';
import React from 'react';
import Link from 'next/link';
import { Maximize2, ZoomIn, ZoomOut, SaveIcon, LoadIcon } from '@/components/icons';
import { Chip } from '@/components/ui/Chip';
import { C } from '@/constants';
import type { MapStructure, PSDInfo } from '@/types';

interface Props {
  zoom: number;
  onZoomChange: (z: number) => void;
  psdInfo: PSDInfo | null;
  struct: MapStructure | null;
  activeCount: number;
  layerImagesCount: number;
  onSave: () => void;
  onLoad: (file: File) => void;
  onOpenPlayer: () => void;
}

export function BottomControls({ zoom, onZoomChange, psdInfo, struct, activeCount, layerImagesCount, onSave, onLoad, onOpenPlayer }: Props) {
  return (
    <div style={{ padding: '12px 14px', borderTop: `1px solid ${C.border}` }}>
      <button onClick={onOpenPlayer}
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '9px', borderRadius: 7, border: 'none', cursor: 'pointer', background: C.accent, color: '#0d1117', fontWeight: 700, fontSize: 12, marginBottom: 8 }}>
        <Maximize2 size={14} /> Modo Jugador
      </button>
      <Link href="/admin" target="_blank" style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        padding: '6px', borderRadius: 6, border: `1px solid ${C.border}`,
        background: 'transparent', color: C.dim, fontSize: 10, textDecoration: 'none',
        marginBottom: 8,
      }}>
        🗡️ Back Office
      </Link>
      <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
        <button onClick={onSave} title="Guardar sesión en JSON"
          style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, padding: '6px', borderRadius: 6, border: `1px solid ${C.border}`, background: 'transparent', cursor: 'pointer', color: C.dim, fontSize: 10 }}>
          <SaveIcon size={11} /> Guardar
        </button>
        <label title="Cargar sesión desde JSON"
          style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, padding: '6px', borderRadius: 6, border: `1px solid ${C.border}`, background: 'transparent', cursor: 'pointer', color: C.dim, fontSize: 10 }}>
          <input type="file" accept=".json" style={{ display: 'none' }} onChange={e => { if (e.target.files?.[0]) { onLoad(e.target.files[0]); (e.target as HTMLInputElement).value = ''; } }} />
          <LoadIcon size={11} /> Cargar
        </label>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
        <button onClick={() => onZoomChange(Math.max(0.2, zoom - 0.1))}
          style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 5, cursor: 'pointer', color: C.dim, padding: '3px 6px', display: 'flex' }}>
          <ZoomOut size={11} />
        </button>
        <input type="range" min={0.2} max={5} step={0.05} value={zoom} onChange={e => onZoomChange(parseFloat(e.target.value))}
          style={{ flex: 1, accentColor: C.accent }} />
        <button onClick={() => onZoomChange(Math.min(5, zoom + 0.1))}
          style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 5, cursor: 'pointer', color: C.dim, padding: '3px 6px', display: 'flex' }}>
          <ZoomIn size={11} />
        </button>
        <span style={{ color: C.dim, fontSize: 12, minWidth: 34, textAlign: 'right' }}>{Math.round(zoom * 100)}%</span>
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {psdInfo && <Chip>{psdInfo.width}×{psdInfo.height}</Chip>}
        {struct && <Chip col={C.enemy}>{activeCount} activos</Chip>}
        {layerImagesCount > 0 && <Chip col={C.ok}>{layerImagesCount} imgs</Chip>}
      </div>
    </div>
  );
}
