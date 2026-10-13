'use client';
import React, { useRef, useState } from 'react';
import { Switch } from '@/components/ui/Switch';
import { C, FS, RADIUS, DEFAULT_SPEED_FT, DEFAULT_VISION_FT, feetFromRadius, FONT_SERIF } from '@/constants';
import type { LibEnemy, MapStructure, Player, PsdEnemyOverride, PsdEnemyOverrides, TokenSizeMap } from '@/types';

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
