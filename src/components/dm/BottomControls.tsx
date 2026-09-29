'use client';
import React from 'react';
import Link from 'next/link';
import { Maximize2, ZoomIn, ZoomOut, SaveIcon, LoadIcon } from '@/components/icons';
import { Button, IconButton, buttonStyle } from '@/components/ui/Button';
import { C, FS } from '@/constants';

interface Props {
  /** Hi ha mapa carregat? Sense mapa, el zoom, l'opacitat i desar no fan res i s'amaguen. */
  hasMap: boolean;
  zoom: number;
  onZoomChange: (z: number) => void;
  onSave: () => void;
  onLoad: (file: File) => void;
  onOpenPlayer: () => void;
  onOpenServer?: () => void;
  bgOpacity: number;
  onBgOpacityChange: (v: number) => void;
}

export function BottomControls({ hasMap, zoom, onZoomChange, onSave, onLoad, onOpenPlayer, onOpenServer, bgOpacity, onBgOpacityChange }: Props) {
  return (
    <div style={{ padding: '10px 12px', borderTop: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', gap: 7 }}>
      <Button variant="primary" size="lg" block onClick={onOpenPlayer} style={{ gap: 8 }}>
        <Maximize2 size={14} /> Modo Jugador
      </Button>
      <div style={{ display: 'flex', gap: 6 }}>
        <Button size="sm" style={{ flex: 1, gap: 5, padding: '6px' }} onClick={onSave} disabled={!hasMap}
          title={hasMap ? 'Guardar sesión en JSON' : 'Carrega un mapa per poder desar la partida'}>
          <SaveIcon size={11} /> Guardar
        </Button>
        <label title="Cargar sesión desde JSON"
          style={{ ...buttonStyle('secondary', 'sm'), flex: 1, gap: 5, padding: '6px' }}>
          <input type="file" accept=".json" style={{ display: 'none' }} onChange={e => { if (e.target.files?.[0]) { onLoad(e.target.files[0]); (e.target as HTMLInputElement).value = ''; } }} />
          <LoadIcon size={11} /> Cargar
        </label>
      </div>
      {onOpenServer && (
        <Button size="sm" block onClick={onOpenServer} title="Desar / carregar partides al servidor" style={{ padding: '6px' }}>
          ☁ Partides al servidor
        </Button>
      )}
      <Link href="/admin" target="_blank" style={{ ...buttonStyle('ghost', 'sm', { block: true }), padding: '4px', textDecoration: 'none' }}>
        🗡️ Back Office
      </Link>
      {hasMap && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <IconButton size={22} onClick={() => onZoomChange(Math.max(0.2, zoom - 0.1))} title="Allunyar" style={{ color: C.dim }}>
              <ZoomOut size={11} />
            </IconButton>
            <input type="range" min={0.2} max={10} step={0.05} value={zoom} onChange={e => onZoomChange(parseFloat(e.target.value))}
              style={{ flex: 1, accentColor: C.accent }} />
            <IconButton size={22} onClick={() => onZoomChange(Math.min(10, zoom + 0.1))} title="Apropar" style={{ color: C.dim }}>
              <ZoomIn size={11} />
            </IconButton>
            <span style={{ color: C.dim, fontSize: FS.sm, minWidth: 34, textAlign: 'right' }}>{Math.round(zoom * 100)}%</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }} title="Opacitat del fons (només a la teva pantalla; els jugadors el veuen sempre opac)">
            <span style={{ color: C.dim, fontSize: FS.md, width: 22, textAlign: 'center' }}>🗺️</span>
            <input type="range" min={0.1} max={1} step={0.05} value={bgOpacity} onChange={e => onBgOpacityChange(parseFloat(e.target.value))}
              style={{ flex: 1, accentColor: C.accent }} />
            <span style={{ color: C.dim, fontSize: FS.sm, minWidth: 34, textAlign: 'right' }}>{Math.round(bgOpacity * 100)}%</span>
          </div>
        </>
      )}
    </div>
  );
}
