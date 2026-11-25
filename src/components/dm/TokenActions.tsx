'use client';
import React from 'react';
import { SparklesIcon, SwordsIcon } from '@/components/icons';
import { PixelIcon } from '@/components/ui/PixelIcon';
import { attackIcon, isUiIcon } from '@/lib/sprites/uiicon';
import { Button } from '@/components/ui/Button';
import { C, FS, RADIUS, SPELL_BY_TYPE, SPELL_MODES, AREA_SPELL_DATA, spellRangeFt, spellbookFor } from '@/constants';
import type { AttackPending, Player, LibEnemy, SpellType } from '@/types';
import type { ApiCharacter } from '@/lib/api';
import { type AmmoStack, ammoLeft, attacksOf, attackRanges, characterFor, sheetOf, DAMAGE_TYPES, type SheetAttack } from '@/lib/characters';
import { monsterForEnemy } from '@/lib/db-enemies';
import { enemyDefenses } from '@/lib/rules/damage';
import { powerDef, powerName, spentKey, REST_SPENT, type MonsterPower } from '@/lib/monster-powers';

/*
 * Accions d'un token: atacs, munició, habilitats/poders i conjurs (v5.42).
 * Abans vivien dins del menú del clic dret; ara són al panell d'accions de la dreta
 * (`CombatActionsPanel`), que en combat mostra sol el token que té el torn.
 * `armed`: l'acció que espera el clic de destí (`atk:<nom>`, `pow:<id>`, `spell:<tipus>`), ressaltada.
 */

const sectionLabel: React.CSSProperties = {
  fontSize: FS.xs, color: C.dim, marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.08em',
};

/** Atac genèric dels tokens sense atacs a la fitxa (enemics, amb el seu abast; jugadors sense fitxa). */
const GENERIC_MELEE: SheetAttack = { name: 'Cos a cos', kind: 'melee', reachFt: 5 };

const rangeText = (a: SheetAttack) => {
  const { normalFt, longFt } = attackRanges(a);
  return longFt ? `${normalFt}/${longFt}` : `${normalFt}`;
};

/**
 * Atacs del token (fitxa del jugador; els enemics, de moment, un cos a cos genèric de 5 ft).
 * Triar-ne un tanca el menú i deixa el ratolí apuntant: anell d'abast, línia i peus fins al
 * token assenyalat (vora a vora). Només informa: si encerta i el dany es decideixen a la taula.
 */
