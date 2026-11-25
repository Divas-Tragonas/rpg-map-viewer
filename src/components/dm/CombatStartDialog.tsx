'use client';
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { C, FS, RADIUS, tint } from '@/constants';
import { Button } from '@/components/ui/Button';
import { CheckIcon, EyeOff, SkullIcon, SwordsIcon } from '@/components/icons';
import type { Player, LibEnemy, DefeatedMap } from '@/types';
import type { ApiCharacter } from '@/lib/api';
import { characterFor, sheetOf } from '@/lib/characters';
import { monsterForEnemy } from '@/lib/db-enemies';

/** Un participant possible: un token, o un grup d'enemics que juga junt (un sol torn). */
export interface StartEntry {
  key: string;
  ids: (number | string)[];
  name: string;
  isPlayer: boolean;
  /** Grup que juga junt (id i nom). */
  group?: { id: string; name: string };
  /** Amagat als jugadors (ull tancat) o derrotat: surten sense marcar. */
  hidden: boolean;
  defeated: boolean;
  /** Modificador d'iniciativa de la fitxa o del bloc («+2»), només de referència. */
  initMod?: string;
}

interface Props {
  players: Player[];
  libEnemies: LibEnemy[];
  defeated: DefeatedMap;
  characters: ApiCharacter[];
  /** Grups de tokens (`clau → id del grup`) i els seus noms. */
  tokenGroups: Map<number | string, string>;
  groupNames: Map<string, string>;
  /** Avatar d'un token (el mateix dels xips de la barra). */
  avatar: (id: number | string, size: number) => React.ReactNode;
  /** `order`: tots els participants en ordre de torn; `groups`: els que juguen junts. */
  onStart: (order: (number | string)[], groups: { id: string; name: string; ids: (number | string)[] }[]) => void;
  onCancel: () => void;
}

const modText = (n: number) => (n >= 0 ? `+${n}` : `${n}`);

/** Tots els participants possibles: jugadors, grups d'enemics (un sol element) i la resta d'enemics. */
function buildEntries(p: Props): StartEntry[] {
  const out: StartEntry[] = [];
  for (const pl of p.players) {
    const key = `pl_${pl.id}`;
    const ch = characterFor(pl, p.characters);
    const init = ch ? sheetOf(ch).initiative : undefined;
    out.push({ key, ids: [key], name: pl.name, isPlayer: true, hidden: false, defeated: !!p.defeated[key], initMod: init?.trim() || undefined });
  }
  // Grups: només els seus enemics (els jugadors sempre juguen el seu torn).
  const members = new Map<string, string[]>();
  p.tokenGroups.forEach((gid, tid) => {
    const k = String(tid);
    if (!k.startsWith('lib_') || !p.libEnemies.some(en => `lib_${en.id}` === k)) return;
    members.set(gid, [...(members.get(gid) ?? []), k]);
  });
  const inGroup = new Set<string>();
  members.forEach((ids, gid) => {
    if (ids.length < 2) return;
    ids.forEach(k => inGroup.add(k));
    const ens = ids.map(k => p.libEnemies.find(en => `lib_${en.id}` === k)!);
    const mo = monsterForEnemy(ens[0]);
    const dex = mo?.abilities?.[1];
    out.push({
      key: `grp:${gid}`, ids, name: p.groupNames.get(gid) ?? 'Grup', isPlayer: false, group: { id: gid, name: p.groupNames.get(gid) ?? 'Grup' },
      hidden: ens.every(en => en.visible === false), defeated: ids.every(k => p.defeated[k]),
      initMod: dex !== undefined ? modText(Math.floor((dex - 10) / 2)) : undefined,
    });
  });
  for (const en of p.libEnemies) {
    const key = `lib_${en.id}`;
    if (inGroup.has(key)) continue;
    const dex = monsterForEnemy(en)?.abilities?.[1];
    out.push({
      key, ids: [key], name: en.name, isPlayer: false, hidden: en.visible === false, defeated: !!p.defeated[key],
      initMod: dex !== undefined ? modText(Math.floor((dex - 10) / 2)) : undefined,
    });
  }
  return out;
}

