'use client';
import React, { useState } from 'react';
import { X } from '@/components/icons';
import { Button } from '@/components/ui/Button';
import { HpControl } from '@/components/ui/HpControl';
import { Switch } from '@/components/ui/Switch';
import { ConditionIcon } from '@/components/ui/ConditionIcon';
import { C, FS, RADIUS, tint, CONDITIONS, DEFAULT_SPEED_FT, DEFAULT_VISION_FT, feetFromRadius } from '@/constants';
import type { ConditionsMap, DefeatedMap, LibEnemy, MapStructure, Player, PsdEnemyOverride, PsdEnemyOverrides, TokenSizeMap } from '@/types';

interface Props {
  tokenId: string | number;
  players: Player[];
  libEnemies: LibEnemy[];
  /** PSD real (null si el mapa és només una imatge). */
  struct: MapStructure | null;
  psdEnemyOverrides: PsdEnemyOverrides;
  conditions: ConditionsMap;
  defeated: DefeatedMap;
  tokenSizeOverride: TokenSizeMap;
  gridSize: number;
  onClose: () => void;
  onRenamePlayer: (id: number, name: string) => void;
  onAdjustPlayerHp: (id: number, delta: number) => void;
  onSetPlayerHpMax: (id: number, hpMax: number) => void;
  onSetPlayerSpeed: (id: number, speed: number) => void;
  onSetPlayerVision: (id: number, visionFt: number) => void;
  onSetPlayerCanMove: (id: number, canMove: boolean) => void;
  onRemovePlayer: (id: number) => void;
  onAdjustLibHp: (id: number, delta: number) => void;
  onSetLibProps: (id: number, props: Partial<LibEnemy>) => void;
  onAdjustPsdHp: (id: number, delta: number) => void;
  onSetPsdProps: (id: number, props: PsdEnemyOverride) => void;
  onSetTokenSize: (id: string, feet: number) => void;
}

const field: React.CSSProperties = {
  width: '100%', minWidth: 0, height: 26, boxSizing: 'border-box', background: C.bg, border: `1px solid ${C.border}`,
  borderRadius: RADIUS.sm, color: C.text, fontSize: FS.md, fontWeight: 700, textAlign: 'center', outline: 'none', padding: '0 4px',
};

/**
 * Camp numèric que només aplica en confirmar (Enter o perdre el focus): mentre s'escriu no
 * es toca l'estat, o sigui que esborrar el número per escriure'n un altre no deixa el token
 * a 0 a mig camí (i no s'envia cap STATE per cada tecla).
 */
function NumField({ label, value, unit, min, max, step = 1, color, title, onCommit }: {
  label: string; value: number; unit?: string; min: number; max: number; step?: number; color?: string; title?: string;
  onCommit: (v: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    if (draft === null) return;
    const v = parseFloat(draft.replace(',', '.'));
    setDraft(null);
    if (Number.isFinite(v) && v >= min && v <= max && v !== value) onCommit(v);
  };
  return (
    <label title={title} style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
      <span style={{ fontSize: FS.xs, color: C.dim, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <input type="number" inputMode="decimal" min={min} max={max} step={step}
          value={draft ?? String(value)}
          onFocus={e => { setDraft(String(value)); e.target.select(); }}
          onChange={e => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); else if (e.key === 'Escape') { setDraft(null); (e.target as HTMLInputElement).blur(); } }}
          style={{ ...field, color: color ?? C.text }} />
        {unit && <span style={{ fontSize: FS.xs, color: C.dim, flexShrink: 0 }}>{unit}</span>}
      </span>
    </label>
  );
}

/** Nom editable: s'aplica en confirmar; buit, torna al que hi havia. */
function NameField({ value, onCommit }: { value: string; onCommit: (v: string) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    if (draft === null) return;
    const v = draft.trim();
    setDraft(null);
    if (v && v !== value) onCommit(v);
  };
  return (
    <input value={draft ?? value} aria-label="Nom del token" title="Clic per canviar el nom"
      onFocus={() => setDraft(value)}
      onChange={e => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); else if (e.key === 'Escape') { setDraft(null); (e.target as HTMLInputElement).blur(); } }}
      style={{ flex: 1, minWidth: 0, height: 26, background: 'transparent', border: '1px solid transparent', borderRadius: RADIUS.sm, color: C.bright, fontSize: FS.lg, fontWeight: 700, outline: 'none', padding: '0 4px' }}
      onMouseEnter={e => { if (draft === null) e.currentTarget.style.borderColor = C.border; }}
      onMouseLeave={e => { if (draft === null) e.currentTarget.style.borderColor = 'transparent'; }} />
  );
}

