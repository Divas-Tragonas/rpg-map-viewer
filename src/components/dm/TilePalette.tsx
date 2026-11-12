'use client';
import React, { useMemo, useState } from 'react';
import { C, FS, RADIUS, SHADOW, tint } from '@/constants';
import { ScrollArea } from '@/components/ui/ScrollArea';
import { Button } from '@/components/ui/Button';
import { useSpritePack } from '@/hooks/useSpritePack';
import { FLOORS, WATERS, WALL_SETS, DECOR, OBJECT_KEYS, LOOT_KEYS, OBJECTS, objectDef, wallPiece } from '@/lib/tilemap/palette';
import { t } from '@/lib/tilemap/model';
import { tileThumb, worldTiles } from '@/lib/tilemap/render';
import type { TileBrush } from '@/lib/tilemap/editor';
import { Move, RedoIcon } from '@/components/icons';

type Tab = 'sala' | 'terra' | 'aigua' | 'paret' | 'objectes' | 'boti' | 'decorat' | 'mon';
const TABS: [Tab, string][] = [
  ['sala', 'Sales'], ['terra', 'Terra'], ['aigua', 'Aigua'], ['paret', 'Parets'],
  ['objectes', 'Objectes'], ['boti', 'Botí'], ['decorat', 'Decorat'], ['mon', 'Món'],
];

interface Props {
  brush: TileBrush;
  onBrush: (b: TileBrush) => void;
  /** Girar 90° (el mateix que la tecla R): el pinzell o, amb «Moure», l'objecte triat. */
  onRotate: () => void;
}

/** Una peça de la paleta (miniatura del full, a pixel art). `rot`: quarts de volta (es veu girada). */
function Swatch({ thumb, label, active, onClick, rot = 0 }: { thumb: string | null; label: string; active: boolean; onClick: () => void; rot?: number }) {
  return (
    <button onClick={onClick} title={label} aria-label={label} aria-pressed={active}
      style={{
        width: 40, height: 40, padding: 3, borderRadius: RADIUS.sm, cursor: 'pointer', flexShrink: 0,
        border: `1px solid ${active ? C.accent : C.border}`, background: active ? tint(C.accent, 0.14) : C.dark,
      }}>
      {thumb && <img src={thumb} alt="" style={{ width: 32, height: 32, imageRendering: 'pixelated', display: 'block', transform: rot ? `rotate(${rot * 90}deg)` : undefined }} />}
    </button>
  );
}

/**
 * Orientació i col·locació (pestanyes Objectes, Botí i Decorat): «Girar» (R) i, per als objectes,
 * el pinzell «Moure», que arrossega un objecte ja posat on es vulgui, fora de la graella.
 */
function PlaceBar({ rot, moving, onRotate, onMove }: { rot: number; moving: boolean; onRotate: () => void; onMove?: () => void }) {
  return (
    <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
      {onMove && (
        <Button size="sm" active={moving} onClick={onMove} style={{ flex: 1, height: 28 }}
          title="Arrossega un objecte ja posat on vulguis, al píxel (Maj l'enganxa a la casella). Clica'l i prem R per girar-lo.">
          <Move size={13} /> Moure
        </Button>
      )}
      <Button size="sm" onClick={onRotate} style={{ flex: 1, height: 28 }}
        title={moving ? 'Gira 90° l\'objecte triat (R)' : 'Gira 90° el que pintis d\'aquí endavant (R)'}>
        <RedoIcon size={13} /> Girar{moving ? '' : ` · ${rot * 90}°`}
      </Button>
    </div>
  );
}

const Grid = ({ children }: { children: React.ReactNode }) => (
  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>{children}</div>
);
const Label = ({ children }: { children: React.ReactNode }) => (
  <div style={{ fontSize: FS.xs, fontWeight: 700, color: C.dim, textTransform: 'uppercase', letterSpacing: '0.06em', margin: '8px 0 5px' }}>{children}</div>
);