/**
 * Iniciar un combat (v5.42), en dos passos i en gran:
 *  1. **Qui hi entra**: tots els tokens de l'escena en rajoles. Jugadors i enemics visibles surten
 *     marcats; els amagats i els derrotats, no. Enter = següent.
 *  2. **Ordre**: un camp d'iniciativa per participant (les tirades les fa la taula: l'app NO tira
 *     daus). En prémer Enter la fila salta al seu lloc i el focus va a la següent buida; quan no
 *     en queda cap, Enter comença. ▲▼ per desempatar o moure a mà.
 * Va en un portal al `body`: la barra de torns té `transform` i hi quedaria tancat.
 */
export function CombatStartDialog(props: Props) {
  const { avatar, onStart, onCancel } = props;
  const entries = useMemo(() => buildEntries(props), []); // eslint-disable-line react-hooks/exhaustive-deps
  const byKey = useMemo(() => new Map(entries.map(e => [e.key, e])), [entries]);
  const [step, setStep] = useState<1 | 2>(1);
  const [sel, setSel] = useState<Set<string>>(() => new Set(entries.filter(e => !e.hidden && !e.defeated).map(e => e.key)));
  const [order, setOrder] = useState<string[]>([]);
  const [init, setInit] = useState<Record<string, string>>({});
  const inputs = useRef(new Map<string, HTMLInputElement>());
  // Camp que ha d'agafar el focus després del pròxim render (les files es mouen en fixar-ne una).
  const wantFocus = useRef<string | null>(null);

  const toggle = (k: string) => setSel(s => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  const enemyKeys = entries.filter(e => !e.isPlayer).map(e => e.key);
  const allEnemies = enemyKeys.length > 0 && enemyKeys.every(k => sel.has(k));
  const toggleEnemies = () => setSel(s => {
    const n = new Set(s);
    enemyKeys.forEach(k => { if (allEnemies) n.delete(k); else n.add(k); });
    return n;
  });

  const goOrder = () => {
    const keys = entries.filter(e => sel.has(e.key)).map(e => e.key);
    if (!keys.length) return;
    setOrder(o => [...o.filter(k => keys.includes(k)), ...keys.filter(k => !o.includes(k))]);
    wantFocus.current = keys.find(k => !init[k]?.trim()) ?? keys[0];
    setStep(2);
  };

  const start = (list: string[] = order) => {
    const ids: (number | string)[] = [];
    const groups: { id: string; name: string; ids: (number | string)[] }[] = [];
    for (const k of list) {
      const e = byKey.get(k);
      if (!e) continue;
      ids.push(...e.ids);
      if (e.group) groups.push({ ...e.group, ids: e.ids });
    }
    if (ids.length) onStart(ids, groups);
  };

  const num = (k: string) => { const v = parseInt(init[k] ?? '', 10); return Number.isNaN(v) ? null : v; };

  /** Fixa la iniciativa d'una fila: la treu i la posa abans del primer que en tingui menys o cap. */
  const commit = (k: string) => {
    const v = num(k);
    let next = order;
    if (v !== null) {
      const rest = order.filter(x => x !== k);
      let at = rest.findIndex(x => { const w = num(x); return w === null || w < v; });
      if (at < 0) at = rest.length;
      next = [...rest.slice(0, at), k, ...rest.slice(at)];
      setOrder(next);
    }
    const empty = next.find(x => x !== k && num(x) === null);
    if (!empty) { start(next); return; }
    if (next !== order) wantFocus.current = empty;  // es pinta de nou: el focus, després
    else { const el = inputs.current.get(empty); el?.focus(); el?.select(); }
  };

  const move = (k: string, d: -1 | 1) => setOrder(o => {
    const i = o.indexOf(k), j = i + d;
    if (i < 0 || j < 0 || j >= o.length) return o;
    const n = [...o]; [n[i], n[j]] = [n[j], n[i]]; return n;
  });

  useLayoutEffect(() => {
    const k = wantFocus.current;
    if (!k) return;
    wantFocus.current = null;
    const el = inputs.current.get(k);
    if (el) { el.focus(); el.select(); }
  });

  // Teclat en fase de captura: Enter i Esc són del diàleg (Enter, si no, passaria el torn; Esc
  // tornaria a l'eina de selecció). L'Enter dels camps el gestionen ells mateixos.
  const keyRef = useRef<(e: KeyboardEvent) => void>(() => {});
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); if (step === 2) setStep(1); else onCancel(); return; }
    if (e.key !== 'Enter') return;
    if (e.target instanceof HTMLInputElement) return;
    e.preventDefault(); e.stopImmediatePropagation();
    if (step === 1) goOrder(); else start();
  };
  useLayoutEffect(() => { keyRef.current = onKey; });
  useEffect(() => {
    const h = (e: KeyboardEvent) => keyRef.current(e);
    window.addEventListener('keydown', h, true);
    return () => window.removeEventListener('keydown', h, true);
  }, []);

  const section = (title: string, list: StartEntry[], extra?: React.ReactNode) => list.length > 0 && (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ flex: 1, color: C.dim, fontSize: FS.xs, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{title}</span>
        {extra}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 8 }}>
        {list.map(e => {
          const on = sel.has(e.key);
          return (
            <button key={e.key} type="button" onClick={() => toggle(e.key)} aria-pressed={on}
              style={{
                position: 'relative', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 10px', textAlign: 'left',
                borderRadius: RADIUS.lg, cursor: 'pointer', minWidth: 0,
                border: `2px solid ${on ? C.accent : C.border}`, background: on ? tint(C.accent, 0.12) : C.panel,
                opacity: on ? 1 : 0.6, color: C.text,
              }}>
              {e.group
                ? <span style={{ display: 'flex', flexShrink: 0 }}>{e.ids.slice(0, 3).map((id, i) => <span key={String(id)} style={{ marginLeft: i ? -16 : 0 }}>{avatar(id, 40)}</span>)}</span>
                : avatar(e.ids[0], 44)}
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontWeight: 700, fontSize: FS.lg, color: C.bright, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.name}</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: C.dim, fontSize: FS.xs }}>
                  {e.group && `${e.ids.length} · un torn`}
                  {e.hidden && <><EyeOff size={11} /> amagat</>}
                  {e.defeated && <><SkullIcon size={11} /> derrotat</>}
                </span>
              </span>
              <span style={{
                position: 'absolute', top: 6, right: 6, width: 18, height: 18, borderRadius: RADIUS.sm,
                border: `1px solid ${on ? C.accent : '#3a4048'}`, background: on ? C.accent : 'transparent', color: C.onAccent,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>{on && <CheckIcon size={12} />}</span>
            </button>
          );
        })}
      </div>
    </div>
  );

  const nSel = sel.size;
  const body = (
    <div onMouseDown={e => { if (e.target === e.currentTarget) onCancel(); }}
      style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div role="dialog" aria-label="Iniciar combat"
        style={{
          width: 'min(780px, 100%)', maxHeight: 'min(86dvh, 860px)', display: 'flex', flexDirection: 'column',
          background: 'rgba(13,17,23,0.98)', border: `1px solid ${C.border}`, borderRadius: RADIUS.lg, boxShadow: '0 12px 48px rgba(0,0,0,0.8)',
        }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', borderBottom: `1px solid ${C.border}` }}>
          <SwordsIcon size={20} />
          <span style={{ flex: 1, color: C.bright, fontWeight: 700, fontSize: 20 }}>Iniciar combat</span>
          <span style={{ color: step === 1 ? C.accent : C.dim, fontSize: FS.sm, fontWeight: 700 }}>1 · Qui hi entra</span>
          <span style={{ color: C.dim }}>›</span>
          <span style={{ color: step === 2 ? C.accent : C.dim, fontSize: FS.sm, fontWeight: 700 }}>2 · Ordre</span>
        </div>

        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '14px 18px' }}>
          {step === 1 ? (
            <>
              {section('Jugadors', entries.filter(e => e.isPlayer))}
              {section('Enemics i aliats', entries.filter(e => !e.isPlayer),
                <Button size="sm" variant="ghost" onClick={toggleEnemies} style={{ color: C.text }}>{allEnemies ? 'Cap' : 'Tots'}</Button>)}
              {entries.length === 0 && <div style={{ color: C.dim }}>No hi ha cap token a l&apos;escena.</div>}
            </>
          ) : (
            <>
              <div style={{ color: C.dim, fontSize: FS.sm, marginBottom: 10 }}>
                Escriu la iniciativa que ha tret cadascú i prem Enter: la fila va al seu lloc. ▲▼ per desempatar.
              </div>
              {order.map((k, i) => {
                const e = byKey.get(k);
                if (!e) return null;
                return (
                  <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 8px', marginBottom: 4, borderRadius: RADIUS.md, background: C.panel, border: `1px solid ${C.border}` }}>
                    <span style={{ width: 22, textAlign: 'right', color: C.dim, fontWeight: 700, fontSize: FS.lg }}>{i + 1}</span>
                    {e.group
                      ? <span style={{ display: 'flex' }}>{e.ids.slice(0, 3).map((id, j) => <span key={String(id)} style={{ marginLeft: j ? -14 : 0 }}>{avatar(id, 34)}</span>)}</span>
                      : avatar(e.ids[0], 36)}
                    <span style={{ flex: 1, minWidth: 0, color: C.bright, fontWeight: 700, fontSize: FS.lg, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {e.name}{e.group && <span style={{ color: C.dim, fontWeight: 500, fontSize: FS.sm }}> · {e.ids.length}</span>}
                    </span>
                    <input
                      ref={el => { if (el) inputs.current.set(k, el); else inputs.current.delete(k); }}
                      value={init[k] ?? ''} inputMode="numeric" aria-label={`Iniciativa de ${e.name}`}
                      placeholder={e.initMod ? `${e.initMod}` : '—'} title={e.initMod ? `Modificador d'iniciativa: ${e.initMod}` : undefined}
                      onChange={ev => setInit(m => ({ ...m, [k]: ev.target.value.replace(/[^0-9-]/g, '') }))}
                      onKeyDown={ev => { if (ev.key === 'Enter') { ev.preventDefault(); commit(k); } }}
                      style={{ width: 64, height: 36, textAlign: 'center', fontSize: 18, fontWeight: 700, background: C.bg, color: C.bright, border: `1px solid ${C.border}`, borderRadius: RADIUS.sm, outline: 'none' }} />
                    <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <button type="button" onClick={() => move(k, -1)} disabled={i === 0} title="Pujar" style={arrow(i === 0)}>▲</button>
                      <button type="button" onClick={() => move(k, 1)} disabled={i === order.length - 1} title="Baixar" style={arrow(i === order.length - 1)}>▼</button>
                    </span>
                  </div>
                );
              })}
            </>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8, padding: '12px 18px', borderTop: `1px solid ${C.border}` }}>
          {step === 1
            ? <Button style={{ flex: 1 }} onClick={onCancel}>Cancel·lar</Button>
            : <Button style={{ flex: 1 }} onClick={() => setStep(1)}>← Enrere</Button>}
          {step === 1
            ? <Button variant="primary" style={{ flex: 2 }} disabled={nSel === 0} onClick={goOrder}>Següent: ordre ({nSel}) · Enter</Button>
            : <Button variant="primary" style={{ flex: 2 }} onClick={() => start()}>Començar combat</Button>}
        </div>
      </div>
    </div>
  );
  return createPortal(body, document.body);
}

const arrow = (off: boolean): React.CSSProperties => ({
  width: 26, height: 17, padding: 0, fontSize: 9, lineHeight: 1, cursor: off ? 'default' : 'pointer',
  background: C.dark, color: off ? '#3a4048' : C.text, border: `1px solid ${C.border}`, borderRadius: RADIUS.sm,
});
