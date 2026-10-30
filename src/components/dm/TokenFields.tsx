'use client';
import React, { useRef, useState } from 'react';
import { Switch } from '@/components/ui/Switch';
import { C, FS, RADIUS, DEFAULT_SPEED_FT, DEFAULT_VISION_FT, feetFromRadius, FONT_SERIF, tint } from '@/constants';
import type { LibEnemy, MapStructure, Player, PsdEnemyOverride, PsdEnemyOverrides, TokenSizeMap } from '@/types';
import { Button } from '@/components/ui/Button';
import { SpritePicker, PortraitBuilder } from '@/components/dm/PixelPickers';
import { creatureThumb, creatureVariants, parseSprite, spriteName } from '@/lib/sprites/draw';
import { useSpritePack } from '@/hooks/useSpritePack';

/** Dades i accions per editar un token des del menú del clic dret. */
export interface TokenEditProps {
  players: Player[];
  libEnemies: LibEnemy[];
  /** PSD real (null si el mapa és només una imatge). */
  struct: MapStructure | null;
  psdEnemyOverrides: PsdEnemyOverrides;
  tokenSizeOverride: TokenSizeMap;
  gridSize: number;
  onRenamePlayer: (id: number, name: string) => void;
  onAdjustPlayerHp: (id: number, delta: number) => void;
  onSetPlayerHpMax: (id: number, hpMax: number) => void;
  onSetPlayerSpeed: (id: number, speed: number) => void;
  onSetPlayerVision: (id: number, visionFt: number) => void;
  onSetPlayerCanMove: (id: number, canMove: boolean) => void;
  onAdjustLibHp: (id: number, delta: number) => void;
  onSetLibProps: (id: number, props: Partial<LibEnemy>) => void;
  onAdjustPsdHp: (id: number, delta: number) => void;
  onSetPsdProps: (id: number, props: PsdEnemyOverride) => void;
  onSetTokenSize: (id: string, feet: number) => void;
  /** App Píxel: figureta de qualsevol token i retrat dels jugadors. */
  pixel?: boolean;
  onSetPlayerLook?: (id: number, look: { sprite?: string; portrait?: string }) => void;
}

/** Un token resolt, sigui de quina família sigui (jugador, biblioteca o PSD). */
export interface ResolvedToken {
  key: string;
  name: string;
  hp: number;
  hpMax: number;
  /** Radi en píxels de mapa (el de l'override de mida si en té). */
  radius: number;
  player?: Player;
  lib?: LibEnemy;
  /** Figureta actual (app Píxel) i com canviar-la. */
  sprite?: string;
  setSprite: (s: string | undefined) => void;
  adjustHp: (d: number) => void;
  setHpMax: (v: number) => void;
  rename: (v: string) => void;
}

/** Troba el token per l'id (`pl_*`, `lib_*` o número del PSD) i en prepara les accions. */
export function resolveToken(id: string | number, p: TokenEditProps): ResolvedToken | null {
  const key = String(id);
  if (key.startsWith('pl_')) {
    const pl = p.players.find(x => `pl_${x.id}` === key);
    if (!pl) return null;
    return {
      key, name: pl.name, hp: pl.hp ?? pl.hpMax, hpMax: pl.hpMax, radius: p.tokenSizeOverride[key] ?? 22, player: pl,
      sprite: pl.sprite, setSprite: s => p.onSetPlayerLook?.(pl.id, { sprite: s }),
      adjustHp: d => p.onAdjustPlayerHp(pl.id, d),
      setHpMax: v => p.onSetPlayerHpMax(pl.id, v),
      rename: v => p.onRenamePlayer(pl.id, v),
    };
  }
  if (key.startsWith('lib_')) {
    const en = p.libEnemies.find(e => `lib_${e.id}` === key);
    if (!en) return null;
    return {
      key, name: en.name, hp: en.hp ?? en.hpMax, hpMax: en.hpMax, radius: p.tokenSizeOverride[key] ?? en.R ?? 25, lib: en,
      sprite: en.sprite, setSprite: s => p.onSetLibProps(en.id, { sprite: s }),
      adjustHp: d => p.onAdjustLibHp(en.id, d),
      setHpMax: v => p.onSetLibProps(en.id, { hpMax: v, hp: Math.min(en.hp ?? v, v) }),
      rename: v => p.onSetLibProps(en.id, { name: v }),
    };
  }
  if (typeof id !== 'number') return null;
  const en = p.struct?.enemyRooms.flatMap(r => r.enemies).find(e => e.id === id);
  if (!en) return null;
  const ov = p.psdEnemyOverrides[id] ?? {};
  const hpMax = ov.hpMax ?? 0;
  const hp = Math.max(0, ov.hp ?? hpMax);
  return {
    key, name: ov.name ?? en.name, hp, hpMax, radius: p.tokenSizeOverride[key] ?? Math.max(Math.min(en.w, en.h) / 2, 22),
    sprite: ov.sprite, setSprite: s => p.onSetPsdProps(id, { sprite: s }),
    adjustHp: d => p.onAdjustPsdHp(id, d),
    // Posar-li vida per primer cop l'omple; canviar-la després no li torna la que ha perdut.
    setHpMax: v => p.onSetPsdProps(id, { hpMax: v, hp: hpMax > 0 ? Math.min(hp, v) : v }),
    rename: v => p.onSetPsdProps(id, { name: v }),
  };
}

