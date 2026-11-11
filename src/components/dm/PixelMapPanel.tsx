'use client';
import { MAX_TILE_CELLS, MAX_TILE_SIDE } from '@/lib/tilemap/model';
import React, { useRef, useState } from 'react';
import { C, FS, RADIUS } from '@/constants';
import { SidebarSection } from '@/components/ui/SidebarSection';
import { Button } from '@/components/ui/Button';
import { TilesIcon } from '@/components/icons';
import { useSpritePack } from '@/hooks/useSpritePack';

interface Props {
  /** Mida del mapa de caselles obert (null = no n'hi ha). */
  tileMapSize: { cols: number; rows: number } | null;
  onCreate: (cols: number, rows: number) => void;
  onImportTmx: (f: File) => void;
  onEdit: () => void;
}

const numStyle: React.CSSProperties = {
  width: 54, padding: '4px 6px', borderRadius: RADIUS.sm, border: `1px solid ${C.border}`,
  background: C.dark, color: C.bright, fontSize: FS.md, fontVariantNumeric: 'tabular-nums',
};

/**
 * App Píxel, pestanya Mapa: el mapa de caselles (crear-ne un de nou o importar-lo de Tiled).
 * Els sprites són a `public/sprites/` i es carreguen sols; aquí només es diu si encara no hi són.
 */
export function PixelMapPanel({ tileMapSize, onCreate, onImportTmx, onEdit }: Props) {
  const pack = useSpritePack();
  const tmxRef = useRef<HTMLInputElement>(null);
  const [cols, setCols] = useState(32);
  const [rows, setRows] = useState(22);
  const ready = pack.status === 'ready';
  const nCols = Math.max(8, Math.min(MAX_TILE_SIDE, cols | 0)), nRows = Math.max(8, Math.min(MAX_TILE_SIDE, rows | 0));
  const tooBig = nCols * nRows > MAX_TILE_CELLS;

  return (
    <>
      {pack.status !== 'ready' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 10px', fontSize: FS.sm, color: pack.status === 'error' ? C.enemy : C.dim }}>
          {pack.status === 'error' ? 'No s\'han pogut carregar els sprites (public/sprites/).' : 'Carregant els sprites…'}
        </div>
      )}

      <SidebarSection title="Mapa de caselles" icon={<TilesIcon size={13} />} bodyPadding="8px 10px 10px">
        {tileMapSize ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: FS.sm, color: C.text }}>{tileMapSize.cols} × {tileMapSize.rows} caselles</div>
            <Button variant="primary" size="md" onClick={onEdit} style={{ gap: 6 }}
              title="Les parets que pintis fan de parets de veritat: sales fosques, llum i moviment. Les torxes fan llum."><TilesIcon size={13} /> Editar (eina Caselles · 7)</Button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, opacity: ready ? 1 : 0.5 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: FS.sm, color: C.dim }}>
              <input type="number" min={8} max={MAX_TILE_SIDE} value={cols} onChange={e => setCols(+e.target.value)} style={numStyle} aria-label="Columnes" />
              ×
              <input type="number" min={8} max={MAX_TILE_SIDE} value={rows} onChange={e => setRows(+e.target.value)} style={numStyle} aria-label="Files" />
              caselles
            </div>
            {tooBig && (
              <div style={{ fontSize: FS.sm, color: C.enemy, lineHeight: 1.4 }}>
                Massa gran: màxim {MAX_TILE_CELLS.toLocaleString('ca-ES')} caselles en total (p. ex. 200 × 200) perquè el navegador ho aguanti.
              </div>
            )}
            <Button variant="primary" size="md" disabled={!ready || tooBig} onClick={() => onCreate(nCols, nRows)} style={{ gap: 6 }}>
              <TilesIcon size={13} /> Crear un mapa de caselles
            </Button>
            <Button variant="secondary" size="md" disabled={!ready} onClick={() => tmxRef.current?.click()}>Importar de Tiled (.tmx)</Button>
          </div>
        )}
        <input ref={tmxRef} type="file" accept=".tmx" style={{ display: 'none' }}
          onChange={e => { const f = e.target.files?.[0]; if (f) onImportTmx(f); e.target.value = ''; }} />
      </SidebarSection>
    </>
  );
}
