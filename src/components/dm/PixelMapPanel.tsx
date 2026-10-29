'use client';
import React, { useRef, useState } from 'react';
import { C, FS, RADIUS } from '@/constants';
import { SidebarSection } from '@/components/ui/SidebarSection';
import { Button } from '@/components/ui/Button';
import { Upload, TilesIcon, PixelSwordIcon, CheckIcon } from '@/components/icons';
import { useSpritePack } from '@/hooks/useSpritePack';
import { importPackZip, forgetPack } from '@/lib/sprites/pack';

interface Props {
  /** Mida del mapa de caselles obert (null = no n'hi ha). */
  tileMapSize: { cols: number; rows: number } | null;
  onCreate: (cols: number, rows: number) => void;
  onImportTmx: (f: File) => void;
  onEdit: () => void;
}

const SOURCE: Record<string, string> = {
  idb: 'desat en aquest navegador', local: 'de la carpeta local public/oryx', dm: 'enviat pel DM', zip: 'carregat del .zip',
};

const numStyle: React.CSSProperties = {
  width: 54, padding: '4px 6px', borderRadius: RADIUS.sm, border: `1px solid ${C.border}`,
  background: C.dark, color: C.bright, fontSize: FS.md, fontVariantNumeric: 'tabular-nums',
};

/**
 * App Píxel, pestanya Mapa: el paquet de sprites (d'on surten tots els gràfics) i el mapa
 * de caselles (crear-ne un de nou o importar-lo de Tiled).
 */
export function PixelMapPanel({ tileMapSize, onCreate, onImportTmx, onEdit }: Props) {
  const pack = useSpritePack();
  const zipRef = useRef<HTMLInputElement>(null);
  const tmxRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [cols, setCols] = useState(32);
  const [rows, setRows] = useState(22);
  const ready = pack.status === 'ready';

  const loadZip = async (f: File) => {
    setBusy(true); setErr(null);
    try { if (!(await importPackZip(f))) setErr('Aquest .zip no té els fulls del paquet (uf_heroes.png, uf_terrain.png…).'); }
    catch (e) { setErr((e as Error).message); }
    setBusy(false);
  };

  return (
    <>
      <SidebarSection title="Paquet de sprites" icon={<PixelSwordIcon size={13} />} defaultOpen={!ready} bodyPadding="8px 10px 10px">
        {ready ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: FS.sm, color: C.text }}>
            <CheckIcon size={13} color={C.ok} />
            <span style={{ flex: 1 }}>Oryx Ultimate Fantasy · {SOURCE[pack.source ?? ''] ?? ''}</span>
            {pack.source !== 'local' && (
              <Button size="sm" variant="ghost" onClick={() => void forgetPack()} title="Esborra els fulls d'aquest navegador">Oblidar</Button>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: FS.sm, color: C.dim, lineHeight: 1.5 }}>
              Deixa anar el <b style={{ color: C.text }}>.zip</b> del paquet tal com el vas comprar. Es desa en aquest navegador; les pantalles de jugador el reben del DM.
            </div>
            <Button variant="primary" size="md" disabled={busy || pack.status === 'loading'} onClick={() => zipRef.current?.click()} style={{ gap: 6 }}>
              <Upload size={13} /> {busy ? 'Llegint el paquet…' : 'Carregar el .zip'}
            </Button>
            {err && <div style={{ fontSize: FS.xs, color: C.enemy }}>{err}</div>}
          </div>
        )}
        <div style={{ fontSize: FS.xs, color: C.dim, lineHeight: 1.45, marginTop: 8, opacity: 0.8 }}>
          Els sprites tenen llicència de l&apos;autor: no es pugen enlloc ni van al repositori.
        </div>
        <input ref={zipRef} type="file" accept=".zip,application/zip" style={{ display: 'none' }}
          onChange={e => { const f = e.target.files?.[0]; if (f) void loadZip(f); e.target.value = ''; }} />
      </SidebarSection>

      <SidebarSection title="Mapa de caselles" icon={<TilesIcon size={13} />} bodyPadding="8px 10px 10px">
        {tileMapSize ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: FS.sm, color: C.text }}>{tileMapSize.cols} × {tileMapSize.rows} caselles</div>
            <Button variant="primary" size="md" onClick={onEdit} style={{ gap: 6 }}><TilesIcon size={13} /> Editar (eina Caselles · 7)</Button>
            <div style={{ fontSize: FS.xs, color: C.dim, lineHeight: 1.5 }}>
              Les parets que pintis fan de parets de veritat: sales fosques, llum i moviment. Les torxes fan llum.
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, opacity: ready ? 1 : 0.5 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: FS.sm, color: C.dim }}>
              <input type="number" min={8} max={120} value={cols} onChange={e => setCols(+e.target.value)} style={numStyle} aria-label="Columnes" />
              ×
              <input type="number" min={8} max={120} value={rows} onChange={e => setRows(+e.target.value)} style={numStyle} aria-label="Files" />
              caselles
            </div>
            <Button variant="primary" size="md" disabled={!ready} onClick={() => onCreate(Math.max(8, Math.min(120, cols | 0)), Math.max(8, Math.min(120, rows | 0)))} style={{ gap: 6 }}>
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