/** Atura l'Esc d'un camp: cancel·la l'edició però no tanca el menú (que l'escolta a `window`). */
function fieldKeys(e: React.KeyboardEvent<HTMLInputElement>, cancelled: React.MutableRefObject<boolean>) {
  if (e.key === 'Enter') e.currentTarget.blur();
  else if (e.key === 'Escape') { e.stopPropagation(); cancelled.current = true; e.currentTarget.blur(); }
}

/**
 * Camp numèric que només aplica en confirmar (Enter o perdre el focus; Esc cancel·la): mentre
 * s'escriu no es toca l'estat, o sigui que esborrar el número per escriure'n un altre no deixa
 * el token a 0 a mig camí (i no s'envia cap STATE per cada tecla).
 */
function NumField({ label, value, min, max, step = 1, color, title, onCommit }: {
  label: string; value: number; min: number; max: number; step?: number; color?: string; title?: string;
  onCommit: (v: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  // L'Esc fa `blur()` abans que React hagi aplicat el `setDraft(null)`: sense aquesta marca,
  // el `onBlur` encara veuria l'esborrany i l'aplicaria.
  const cancelled = useRef(false);
  const commit = () => {
    const skip = cancelled.current;
    cancelled.current = false;
    if (draft === null) return;
    setDraft(null);
    if (skip) return;
    const v = parseFloat(draft.replace(',', '.'));
    if (Number.isFinite(v) && v >= min && v <= max && v !== value) onCommit(v);
  };
  return (
    <label title={title} style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
      <span style={{ fontSize: FS.xs, color: C.dim, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
      <input type="number" inputMode="decimal" min={min} max={max} step={step}
        value={draft ?? String(value)}
        onFocus={e => { setDraft(String(value)); e.target.select(); }}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => fieldKeys(e, cancelled)}
        style={{
          width: '100%', minWidth: 0, height: 24, boxSizing: 'border-box', background: C.bg, border: `1px solid ${C.border}`,
          borderRadius: RADIUS.sm, color: color ?? C.text, fontSize: FS.md, fontWeight: 700, textAlign: 'center', outline: 'none', padding: '0 2px',
        }} />
    </label>
  );
}

/** Nom editable (capçalera del menú): s'aplica en confirmar; buit, torna al que hi havia. */
export function NameField({ value, onCommit }: { value: string; onCommit: (v: string) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  const cancelled = useRef(false);
  const commit = () => {
    const skip = cancelled.current;
    cancelled.current = false;
    if (draft === null) return;
    setDraft(null);
    const v = draft.trim();
    if (!skip && v && v !== value) onCommit(v);
  };
  return (
    <input value={draft ?? value} aria-label="Nom del token" title="Clic per canviar el nom"
      onFocus={() => setDraft(value)}
      onChange={e => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={e => fieldKeys(e, cancelled)}
      style={{ flex: 1, minWidth: 0, height: 26, background: 'transparent', border: '1px solid transparent', borderRadius: RADIUS.sm, color: C.bright, fontFamily: FONT_SERIF, fontSize: 17, fontWeight: 600, outline: 'none', padding: '0 4px', marginLeft: -5 }}
      onMouseEnter={e => { if (draft === null) e.currentTarget.style.borderColor = C.border; }}
      onMouseLeave={e => { if (draft === null) e.currentTarget.style.borderColor = 'transparent'; }} />
  );
}

/**
 * Camps de la fitxa d'un token, compactes per cabre al menú del clic dret: vida màxima i mida
 * a tots i, als jugadors, velocitat, visió a les fosques i si es poden moure des de la seva
 * pantalla. Una sola fila de camps (dos als enemics, quatre als jugadors).
 */
export function TokenFields({ t, p }: { t: ResolvedToken; p: TokenEditProps }) {
  const pl = t.player;
  const sizeFt = feetFromRadius(t.radius, p.gridSize);
  const speed = pl?.speed ?? DEFAULT_SPEED_FT;
  const vision = pl?.visionFt ?? DEFAULT_VISION_FT;
  const canMove = pl?.canMove !== false;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${pl ? 4 : 2}, minmax(0, 1fr))`, gap: 6 }}>
        <NumField label="Vida màx." value={t.hpMax} min={pl ? 1 : 0} max={9999} color={C.hpHigh}
          title={pl ? 'Vida màxima' : 'Vida màxima (0 = sense vida)'} onCommit={t.setHpMax} />
        <NumField label="Mida · ft" value={sizeFt} min={1} max={100} step={0.5}
          title="Diàmetre del token en peus" onCommit={v => p.onSetTokenSize(t.key, v)} />
        {pl && (
          <>
            <NumField label="Vel. · ft" value={speed} min={0} max={995} step={5}
              title={`Velocitat: ${speed} ft = ${Math.floor(speed / 5)} caselles`} onCommit={v => p.onSetPlayerSpeed(pl.id, v)} />
            <NumField label="Visió · ft" value={vision} min={0} max={995} step={5}
              title="Visió a les fosques: radi de llum que emet dins de sales fosques (0 = sense llum)"
              onCommit={v => p.onSetPlayerVision(pl.id, v)} />
          </>
        )}
      </div>
      {p.pixel && <PixelLook t={t} p={p} />}
      {pl && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ flex: 1, fontSize: FS.sm, color: canMove ? C.text : C.dim }}>Es mou des de la seva pantalla</span>
          <Switch on={canMove} onChange={() => p.onSetPlayerCanMove(pl.id, !canMove)} label="Es mou des de la seva pantalla"
            title={canMove ? 'El jugador pot moure el token des de /player' : 'Bloquejat: només el DM el pot moure'} />
        </div>
      )}
    </div>
  );
}

/** App Píxel: la figureta del token (tots) i el retrat (jugadors), amb el seu selector. */
function PixelLook({ t, p }: { t: ResolvedToken; p: TokenEditProps }) {
  useSpritePack();
  const [open, setOpen] = useState<'sprite' | 'portrait' | null>(null);
  const pl = t.player;
  const thumb = t.sprite ? creatureThumb(t.sprite) : null;
  const box: React.CSSProperties = { width: 32, height: 32, borderRadius: RADIUS.sm, background: C.dark, border: `1px solid ${C.border}`, imageRendering: 'pixelated', flexShrink: 0 };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      {thumb ? <img src={thumb} alt="" style={box} /> : <div style={box} />}
      <Button size="sm" variant="secondary" onMouseDown={e => { e.stopPropagation(); setOpen('sprite'); }} style={{ flex: 1, height: 26 }}>
        {t.sprite ? 'Canviar la figureta' : 'Triar figureta'}
      </Button>
      {pl && (
        <>
          {pl.portrait ? <img src={pl.portrait} alt="" style={box} /> : <div style={box} />}
          <Button size="sm" variant="secondary" onMouseDown={e => { e.stopPropagation(); setOpen('portrait'); }} style={{ flex: 1, height: 26 }}>Retrat</Button>
        </>
      )}
      {open === 'sprite' && <SpritePicker value={t.sprite} onPick={t.setSprite} onClose={() => setOpen(null)} />}
      {open === 'portrait' && pl && <PortraitBuilder onPick={url => p.onSetPlayerLook?.(pl.id, { portrait: url })} onClose={() => setOpen(null)} />}
    </div>
    {t.sprite && <SpriteVariants sprite={t.sprite} onChange={t.setSprite} />}
    </div>
  );
}

/**
 * Variants de color de la figureta (`uf_heroes_v1/2.png`, fetes amb `scripts/oryx-variants.py`):
 * l'original i les que tingui, en miniatura. Només canvien la roba o el cos, amb colors triats
 * per a cada criatura (res de paleta lliure: amb colors a l'atzar les figures quedaven empastades).
 */
function SpriteVariants({ sprite, onChange }: { sprite: string; onChange: (s: string) => void }) {
  const { name, variant } = parseSprite(sprite);
  const names = creatureVariants(name);
  if (!names.length) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ fontSize: FS.sm, color: C.dim, flex: 1 }}>Variant</span>
      {['original', ...names].map((label, v) => {
        const on = v === variant;
        const th = creatureThumb(spriteName(name, v));
        return (
          <button key={v} onClick={() => onChange(spriteName(name, v))} title={v ? `Variant ${v}: ${label}` : 'Colors originals'}
            aria-label={v ? `Variant ${v}: ${label}` : 'Original'} aria-pressed={on}
            style={{ width: 34, height: 34, padding: 0, cursor: 'pointer', borderRadius: RADIUS.sm, background: on ? tint(C.accent, 0.12) : C.dark, border: `1px solid ${on ? C.accent : C.border}` }}>
            {th && <img src={th} alt="" style={{ width: 32, height: 32, imageRendering: 'pixelated', display: 'block' }} />}
          </button>
        );
      })}
    </div>
  );
}