function initials(name: string) {
  return name.trim().slice(0, 2).toUpperCase() || '?';
}

/**
 * **Fitxa del token** seleccionat, a baix del lateral: nom, vida, vida màxima, mida i, als
 * jugadors, velocitat, visió i si es poden moure des de la seva pantalla. Abans aquests camps
 * estaven repartits entre el menú del clic dret (nom, vida màxima, mida) i un engranatge a
 * cada targeta de jugador; ara el clic dret és només per a accions ràpides.
 *
 * Els estats actius es mostren però no s'editen aquí: es canvien al menú del clic dret.
 */
export function TokenSheet(p: Props) {
  const [confirmDel, setConfirmDel] = useState(false);
  const key = String(p.tokenId);

  // ── Resol el token, sigui de quina família sigui ────────────────────────────
  let name = '', kind = '', hp = 0, hpMax = 0, radius = 25;
  let color: string = C.enemy;
  let adjustHp: ((d: number) => void) | null = null;
  let setHpMax: (v: number) => void = () => {};
  let rename: (v: string) => void = () => {};
  let player: Player | undefined;

  if (key.startsWith('pl_')) {
    player = p.players.find(pl => `pl_${pl.id}` === key);
    if (!player) return null;
    const pl = player;
    name = pl.name; color = pl.color; kind = 'Jugador';
    hp = pl.hp ?? pl.hpMax; hpMax = pl.hpMax; radius = 22;
    adjustHp = d => p.onAdjustPlayerHp(pl.id, d);
    setHpMax = v => p.onSetPlayerHpMax(pl.id, v);
    rename = v => p.onRenamePlayer(pl.id, v);
  } else if (key.startsWith('lib_')) {
    const en = p.libEnemies.find(e => `lib_${e.id}` === key);
    if (!en) return null;
    name = en.name; color = en.color; kind = 'Enemic';
    hp = en.hp ?? en.hpMax; hpMax = en.hpMax; radius = en.R ?? 25;
    adjustHp = d => p.onAdjustLibHp(en.id, d);
    setHpMax = v => p.onSetLibProps(en.id, { hpMax: v, hp: Math.min(en.hp ?? v, v) });
    rename = v => p.onSetLibProps(en.id, { name: v });
  } else if (typeof p.tokenId === 'number') {
    const id = p.tokenId;
    const en = p.struct?.enemyRooms.flatMap(r => r.enemies).find(e => e.id === id);
    if (!en) return null;
    const ov = p.psdEnemyOverrides[id] ?? {};
    name = ov.name ?? en.name; kind = 'Enemic del PSD';
    hpMax = ov.hpMax ?? 0; hp = Math.max(0, ov.hp ?? hpMax);
    radius = Math.max(Math.min(en.w, en.h) / 2, 22);
    adjustHp = d => p.onAdjustPsdHp(id, d);
    // Posar-li vida per primer cop l'omple; canviar-la després no li torna la que ha perdut.
    setHpMax = v => p.onSetPsdProps(id, { hpMax: v, hp: hpMax > 0 ? Math.min(hp, v) : v });
    rename = v => p.onSetPsdProps(id, { name: v });
  } else {
    return null;
  }

  const sizeFt = feetFromRadius(p.tokenSizeOverride[key] ?? radius, p.gridSize);
  const isDefeated = !!p.defeated[key];
  const conds = (p.conditions[key] ?? []).map(cid => CONDITIONS.find(c => c.id === cid)).filter(Boolean) as typeof CONDITIONS;

  return (
    <section aria-label={`Fitxa de ${name}`}
      style={{ borderTop: `1px solid ${C.border}`, background: C.panel, padding: '8px 10px 10px', display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span aria-hidden style={{ width: 26, height: 26, borderRadius: '50%', background: color, color: '#fff', fontSize: FS.xs, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: `0 0 0 2px ${tint(color, 0.35)}` }}>
          {initials(name)}
        </span>
        <NameField key={`${key}:${name}`} value={name} onCommit={rename} />
        <button onClick={p.onClose} aria-label="Tancar la fitxa" title="Tancar (deselecciona el token)"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.dim, padding: 3, display: 'flex', flexShrink: 0 }}>
          <X size={13} />
        </button>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: -4, paddingLeft: 32 }}>
        <span style={{ fontSize: FS.xs, color: C.dim, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Fitxa · {kind}</span>
        {isDefeated && <span style={{ fontSize: FS.xs, color: C.enemy, fontWeight: 700 }}>· derrotat</span>}
      </div>

      {hpMax > 0 && adjustHp && <HpControl hp={hp} hpMax={hpMax} onAdjust={adjustHp} size="md" />}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
        <NumField label={hpMax > 0 ? 'Vida màxima' : 'Vida màxima (sense)'} value={hpMax} min={player ? 1 : 0} max={9999}
          color={C.hpHigh} title={player ? undefined : '0 = sense vida'} onCommit={setHpMax} />
        <NumField label="Mida" unit="ft" value={sizeFt} min={1} max={100} step={0.5}
          title="Diàmetre del token en peus" onCommit={v => p.onSetTokenSize(key, v)} />
        {player && (() => {
          const pl = player;
          const speed = pl.speed ?? DEFAULT_SPEED_FT;
          const vision = pl.visionFt ?? DEFAULT_VISION_FT;
          return (
            <>
              <NumField label={`Velocitat · ${Math.floor(speed / 5)} cas.`} unit="ft" value={speed} min={0} max={995} step={5}
                color={C.accent} onCommit={v => p.onSetPlayerSpeed(pl.id, v)} />
              <NumField label={vision <= 0 ? 'Visió · sense llum' : 'Visió a les fosques'} unit="ft" value={vision} min={0} max={995} step={5}
                color={C.hpMid} title="Radi de llum que emet el token dins de sales fosques (0 = sense llum)"
                onCommit={v => p.onSetPlayerVision(pl.id, v)} />
            </>
          );
        })()}
      </div>

      {player && (() => {
        const pl = player;
        const canMove = pl.canMove !== false;
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ flex: 1, fontSize: FS.sm, color: C.text }}>Es pot moure des de la seva pantalla</span>
            <Switch on={canMove} onChange={() => p.onSetPlayerCanMove(pl.id, !canMove)} label="Es pot moure des de la seva pantalla" />
          </div>
        );
      })()}

      {conds.length > 0 && (
        <div title="Els estats es canvien amb el clic dret sobre el token" style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
          {conds.map(c => (
            <span key={c.id} title={c.label}
              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 7px 2px 3px', borderRadius: RADIUS.pill, background: tint(c.color, 0.16), border: `1px solid ${tint(c.color, 0.45)}`, color: C.text, fontSize: FS.xs, fontWeight: 600 }}>
              <span style={{ width: 16, height: 16, borderRadius: '50%', background: c.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ConditionIcon id={c.id} size={12} on={c.color} />
              </span>
              {c.label}
            </span>
          ))}
        </div>
      )}

      {player && (() => {
        const pl = player;
        return confirmDel ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ flex: 1, fontSize: FS.sm, color: C.enemy, fontWeight: 700 }}>Eliminar {pl.name}?</span>
            <Button size="sm" variant="danger" onClick={() => { setConfirmDel(false); p.onRemovePlayer(pl.id); }}>Sí, eliminar</Button>
            <Button size="sm" onClick={() => setConfirmDel(false)}>No</Button>
          </div>
        ) : (
          <Button size="sm" variant="ghost" onClick={() => setConfirmDel(true)}
            style={{ alignSelf: 'flex-start', color: tint(C.enemy, 0.8), padding: '3px 0' }}>
            Eliminar el jugador
          </Button>
        );
      })()}
    </section>
  );
}
