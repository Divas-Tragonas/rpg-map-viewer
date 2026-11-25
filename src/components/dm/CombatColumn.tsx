'use client';
import React, { useEffect, useRef, useState } from 'react';
import { SwordsIcon, StepForward, GearIcon, FastForwardIcon, X, ScrollIcon, CheckIcon, RotateCcw, SkullIcon } from '@/components/icons';
import { Button } from '@/components/ui/Button';
import { HpControl, hpColor } from '@/components/ui/HpControl';
import { C, FS, RADIUS, tint, CONDITIONS_BY_ID } from '@/constants';
import { resolveToken, type TokenEditProps } from '@/components/dm/TokenFields';
import { TokenActions, type TokenActionsProps } from '@/components/dm/TokenActions';
import { CombatStartDialog } from '@/components/dm/CombatStartDialog';
import { LOG_TONE } from '@/components/dm/TurnTracker';
import { characterFor, monsterFromCharacter } from '@/lib/characters';
import { monsterForEnemy } from '@/lib/db-enemies';
import { movementLimit } from '@/lib/rules/conditions';
import { budgetFor, isTurnToken } from '@/lib/turn';
import { creatureThumb } from '@/lib/sprites/draw';
import type { ApiCharacter } from '@/lib/api';
import type { CombatLogEntry, ConditionsMap, DefeatedMap, LibEnemy, Player, TurnState } from '@/types';

/**
 * Columna de combat (v5.47, escriptori): la cua d'iniciativa i les accions del token, tot en un lloc
 * fix a la dreta, com el lateral de l'esquerra. Substitueix la barra de torns de baix i el panell
 * flotant d'accions (al mòbil continuen). Una fila per participant; la del torn (o la que es clica)
 * es desplega amb la vida, els estats i les accions. Fora de combat: «Iniciar combat» i les accions
 * del token seleccionat al mapa.
 */

interface Props {
  turn: TurnState;
  players: Player[];
  libEnemies: LibEnemy[];
  defeated: DefeatedMap;
  conditions: ConditionsMap;
  pixel?: boolean;
  log: CombatLogEntry[];
  characters: ApiCharacter[];
  tokenGroupsRef: React.MutableRefObject<Map<number | string, string>>;
  groupNamesRef: React.MutableRefObject<Map<string, string>>;
  onStart: (ids: (number | string)[], groups: { id: string; name: string; ids: (number | string)[] }[]) => void;
  onEnd: () => void;
  onAdvance: () => void;
  onAdvanceRound: () => void;
  onRecoverTurn: (id: number | string) => void;
  onReorder: (order: (number | string)[]) => void;
  /** Fora de combat: el token seleccionat al mapa (les seves accions). */
  selectedKey: string | null;
  /** Token triat a mà (fila clicada o «Accions» del menú d'un token); `null` = el del torn. Dura un torn. */
  pickKey: string | null;
  onPick: (key: string | null) => void;
  /** Seleccionar el token al mapa (clic a una fila) i el menú del clic dret. */
  onSelectToken: (key: string) => void;
  onTokenMenu: (key: string, e: React.MouseEvent) => void;
  edit: TokenEditProps;
  getArmed: () => string | null;
  actions: Omit<TokenActionsProps, 'tokenKey' | 'player' | 'lib' | 'armed'>;
}

interface Info { name: string; color: string; img: string | null }
interface Slot { ids: (number | string)[]; start: number; group?: string }

function Avatar({ info, size, dim }: { info: Info; size: number; dim?: boolean }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0, opacity: dim ? 0.45 : 1,
      background: info.img ? `#000 center/cover url(${info.img})` : info.color,
      display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: size * 0.4, fontWeight: 800,
      overflow: 'hidden', imageRendering: 'pixelated', border: `2px solid ${info.color}`,
    }}>{!info.img && info.name.slice(0, 2).toUpperCase()}</div>
  );
}

const label: React.CSSProperties = { fontSize: FS.xs, color: C.dim, textTransform: 'uppercase', letterSpacing: '0.08em' };