/**
 * Paleta de l'eina Caselles (flyout de la barra d'eines, mode Preparar i estil Píxel).
 * «Sales» és el pinzell principal: un rectangle amb terra a dins i paret a la vora.
 */
export function TilePalette({ brush, onBrush, onRotate }: Props) {
  const pack = useSpritePack();
  const [tab, setTab] = useState<Tab>('sala');
  // Terra i paret triats per a l'eina Sala (es recorden encara que es pinti amb un altre pinzell).
  const [roomFloor, setRoomFloor] = useState(brush.kind === 'room' ? brush.floor : 'dirt');
  const [roomWall, setRoomWall] = useState(brush.kind === 'room' ? brush.wall : 'dungeon');
  const ready = pack.status === 'ready';
  const world = useMemo(() => (ready && tab === 'mon' ? worldTiles() : []), [ready, tab]);

  // La rotació no compta per saber quina peça és la triada; en canviar de peça, es conserva.
  const rot = brush.kind === 'decor' || brush.kind === 'object' ? brush.rot ?? 0 : 0;
  const strip = (b: TileBrush) => JSON.stringify(b.kind === 'decor' || b.kind === 'object' ? { ...b, rot: 0 } : b);
  const is = (b: TileBrush) => strip(b) === strip(brush);
  const pick = (b: TileBrush) => onBrush(b.kind === 'decor' || b.kind === 'object' ? { ...b, rot } : b);
  const moving = brush.kind === 'move';
  const toMove = () => onBrush({ kind: 'move' });

  return (
    <div style={{ width: 312, borderRadius: RADIUS.lg, background: C.float, border: `1px solid ${C.border}`, boxShadow: SHADOW.float, pointerEvents: 'auto', display: 'flex', flexDirection: 'column', maxHeight: 'min(560px, calc(100vh - 140px))' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2, padding: 6, borderBottom: `1px solid ${C.border}` }}>
        {TABS.map(([id, label]) => (
          <Button key={id} size="sm" active={tab === id} variant="ghost" onClick={() => setTab(id)} style={{ height: 24, padding: '0 7px' }}>{label}</Button>
        ))}
      </div>
      {!ready ? (
        <div style={{ padding: 12, fontSize: FS.sm, color: C.dim, lineHeight: 1.5 }}>
          Cal el paquet de sprites. Carrega&apos;l a la pestanya <b style={{ color: C.text }}>Mapa</b> del lateral.
        </div>
      ) : (
        <ScrollArea style={{ flex: 1, minHeight: 0 }}>
          <div style={{ padding: '4px 10px 10px' }}>
            {tab === 'sala' && (
              <>
                <Button size="sm" active={brush.kind === 'room'} onClick={() => pick({ kind: 'room', floor: roomFloor, wall: roomWall })}
                  style={{ width: '100%', marginTop: 8, height: 28 }}>
                  Sala: arrossega un rectangle
                </Button>
                <Label>Paret</Label>
                <Grid>
                  {WALL_SETS.map(w => (
                    <Swatch key={w.id} thumb={tileThumb(wallPiece(w, 1, 2))} label={w.label} active={roomWall === w.id}
                      onClick={() => { setRoomWall(w.id); setRoomFloor(w.floor); pick({ kind: 'room', floor: w.floor, wall: w.id }); }} />
                  ))}
                </Grid>
                <Label>Terra</Label>
                <Grid>
                  {FLOORS.map(f => (
                    <Swatch key={f.id} thumb={tileThumb(f.tiles[0])} label={f.label} active={roomFloor === f.id}
                      onClick={() => { setRoomFloor(f.id); pick({ kind: 'room', floor: f.id, wall: roomWall }); }} />
                  ))}
                </Grid>
                <Label>Porta</Label>
                <Button size="sm" active={brush.kind === 'door'} onClick={() => pick({ kind: 'door' })} style={{ width: '100%', height: 28 }}>
                  Porta: clica una paret entre dues sales
                </Button>
              </>
            )}
            {tab === 'terra' && (
              <><Label>Terra</Label><Grid>
                {FLOORS.map(f => <Swatch key={f.id} thumb={tileThumb(f.tiles[0])} label={f.label} active={is({ kind: 'floor', floor: f.id })} onClick={() => pick({ kind: 'floor', floor: f.id })} />)}
              </Grid></>
            )}
            {tab === 'aigua' && (
              <><Label>Aigua i lava (animades)</Label><Grid>
                {WATERS.map(w => <Swatch key={w.id} thumb={tileThumb(w.base)} label={w.label} active={is({ kind: 'water', water: w.id })} onClick={() => pick({ kind: 'water', water: w.id })} />)}
              </Grid></>
            )}
            {tab === 'paret' && (
              <>
                <Label>Paret (s&apos;ajusta sola)</Label>
                <Grid>
                  {WALL_SETS.map(w => <Swatch key={w.id} thumb={tileThumb(wallPiece(w, 1, 2))} label={w.label} active={is({ kind: 'wall', wall: w.id })} onClick={() => pick({ kind: 'wall', wall: w.id })} />)}
                </Grid>
                <Label>Porta</Label>
                <Grid>
                  <Swatch thumb={tileThumb(t(10, 13))} label="Porta (dins d'una paret recta)" active={brush.kind === 'door'} onClick={() => pick({ kind: 'door' })} />
                </Grid>
              </>
            )}
            {tab === 'objectes' && (
              <><PlaceBar rot={rot} moving={moving} onRotate={onRotate} onMove={toMove} />
              <Label>Mobles i detalls</Label><Grid>
                {OBJECT_KEYS.map(k => <Swatch key={k} rot={rot} thumb={tileThumb(k)} label={OBJECTS[k].label + (OBJECTS[k].lightFt ? ' · fa llum' : '')} active={is({ kind: 'object', key: k })} onClick={() => pick({ kind: 'object', key: k })} />)}
              </Grid></>
            )}
            {tab === 'boti' && (
              <><PlaceBar rot={rot} moving={moving} onRotate={onRotate} onMove={toMove} />
              <Label>Objectes del full de botí</Label><Grid>
                {LOOT_KEYS.map(k => <Swatch key={k} rot={rot} thumb={tileThumb(k)} label={objectDef(k)?.label ?? k} active={is({ kind: 'object', key: k })} onClick={() => pick({ kind: 'object', key: k })} />)}
              </Grid></>
            )}
            {tab === 'decorat' && <PlaceBar rot={rot} moving={false} onRotate={onRotate} />}
            {tab === 'decorat' && DECOR.map(g => (
              <React.Fragment key={g.label}>
                <Label>{g.label}</Label>
                <Grid>{g.tiles.map(tile => <Swatch key={tile} rot={rot} thumb={tileThumb(tile)} label={g.label} active={is({ kind: 'decor', tile })} onClick={() => pick({ kind: 'decor', tile })} />)}</Grid>
              </React.Fragment>
            ))}
            {tab === 'mon' && (
              <><Label>Mapa del món</Label><Grid>
                {world.map(tile => <Swatch key={tile} thumb={tileThumb(tile)} label="Mapa del món" active={is({ kind: 'world', tile })} onClick={() => pick({ kind: 'world', tile })} />)}
              </Grid></>
            )}
          </div>
        </ScrollArea>
      )}
      <div style={{ padding: '6px 10px', borderTop: `1px solid ${C.border}`, fontSize: FS.xs, color: C.dim, lineHeight: 1.5 }}
        title={moving ? 'Arrossega un objecte on vulguis · Maj l\'enganxa a la casella · R gira l\'objecte triat · clic dret esborra'
          : 'Arrossega per pintar · Maj omple un rectangle · R gira el decorat o l\'objecte · clic dret esborra'}>
        {moving ? 'Arrossegar · Maj a la casella · R gira' : 'Pintar · Maj omple · R gira · clic dret esborra'}
      </div>
    </div>
  );
}