function AttackList({ attacks, onPick, ammoOf, armed }: { attacks: SheetAttack[]; onPick: (a: SheetAttack) => void; ammoOf?: (a: SheetAttack) => number | null; armed?: string | null }) {
  return (
    <div style={{ padding: '6px 8px', borderTop: `1px solid ${C.border}` }}>
      <div style={{ ...sectionLabel, display: 'flex', alignItems: 'center', gap: 5 }}><SwordsIcon size={11} /> Atacs</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
        {attacks.map((a, i) => {
          const dmg = DAMAGE_TYPES.find(d => d.id === a.damageType)?.label;
          const left = ammoOf?.(a) ?? null;
          const out = left === 0;
          const kind = a.kind === 'melee' ? 'cos a cos' : a.kind === 'thrown' ? 'llançadissa' : 'a distància';
          return (
            <Button key={`${a.name}-${i}`} size="sm" variant="tint" color={C.enemy} active={armed === `atk:${a.name}`}
              title={`${a.name} · ${kind} · ${rangeText(a)} ft${a.bonus ? ` · ${a.bonus}` : ''}${a.damage ? ` · ${a.damage}` : ''}${dmg ? ` ${dmg}` : ''}${left !== null ? ` · ${left} ${a.ammo?.toLowerCase()}` : ''}${out ? ' (sense munició)' : ''}\nClic al mapa (o al token objectiu) · Esc o clic dret cancel·la`}
              disabled={out}
              onMouseDown={e => { e.stopPropagation(); if (!out) onPick(a); }}
              style={{ justifyContent: 'flex-start', minWidth: 0, gap: 4, height: 'auto', minHeight: 26, padding: '3px 6px', lineHeight: 1.15 }}>
              <PixelIcon name={attackIcon(a.name, a.kind)} />
              <span style={{ flex: 1, minWidth: 0, whiteSpace: 'normal', textAlign: 'left', overflowWrap: 'anywhere' }}>{a.name}</span>
              <span style={{ color: out ? C.enemy : C.dim, fontSize: FS.xs, flexShrink: 0 }}>{left !== null ? `${left}× · ` : ''}{rangeText(a)}</span>
            </Button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Munició del jugador (v5.02): una fila per pila amb − / + per recollir o perdre peces a mà (a banda
 * del tret, que en gasta una sola). Maj+clic = de 5 en 5. Es desa a la fitxa.
 */
function AmmoControls({ stacks, onAdjust }: { stacks: AmmoStack[]; onAdjust: (name: string, delta: number) => void }) {
  const btn: React.CSSProperties = { width: 24, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.dark, color: C.text, border: `1px solid ${C.border}`, borderRadius: RADIUS.sm, cursor: 'pointer', padding: 0, fontSize: FS.md, lineHeight: 1 };
  return (
    <div style={{ padding: '6px 8px', borderTop: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={sectionLabel}>Munició</div>
      {stacks.map(st => (
        <div key={st.name} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ flex: 1, minWidth: 0, color: C.text, fontSize: FS.sm, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{st.name}</span>
          <button type="button" title="Perd una (Maj = 5)" style={btn} onMouseDown={e => e.stopPropagation()} onClick={e => onAdjust(st.name, e.shiftKey ? -5 : -1)}>−</button>
          <span style={{ minWidth: 26, textAlign: 'center', color: st.count === 0 ? C.enemy : C.bright, fontWeight: 700, fontSize: FS.sm }}>{st.count}</span>
          <button type="button" title="Recupera una (Maj = 5)" style={btn} onMouseDown={e => e.stopPropagation()} onClick={e => onAdjust(st.name, e.shiftKey ? 5 : 1)}>+</button>
        </div>
      ))}
    </div>
  );
}

/**
 * Poders d'una criatura (v5 snapshot 9): els seus encanteris i accions especials, com el grimori dels
 * jugadors. Agrupats: accions (alès, mirades…), a voluntat i trucs, per nivell i per dia. Un poder amb
 * recàrrega gastat en combat surt apagat amb la recàrrega que cal; es pot fer servir igualment.
 */
function PowerList({ powers, spent, onCast, title = 'Poders i conjurs', armed }: { powers: MonsterPower[]; spent: Record<string, number>; onCast: (p: MonsterPower) => void; title?: string; armed?: string | null }) {
  const groupOf = (p: MonsterPower) => p.def ? 'Accions' : p.atWill ? 'A voluntat' : p.perDay ? `${p.perDay}/dia` : p.level === 0 ? 'Trucs' : `Nivell ${p.level}`;
  const groups: { g: string; list: MonsterPower[] }[] = [];
  for (const p of powers) {
    if (!powerDef(p)) continue;
    const g = groupOf(p);
    const e = groups.find(x => x.g === g);
    if (e) e.list.push(p); else groups.push({ g, list: [p] });
  }
  if (!groups.length) return null;
  return (
    <div style={{ padding: '6px 8px', borderTop: `1px solid ${C.border}` }}>
      <div style={{ ...sectionLabel, display: 'flex', alignItems: 'center', gap: 5 }}><SparklesIcon size={11} /> {title}</div>
      {groups.map(({ g, list }) => (
        <div key={g} style={{ marginBottom: 4 }}>
          <div style={{ fontSize: FS.xs, color: C.dim, margin: '2px 0 3px' }}>{g}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
            {list.map(p => {
              const d = powerDef(p)!;
              const meta = SPELL_BY_TYPE.get(d.anim);
              const used = spent[spentKey(p)];
              const byRest = used !== undefined && used > 6;
              const reach = d.mode === 'self' ? (d.aoeFt ? `${d.aoeFt} ft al voltant` : 'personal') : d.lineFt ? `${d.lineFt} ft` : `${d.rangeFt} ft`;
              const tags = [p.dc ? `CD ${p.dc}` : '', p.attack !== undefined ? `+${p.attack}` : '', d.dice ?? '', p.recharge ? `recàrrega ${p.recharge === 6 ? '6' : `${p.recharge}–6`}` : '', p.rest ? `1 cop per descans ${p.rest === 'short' ? 'curt' : 'llarg'}` : '', d.fx ? '' : 'sense efecte de joc'].filter(Boolean).join(' · ');
              return (
                <Button key={p.id} size="sm" variant="tint" color={meta?.color ?? C.magic} active={armed === `pow:${p.id}`}
                  title={`${powerName(p)} · ${reach}${tags ? ` · ${tags}` : ''}${used ? (byRest ? `\nGastat: torna amb un descans ${used === REST_SPENT.short ? 'curt' : 'llarg'} (es pot fer servir igualment)` : `\nGastat: es recarrega amb ${used}–6 a l'inici del seu torn`) : ''}\n${d.mode === 'self' ? 'Surt de la criatura' : 'Clic al mapa per triar el destí · Esc o clic dret cancel·la'}`}
                  onMouseDown={e => { e.stopPropagation(); onCast(p); }}
                  style={{ justifyContent: 'flex-start', minWidth: 0, gap: 4, height: 'auto', minHeight: 26, padding: '3px 6px', lineHeight: 1.15, opacity: used ? 0.45 : 1 }}>
                  {isUiIcon(d.anim) ? <PixelIcon name={d.anim} /> : <span style={{ flexShrink: 0 }}>{meta?.emoji}</span>}
                  <span style={{ flex: 1, minWidth: 0, whiteSpace: 'normal', textAlign: 'left', overflowWrap: 'anywhere' }}>{powerName(p)}</span>
                  {used ? <span style={{ color: C.dim, fontSize: FS.xs, flexShrink: 0 }}>{byRest ? '⟳' : `${used}–6`}</span>
                    : p.recharge || p.rest ? <span style={{ color: C.dim, fontSize: FS.xs, flexShrink: 0 }}>⟳</span> : null}
                </Button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Grimori del jugador (conjurs de la seva fitxa al Notion, `SPELLBOOKS`) agrupat pel gest
 * de l'app: direccionals, a un punt dins d'abast i personals. Triar-ne un tanca el menú i
 * deixa la màgia pendent del clic de destí (les personals surten a l'instant).
 */
function Spellbook({ playerName, onCast, armed }: { playerName: string; onCast: (type: import('@/types').SpellType) => void; armed?: string | null }) {
  const book = spellbookFor(playerName);
  if (book.length === 0) return null;
  const groupOf = (t: string) => {
    const mode = SPELL_BY_TYPE.get(t)?.mode;
    if (mode === 'self' || AREA_SPELL_DATA[t]?.rangeFt === 0) return 'self';
    return mode === 'area' ? 'area' : 'line';
  };
  const groups = (['line', 'area', 'self'] as const)
    .map(g => ({ g, spells: book.filter(b => groupOf(b.type) === g) }))
    .filter(x => x.spells.length > 0);
  const GROUP_LABEL = { line: SPELL_MODES.line.title, area: 'A un punt', self: SPELL_MODES.self.title };
  return (
    <div style={{ padding: '6px 8px', borderTop: `1px solid ${C.border}` }}>
      <div style={{ ...sectionLabel, display: 'flex', alignItems: 'center', gap: 5 }}><SparklesIcon size={11} /> Conjurs</div>
      {groups.map(({ g, spells }) => (
        <div key={g} style={{ marginBottom: 4 }}>
          <div style={{ fontSize: FS.xs, color: C.dim, margin: '2px 0 3px' }}>{GROUP_LABEL[g]}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
            {spells.map(b => {
              const meta = SPELL_BY_TYPE.get(b.type);
              const range = spellRangeFt(b.type);
              const reach = g === 'self' ? 'personal' : range === 5 ? 'toc · 5 ft' : range !== undefined ? `${range} ft` : '';
              return (
                <Button key={b.type} size="sm" variant="tint" color={meta?.color ?? C.magic} active={armed === `spell:${b.type}`}
                  title={`${meta?.title ?? b.name} · ${b.level === 0 ? 'truc' : 'nivell 1'}${b.item ? ' · per un objecte' : ''}${reach ? ` · ${reach}` : ''}\n${g === 'self' ? 'Surt del token' : 'Clic al mapa per triar el destí · Esc o clic dret cancel·la'}`}
                  onMouseDown={e => { e.stopPropagation(); onCast(b.type); }}
                  style={{ justifyContent: 'flex-start', minWidth: 0, gap: 4, height: 'auto', minHeight: 26, padding: '3px 6px', lineHeight: 1.15 }}>
                  {isUiIcon(b.type) ? <PixelIcon name={b.type} /> : <span style={{ flexShrink: 0 }}>{meta?.emoji}</span>}
                  {/* Els noms del Notion són llargs («Contacto electrizante»): dues línies abans que tallar-los */}
                  <span style={{ flex: 1, minWidth: 0, whiteSpace: 'normal', textAlign: 'left', overflowWrap: 'anywhere' }}>{b.name}</span>
                  {g !== 'self' && <span style={{ color: C.dim, fontSize: FS.xs, flexShrink: 0 }}>{range === 5 ? 'toc' : range}</span>}
                </Button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}


export interface TokenActionsProps {
  /** Token (`pl_*`/`lib_*`). */
  tokenKey: string;
  player?: Player;
  lib?: LibEnemy;
  characters: ApiCharacter[];
  powerSpent: Record<string, Record<string, number>>;
  armed?: string | null;
  onAttack: (p: AttackPending) => void;
  onCastPower: (tokenKey: string, power: MonsterPower) => void;
  /** Conjur del grimori d'un jugador: l'origen (centre del token) el posa qui crida. */
  onCastSpell: (tokenKey: string, type: SpellType) => void;
  onAdjustAmmo: (characterId: string, name: string, delta: number) => void;
}

/** Totes les accions d'un token, en l'ordre de sempre: atacs, munició, habilitats o poders, conjurs. */
export function TokenActions({ tokenKey, player: pl, lib, characters, powerSpent, armed, onAttack, onCastPower, onCastSpell, onAdjustAmmo }: TokenActionsProps) {
  const ch = pl ? characterFor(pl, characters) : null;
  const sh = ch ? sheetOf(ch) : null;
  // Enemics: els atacs del seu bloc de 5e (bestiari de l'app) o, si no en té, un cos a cos amb
  // l'abast de la BD (`defenses.reachFt`, 5 ft si no en té).
  const mo = lib ? monsterForEnemy(lib) : null;
  const own = sh ? attacksOf(sh) : mo ? mo.attacks.filter(a => a.damage) : [];
  const reach = lib ? enemyDefenses(lib)?.reachFt : undefined;
  const generic = reach !== undefined ? { ...GENERIC_MELEE, reachFt: reach } : GENERIC_MELEE;
  const list = own.length > 0 ? own : [generic];
  const spent = powerSpent[tokenKey] ?? {};
  return (
    <>
      <AttackList attacks={list} armed={armed} ammoOf={sh ? a => ammoLeft(sh, a) : undefined} onPick={a => {
        const { normalFt, longFt } = attackRanges(a);
        onAttack({ key: tokenKey, label: a.name, normalFt, longFt, damageType: a.damageType, kind: a.kind, ammo: a.ammo });
      }} />
      {ch && sh?.ammo?.length ? <AmmoControls stacks={sh.ammo} onAdjust={(name, d) => onAdjustAmmo(ch.id, name, d)} /> : null}
      {sh?.powers?.length ? <PowerList title="Habilitats" powers={sh.powers} spent={spent} armed={armed} onCast={p => onCastPower(tokenKey, p)} /> : null}
      {mo?.powers?.length ? <PowerList powers={mo.powers} spent={spent} armed={armed} onCast={p => onCastPower(tokenKey, p)} /> : null}
      {pl && <Spellbook playerName={pl.name} armed={armed} onCast={type => onCastSpell(tokenKey, type)} />}
    </>
  );
}
