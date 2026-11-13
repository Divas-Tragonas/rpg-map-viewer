'use client';
import React, { useMemo, useState } from 'react';
import { C, FS, RADIUS, SHADOW, tint } from '@/constants';
import { ScrollArea } from '@/components/ui/ScrollArea';
import { Button } from '@/components/ui/Button';
import { useSpritePack } from '@/hooks/useSpritePack';
import { FLOORS, WATERS, WALL_SETS, DECOR, OBJECT_KEYS, LOOT_KEYS, OBJECTS, PACK_OBJECT_GROUPS, objectDef, wallPiece } from '@/lib/tilemap/palette';
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
}

/** Una peça de la paleta (miniatura del full, a pixel art). */
function Swatch({ thumb, label, active, onClick }: { thumb: string | null; label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} title={label} aria-label={label} aria-pressed={active}
      style={{
        width: 40, height: 40, padding: 3, borderRadius: RADIUS.sm, cursor: 'pointer', flexShrink: 0,
        border: `1px solid ${active ? C.accent : C.border}`, background: active ? tint(C.accent, 0.14) : C.dark,
      }}>
      {thumb && <img src={thumb} alt="" style={{ width: 32, height: 32, imageRendering: 'pixelated', display: 'block' }} />}
    </button>
  );
}

/**
 * Eines per a les peces ja posades (pestanyes Objectes, Botí i Decorat): «Moure» arrossega un objecte
 * on es vulgui, fora de la graella; «Girar» gira 90° cada objecte o decorat que es cliqui. Es fan
 * servir com un pinzell més: es trien i després es clica al mapa (tornar a clicar una peça per pintar).
 */
function PlaceBar({ brush, onBrush, move }: { brush: TileBrush; onBrush: (b: TileBrush) => void; move: boolean }) {
  return (
    <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
      {move && (
        <Button size="sm" active={brush.kind === 'move'} onClick={() => onBrush({ kind: 'move' })} style={{ flex: 1, height: 28 }}
          title="Arrossega un objecte ja posat on vulguis, al píxel (Maj l'enganxa a la casella). Un decorat es mou de casella en casella.">
          <Move size={13} /> Moure
        </Button>
      )}
      <Button size="sm" active={brush.kind === 'rotate'} onClick={() => onBrush({ kind: 'rotate' })} style={{ flex: 1, height: 28 }}
        title="Clica un objecte o un decorat ja posat per girar-lo 90° (cada clic, un quart de volta). Amb qualsevol pinzell, la R gira el que hi ha sota el cursor.">
        <RedoIcon size={13} /> Girar
      </Button>
    </div>
  );
}

const Grid = ({ children }: { children: React.ReactNode }) => (
  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>{children}</div>
);
/** Seccions dels paquets de decorat nous (`assets/decor-packs/`) d'una pestanya. */
function PackGroups({ tab, is, pick }: { tab: 'objectes' | 'boti'; is: (b: TileBrush) => boolean; pick: (b: TileBrush) => void }) {
  return PACK_OBJECT_GROUPS.filter(g => g.tab === tab).map(g => (
    <React.Fragment key={g.label}>
      <Label>{g.label}</Label>
      <Grid>{g.keys.map(k => <Swatch key={k} thumb={tileThumb(k)} label={objectDef(k)?.label ?? k} active={is({ kind: 'object', key: k })} onClick={() => pick({ kind: 'object', key: k })} />)}</Grid>
    </React.Fragment>
  ));
}

const Label = ({ children }: { children: React.ReactNode }) => (
  <div style={{ fontSize: FS.xs, fontWeight: 700, color: C.dim, textTransform: 'uppercase', letterSpacing: '0.06em', margin: '8px 0 5px' }}>{children}</div>
);

/**
 * Paleta de l'eina Caselles (flyout de la barra d'eines, mode Preparar i estil Píxel).
 * «Sales» és el pinzell principal: un rectangle amb terra a dins i paret a la vora.
 */
export function TilePalette({ brush, onBrush }: Props) {
  const pack = useSpritePack();
  const [tab, setTab] = useState<Tab>('sala');
  // Terra i paret triats per a l'eina Sala (es recorden encara que es pinti amb un altre pinzell).
  const [roomFloor, setRoomFloor] = useState(brush.kind === 'room' ? brush.floor : 'dirt');
  const [roomWall, setRoomWall] = useState(brush.kind === 'room' ? brush.wall : 'dungeon');
  const ready = pack.status === 'ready';
  const world = useMemo(() => (ready && tab === 'mon' ? worldTiles() : []), [ready, tab]);

  const is = (b: TileBrush) => JSON.stringify(b) === JSON.stringify(brush);
  const pick = (b: TileBrush) => onBrush(b);

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
              <><PlaceBar brush={brush} onBrush={onBrush} move />
              <Label>Mobles i detalls</Label><Grid>
                {OBJECT_KEYS.map(k => <Swatch key={k} thumb={tileThumb(k)} label={OBJECTS[k].label + (OBJECTS[k].lightFt ? ' · fa llum' : '')} active={is({ kind: 'object', key: k })} onClick={() => pick({ kind: 'object', key: k })} />)}
              </Grid>
              <PackGroups tab="objectes" is={is} pick={pick} /></>
            )}
            {tab === 'boti' && (
              <><PlaceBar brush={brush} onBrush={onBrush} move />
              <Label>Objectes del full de botí</Label><Grid>
                {LOOT_KEYS.map(k => <Swatch key={k} thumb={tileThumb(k)} label={objectDef(k)?.label ?? k} active={is({ kind: 'object', key: k })} onClick={() => pick({ kind: 'object', key: k })} />)}
              </Grid>
              <PackGroups tab="boti" is={is} pick={pick} /></>
            )}
            {tab === 'decorat' && <PlaceBar brush={brush} onBrush={onBrush} move />}
            {tab === 'decorat' && DECOR.map(g => (
              <React.Fragment key={g.label}>
                <Label>{g.label}</Label>
                <Grid>{g.tiles.map(tile => <Swatch key={tile} thumb={tileThumb(tile)} label={g.label} active={is({ kind: 'decor', tile })} onClick={() => pick({ kind: 'decor', tile })} />)}</Grid>
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
        title={brush.kind === 'move' ? 'Arrossega un objecte on vulguis (un decorat, de casella en casella) · Maj l\'enganxa a la casella · clic dret: menú de capes'
          : brush.kind === 'rotate' ? 'Clica un objecte o un decorat per girar-lo 90° · clic dret: menú de capes'
          : 'Arrossega per pintar · Maj omple un rectangle · clic dret: capes (arrossegant, esborra) · R gira el de sota'}>
        {brush.kind === 'move' ? 'Arrossegar · Maj a la casella · clic dret: capes'
          : brush.kind === 'rotate' ? 'Clic: girar 90° · clic dret: capes'
          : 'Pintar · Maj omple · clic dret: capes o esborrar'}
      </div>
    </div>
  );
}
