'use client';
import React, { useState } from 'react';
import { C, FS, CONDITIONS_BY_ID } from '@/constants';
import { ABILITIES, DAMAGE_TYPES, type DamageType } from '@/lib/characters';
import { monsterSave, type Monster } from '@/lib/monsters';
import type { Defenses } from '@/lib/rules/damage';

const dmg = (list?: DamageType[]) => (list ?? []).map(t => DAMAGE_TYPES.find(d => d.id === t)?.label ?? t).join(', ');
const signed = (n: number) => (n >= 0 ? `+${n}` : String(n));
const mod = (s: number) => Math.floor((s - 10) / 2);

/**
 * Fitxa de 5e d'un enemic al menú del token (v5 snapshot 6): plegada per defecte, una línia amb
 * CA · PV · VD i, desplegada, característiques, salvacions, defenses, immunitats a estats, atacs i
 * trets. Del bestiari de l'app (`MONSTERS`) o, per als enemics de la BD, només les defenses. Els
 * jugadors de DIVAS hi tenen la mateixa fitxa feta des de la seva fitxa de personatge
 * (`monsterFromCharacter`, `player`: surt el nivell en lloc del valor de repte).
 */
export function MonsterBlock({ monster, defenses, player }: { monster: Monster | null; defenses?: Defenses; player?: boolean }) {
  const [open, setOpen] = useState(false);
  if (!monster && !defenses) return null;
  const d = defenses;
  const line = (label: string, text: string | undefined) => text ? (
    <div style={{ fontSize: FS.xs, color: C.text, lineHeight: 1.35 }}><b style={{ color: C.dim, fontWeight: 600 }}>{label}</b> {text}</div>
  ) : null;
  const nm = (list?: DamageType[]) => list?.length ? 'B/P/S d\'armes no màgiques' : undefined;
  const join = (...parts: (string | undefined)[]) => parts.filter(Boolean).join('; ') || undefined;
  return (
    <div style={{ padding: '6px 8px', borderTop: `1px solid ${C.border}` }}>
      <button type="button" onMouseDown={e => { e.stopPropagation(); setOpen(o => !o); }}
        style={{ all: 'unset', cursor: 'pointer', display: 'flex', width: '100%', alignItems: 'center', gap: 6, fontSize: FS.xs, color: C.dim, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        <span>{open ? '▾' : '▸'} Fitxa 5e</span>
        {monster && <span style={{ marginLeft: 'auto', textTransform: 'none', letterSpacing: 0, color: C.text }}>CA {monster.ac} · {player ? monster.cr : `VD ${monster.cr}`} · {monster.speed} ft</span>}
      </button>
      {open && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 5 }}>
          {monster && <div style={{ fontSize: FS.xs, color: C.bright, fontWeight: 700 }}>{monster.name}</div>}
          {monster?.abilities && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 2, textAlign: 'center' }}>
              {ABILITIES.map((a, i) => (
                <div key={a.id} style={{ fontSize: FS.xs, color: C.dim }}>
                  {a.label}<div style={{ color: C.text }}>{monster.abilities![i]} ({signed(mod(monster.abilities![i]))})</div>
                  <div title="Salvació" style={{ color: monster.saves?.[a.id] !== undefined ? C.bright : C.dim }}>s {signed(monsterSave(monster, a.id) ?? 0)}</div>
                </div>
              ))}
            </div>
          )}
          {monster && line('Velocitat', `${monster.speed} ft${monster.move ? `, ${monster.move}` : ''}`)}
          {line('Vulnerable', dmg(d?.vulnerabilities) || undefined)}
          {line('Resistent', join(dmg(d?.resistances) || undefined, nm(d?.nonMagicResistances)))}
          {line('Immune', join(dmg(d?.immunities) || undefined, nm(d?.nonMagicImmunities)))}
          {line('Immune a estats', d?.conditionImmunities?.map(c => CONDITIONS_BY_ID.get(c)?.label ?? c).join(', '))}
          {line('Abast', d?.reachFt !== undefined ? `${d.reachFt} ft` : undefined)}
          {monster?.attacks.map(a => line(a.name, `${a.bonus ?? ''} · ${a.damage ?? '—'} ${DAMAGE_TYPES.find(x => x.id === a.damageType)?.label ?? ''} · ${a.kind === 'ranged' ? `${a.rangeFt}/${a.longFt} ft` : a.kind === 'thrown' ? `${a.reachFt ?? 5} ft o ${a.rangeFt}/${a.longFt} ft` : `${a.reachFt ?? 5} ft`}`))}
          {monster?.traits?.map(tr => <div key={tr} style={{ fontSize: FS.xs, color: C.dim, lineHeight: 1.35 }}>• {tr}</div>)}
        </div>
      )}
    </div>
  );
}