/** Vida, CA, peus, estats i accions d'un token (el cos desplegat d'una fila, o la part de baix). */
function TokenDetail({ tokenKey, edit, conditions, armed, actions, feet }: {
  tokenKey: string; edit: TokenEditProps; conditions: ConditionsMap; armed: string | null;
  actions: Props['actions']; feet?: { left: number; total: number };
}) {
  const t = resolveToken(tokenKey, edit);
  if (!t) return null;
  const ch = t.player ? characterFor(t.player, actions.characters) : null;
  const mo = t.lib ? monsterForEnemy(t.lib) : ch ? monsterFromCharacter(ch) : null;
  const conds = conditions[t.key] ?? [];
  return (
    <div>
      <div style={{ padding: '6px 8px', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {t.hpMax > 0 && <HpControl hp={t.hp} hpMax={t.hpMax} onAdjust={t.adjustHp} size="md" />}
        {mo?.ac ? <span title="Classe d'armadura" style={{ color: C.text, fontSize: FS.sm, fontWeight: 700 }}>CA {mo.ac}</span> : null}
        {feet && <span title="Peus que li queden aquest torn" style={{ color: C.dim, fontSize: FS.sm }}>{feet.left}/{feet.total} ft</span>}
      </div>
      {conds.length > 0 && (
        <div style={{ padding: '0 8px 6px', display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {conds.map(id => {
            const c = CONDITIONS_BY_ID.get(id);
            return <span key={id} style={{ fontSize: FS.xs, padding: '1px 6px', borderRadius: RADIUS.sm, color: c?.color ?? C.text, background: tint(c?.color ?? C.text, 0.12), border: `1px solid ${tint(c?.color ?? C.text, 0.35)}` }}>{c?.label ?? id}</span>;
          })}
        </div>
      )}
      <TokenActions tokenKey={t.key} player={t.player} lib={t.lib} armed={armed} {...actions} />
    </div>
  );
}

export function CombatColumn(p: Props) {
  const { turn, players, libEnemies, defeated, conditions, pixel, log, edit, getArmed, actions } = p;
  const [armed, setArmed] = useState<string | null>(null);
  useEffect(() => {
    const iv = window.setInterval(() => setArmed(a => { const n = getArmed(); return n === a ? a : n; }), 150);
    return () => window.clearInterval(iv);
  }, [getArmed]);
  const [starting, setStarting] = useState<null | { groups: Map<number | string, string>; names: Map<string, string> }>(null);
  const [pop, setPop] = useState<null | 'round' | 'end' | 'log'>(null);
  const [editMode, setEditMode] = useState(false);
  // Fila desplegada / token de la part de baix: el triat a mà o, si no, el del torn (fora, el seleccionat).
  const activeKey = turn.active ? String(turn.order[turn.turnIndex] ?? '') : '';
  const viewKey = p.pickKey ?? (turn.active ? activeKey : p.selectedKey);
  const logRef = useRef<HTMLDivElement>(null);
  // En passar el torn, la fila activa es desplaça sola a la vista (amb molts tokens quedaria a sota).
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    listRef.current?.querySelector('[data-active="1"]')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [activeKey, turn.round]);
  useEffect(() => { if (pop === 'log' && logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, [pop, log.length]);

  const info = (id: number | string): Info => {
    const s = String(id);
    if (s.startsWith('pl_')) {
      const pl = players.find(x => `pl_${x.id}` === s);
      return { name: pl?.name ?? '?', color: pl?.color ?? '#888', img: pl?.portrait ?? (pixel && pl?.sprite ? creatureThumb(pl.sprite) : null) };
    }
    const en = libEnemies.find(x => `lib_${x.id}` === s);
    return { name: en?.name ?? '?', color: en?.color ?? '#b0424a', img: (pixel && en?.sprite ? creatureThumb(en.sprite) : null) ?? en?.imageData ?? null };
  };
  const hpOf = (id: number | string) => {
    const t = resolveToken(String(id), edit);
    return t && t.hpMax > 0 ? { hp: t.hp, max: t.hpMax } : null;
  };

  // Un grup que juga junt ocupa una sola fila (els membres són contigus a la cua).
  const slots: Slot[] = [];
  turn.order.forEach((id, i) => {
    const g = turn.together?.[String(id)];
    const prev = slots[slots.length - 1];
    if (g && prev && prev.group === g) prev.ids.push(id);
    else slots.push({ ids: [id], start: i, group: g });
  });
  const slotActive = (s: Slot) => turn.turnIndex >= s.start && turn.turnIndex < s.start + s.ids.length;
  const moveSlot = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= slots.length) return;
    const n = [...slots]; [n[i], n[j]] = [n[j], n[i]];
    p.onReorder(n.flatMap(s => s.ids));
  };

  const feetFor = (key: string) => {
    if (!turn.active || key !== activeKey || !key.startsWith('pl_')) return undefined;
    return { left: movementLimit(turn.activeRemainingFt, conditions[key]).ft, total: budgetFor(key, players) };
  };
  const detail = (key: string) => (
    <TokenDetail tokenKey={key} edit={edit} conditions={conditions} armed={armed} actions={actions} feet={feetFor(key)} />
  );

  // ── Capçalera ──────────────────────────────────────────────────────────────
  const header = !turn.active ? (
    <div style={{ padding: 10, borderBottom: `1px solid ${C.border}` }}>
      <Button variant="primary" size="lg" block onClick={() => setStarting({ groups: new Map(p.tokenGroupsRef.current), names: new Map(p.groupNamesRef.current) })}>
        <SwordsIcon size={15} /> Iniciar combat
      </Button>
    </div>
  ) : (
    <div style={{ padding: '8px 10px', borderBottom: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, flex: 1 }}>
          <span style={label}>Ronda</span>
          <span style={{ color: C.bright, fontSize: 22, fontWeight: 800, lineHeight: 1 }}>{turn.round}</span>
        </div>
        <IconBtn active={editMode} title={editMode ? 'Acabar d\'ordenar' : 'Canviar l\'ordre'} onClick={() => { setEditMode(v => !v); setPop(null); }}><GearIcon size={14} /></IconBtn>
        <IconBtn active={pop === 'log'} title="Historial del combat" onClick={() => setPop(v => (v === 'log' ? null : 'log'))}>
          <ScrollIcon size={14} />
          {log.length > 0 && <span style={{ position: 'absolute', top: -5, right: -5, minWidth: 15, height: 15, padding: '0 3px', boxSizing: 'border-box', borderRadius: 8, background: C.panel, border: `1px solid ${C.border}`, color: C.text, fontSize: 9, lineHeight: '13px', textAlign: 'center' }}>{log.length}</span>}
        </IconBtn>
        <IconBtn active={pop === 'round'} title="Acabar la ronda ara" onClick={() => setPop(v => (v === 'round' ? null : 'round'))}><FastForwardIcon size={13} /></IconBtn>
        <IconBtn active={pop === 'end'} danger title="Acabar el combat" onClick={() => setPop(v => (v === 'end' ? null : 'end'))}><X size={14} /></IconBtn>
      </div>
      {editMode
        ? <Button variant="primary" size="lg" block onClick={() => setEditMode(false)}><CheckIcon size={14} /> Fet</Button>
        : <Button variant="primary" size="lg" block onClick={p.onAdvance} title="Passar el torn al següent (Enter)">Següent <StepForward size={13} /></Button>}
      {(pop === 'round' || pop === 'end') && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', borderRadius: RADIUS.md, background: tint(pop === 'end' ? C.enemy : C.accent, 0.1), border: `1px solid ${tint(pop === 'end' ? C.enemy : C.accent, 0.35)}` }}>
          <span style={{ flex: 1, fontSize: FS.sm, color: C.bright, fontWeight: 700 }}>{pop === 'end' ? 'Finalitzar el combat?' : `Saltar a la ronda ${turn.round + 1}?`}</span>
          <Button size="sm" variant={pop === 'end' ? 'danger' : 'primary'} onClick={() => { setPop(null); if (pop === 'end') p.onEnd(); else p.onAdvanceRound(); }}>Sí</Button>
          <Button size="sm" onClick={() => setPop(null)}>No</Button>
        </div>
      )}
    </div>
  );

  // ── Una fila de la cua ─────────────────────────────────────────────────────
  const row = (s: Slot, i: number) => {
    const active = slotActive(s);
    const grouped = s.ids.length > 1;
    const lead = active ? turn.order[turn.turnIndex] : (s.ids.find(k => !defeated[String(k)]) ?? s.ids[0]);
    const inf = grouped ? { ...info(lead), name: turn.groupNames?.[s.group ?? ''] ?? 'Grup' } : info(lead);
    const alive = s.ids.filter(k => !defeated[String(k)]).length;
    const dead = grouped ? alive === 0 : !!defeated[String(lead)];
    const keys = s.ids.map(String);
    const open = !!viewKey && keys.includes(viewKey);
    const hp = grouped ? null : hpOf(lead);
    const conds = grouped ? [] : (conditions[String(lead)] ?? []);
    const isMate = !active && keys.some(k => isTurnToken(turn, k));
    return (
      <div key={String(s.ids[0])} data-active={active ? '1' : undefined} style={{
        margin: '0 6px 4px', borderRadius: RADIUS.md, overflow: 'hidden',
        border: `1px solid ${active ? C.accent : open ? tint(C.accent, 0.3) : C.border}`,
        background: active ? tint(C.accent, 0.08) : C.panel, boxShadow: active ? `0 0 0 1px ${tint(C.accent, 0.35)}` : undefined,
      }}>
        <div
          onClick={() => { if (editMode) return; if (open && !active) p.onPick(null); else { p.onPick(String(lead)); p.onSelectToken(String(lead)); } }}
          onContextMenu={e => { e.preventDefault(); p.onTokenMenu(String(lead), e); }}
          title={dead ? `${inf.name} · derrotat, se li salta el torn` : active ? 'Té el torn' : 'Clic: veure les seves accions · clic dret: menú del token'}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: active ? '7px 8px' : '5px 8px', cursor: editMode ? 'default' : 'pointer' }}>
          <span style={{ width: 14, textAlign: 'right', color: active ? C.accent : C.dim, fontSize: FS.xs, fontWeight: 700 }}>{i + 1}</span>
          <span style={{ position: 'relative', display: 'flex' }}>
            <Avatar info={inf} size={active ? 34 : 26} dim={dead} />
            {grouped && <span style={{ position: 'absolute', right: -4, bottom: -3, fontSize: 9, fontWeight: 800, color: C.bright, background: C.dark, border: `1px solid ${C.border}`, borderRadius: 7, padding: '0 3px' }}>{alive}/{s.ids.length}</span>}
          </span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ fontWeight: 700, fontSize: active ? FS.lg : FS.md, color: dead ? C.dim : C.bright, textDecoration: dead ? 'line-through' : undefined, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{inf.name}</span>
              {dead && <SkullIcon size={11} />}
              {(isMate) && <span style={{ fontSize: 9, color: C.accent }}>juga ara</span>}
            </span>
            {hp && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
                <span style={{ flex: 1, height: 4, borderRadius: 2, background: C.dark, overflow: 'hidden' }}>
                  <span style={{ display: 'block', height: '100%', width: `${Math.max(0, Math.min(1, hp.hp / hp.max)) * 100}%`, background: hpColor(hp.hp, hp.max) }} />
                </span>
                <span style={{ fontSize: FS.xs, color: C.dim, fontVariantNumeric: 'tabular-nums' }}>{hp.hp}/{hp.max}</span>
              </span>
            )}
          </span>
          {conds.length > 0 && (
            <span style={{ display: 'flex', gap: 2 }} title={conds.map(c => CONDITIONS_BY_ID.get(c)?.label ?? c).join(', ')}>
              {conds.slice(0, 4).map(c => <span key={c} style={{ width: 7, height: 7, borderRadius: '50%', background: CONDITIONS_BY_ID.get(c)?.color ?? C.dim }} />)}
            </span>
          )}
          {editMode && (
            <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <button type="button" disabled={i === 0} onClick={() => moveSlot(i, -1)} style={arrow(i === 0)}>▲</button>
              <button type="button" disabled={i === slots.length - 1} onClick={() => moveSlot(i, 1)} style={arrow(i === slots.length - 1)}>▼</button>
            </span>
          )}
        </div>
        {open && !editMode && (
          <div style={{ borderTop: `1px solid ${C.border}`, background: C.bg }}>
            {grouped && <MemberChips ids={keys} viewKey={viewKey!} info={info} defeated={defeated} onPick={k => { p.onPick(k); p.onSelectToken(k); }} />}
            {!active && !isMate && (
              <div style={{ padding: '6px 8px 0' }}>
                <Button size="sm" variant="secondary" onClick={() => p.onRecoverTurn(keys[0])} title="Torna el torn a aquest token amb els peus que li quedaven"><RotateCcw size={11} /> Tornar-li el torn</Button>
              </div>
            )}
            {detail(viewKey!)}
          </div>
        )}
      </div>
    );
  };

  const logList = (
    <div ref={logRef} style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '8px 8px', display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={label}>Historial del combat</div>
      {log.length === 0 && <div style={{ fontSize: FS.sm, color: C.dim }}>Encara no ha passat res.</div>}
      {log.map((e, i) => (
        <React.Fragment key={e.id}>
          {(i === 0 || log[i - 1].round !== e.round) && <div style={{ ...label, fontWeight: 700, marginTop: i ? 6 : 0 }}>Ronda {e.round}</div>}
          <div style={{ fontSize: FS.sm, color: C.text, lineHeight: 1.4, padding: '5px 8px', background: C.dark, border: `1px solid ${C.border}`, borderLeft: `3px solid ${LOG_TONE[e.tone]}`, borderRadius: RADIUS.sm }}>{e.text}</div>
        </React.Fragment>
      ))}
    </div>
  );

  let body: React.ReactNode;
  if (!turn.active) {
    body = (
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        <div style={{ padding: '8px 10px 4px', ...label }}>Accions {viewKey ? `· ${info(viewKey).name}` : ''}</div>
        {viewKey ? detail(viewKey) : <div style={{ padding: '4px 10px', color: C.dim, fontSize: FS.sm }}>Selecciona un token al mapa per veure els seus atacs, poders i conjurs.</div>}
      </div>
    );
  } else if (pop === 'log') {
    body = logList;
  } else {
    body = <div ref={listRef} style={{ flex: 1, minHeight: 0, overflowY: 'auto', paddingTop: 6 }}>{slots.map((sl, i) => row(sl, i))}</div>;
  }

  return (
    <div data-combat-column="1" style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {header}
      {body}
      {turn.active && pop !== 'log' && (
        <div style={{ padding: '5px 10px 7px', color: C.dim, fontSize: FS.xs, borderTop: `1px solid ${C.border}` }}>Clic a l&apos;acció i després a la criatura · Esc cancel·la</div>
      )}
      {starting && (
        <CombatStartDialog players={players} libEnemies={libEnemies} defeated={defeated} characters={p.characters}
          tokenGroups={starting.groups} groupNames={starting.names}
          avatar={(id, size) => <Avatar info={info(id)} size={size} />}
          onCancel={() => setStarting(null)}
          onStart={(ids, groups) => { setStarting(null); p.onStart(ids, groups); }} />
      )}
    </div>
  );
}

function MemberChips({ ids, viewKey, info, defeated, onPick }: { ids: string[]; viewKey: string; info: (id: string) => Info; defeated: DefeatedMap; onPick: (k: string) => void }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, padding: '6px 8px 0' }}>
      {ids.map(k => (
        <button key={k} type="button" onClick={() => onPick(k)} title={info(k).name}
          style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 6px 2px 2px', borderRadius: 12, cursor: 'pointer', fontSize: FS.xs, color: C.text,
            border: `1px solid ${k === viewKey ? C.accent : C.border}`, background: k === viewKey ? tint(C.accent, 0.12) : C.panel, opacity: defeated[k] ? 0.5 : 1 }}>
          <Avatar info={info(k)} size={18} /> {info(k).name.replace(/^.*?(\d+)$/, '#$1')}
        </button>
      ))}
    </div>
  );
}

function IconBtn({ children, onClick, title, active, danger }: { children: React.ReactNode; onClick: () => void; title: string; active?: boolean; danger?: boolean }) {
  const col = danger ? C.enemy : C.accent;
  return (
    <button type="button" onClick={onClick} title={title} aria-label={title}
      style={{ position: 'relative', width: 30, height: 30, borderRadius: RADIUS.md, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        border: `1px solid ${active ? col : C.border}`, background: active ? tint(col, 0.13) : 'transparent', color: active ? col : C.dim }}>
      {children}
    </button>
  );
}

const arrow = (off: boolean): React.CSSProperties => ({
  width: 22, height: 15, padding: 0, fontSize: 8, lineHeight: 1, cursor: off ? 'default' : 'pointer',
  background: C.dark, color: off ? '#3a4048' : C.text, border: `1px solid ${C.border}`, borderRadius: RADIUS.sm,
});
