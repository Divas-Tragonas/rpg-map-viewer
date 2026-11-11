'use client';
import React, { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { X, GripIcon, SparklesIcon, MoonIcon, Eye, EyeOff, DoorIcon, RotateCcw, Trash2, UnlinkIcon, LinkIcon, SkullIcon, ZapIcon, SpeechIcon, PlayIcon, SwordsIcon } from '@/components/icons';
import { ConditionPicker } from '@/components/ui/ConditionPicker';
import { PixelIcon } from '@/components/ui/PixelIcon';
import { attackIcon, isUiIcon } from '@/lib/sprites/uiicon';
import { HpControl } from '@/components/ui/HpControl';
import { Button } from '@/components/ui/Button';
import { NameField, TokenFields, resolveToken, type TokenEditProps } from '@/components/dm/TokenFields';
import { CharacterSection, type CharacterMenuProps } from '@/components/dm/CharacterSection';
import { C, FS, RADIUS, SHADOW, tint, SPELL_BY_TYPE, SPELL_MODES, AREA_SPELL_DATA, spellRangeFt, spellbookFor, FONT_SERIF } from '@/constants';
import type { ContextMenuState, ConditionsMap, DefeatedMap, SavedDialog, AttackPending } from '@/types';
import { type AmmoStack, ammoLeft, attacksOf, attackRanges, characterFor, monsterFromCharacter, sheetOf, DAMAGE_TYPES, type SheetAttack } from '@/lib/characters';
import { monsterForEnemy } from '@/lib/db-enemies';
import { enemyDefenses } from '@/lib/rules/damage';
import { MonsterBlock } from '@/components/dm/MonsterBlock';
import { powerDef, powerName, spentKey, REST_SPENT, type MonsterPower } from '@/lib/monster-powers';

/** Posició d'un menú flotant, en píxels de la finestra (cantonada de dalt a l'esquerra). */
export interface MenuPos { x: number; y: number }

interface Props {
  /**
   * Menú flotant: el DM l'ha arrossegat i es queda on l'ha deixat, obert mentre treballa al mapa
   * (un clic fora no el tanca). Els menús nous (clic dret a un altre token) surten al mateix lloc.
   * `onFloat(null)` = deixa de ser flotant (✕ o Esc).
   */
  floatPos: MenuPos | null;
  onFloat: (p: MenuPos | null) => void;
  contextMenu: ContextMenuState | null;
  conditions: ConditionsMap;
  defeated: DefeatedMap;
  rDefeated: React.MutableRefObject<DefeatedMap>;
  defeatedAnimRef: React.MutableRefObject<Record<string, number>>;
  rConditions: React.MutableRefObject<ConditionsMap>;
  /** Fitxa del token (estat, no refs: el menú la llegeix durant el render) i com editar-la. */
  edit: TokenEditProps;
  onRemovePlayer: (id: number) => void;
  onClose: () => void;
  onToggleCondition: (tokenId: string, condId: string) => void;
  onDeletePaintedZone: (id: string) => void;
  onDeleteAreaSpell: (id: string) => void;
  onOpenSceneConfig: () => void;
  onBroadcast: () => void;
  /** Desfer: desa l'estat d'aquests tokens ABANS d'un canvi fet aquí mateix (derrotat, estats). */
  onBeforeTokens: (label: string, keys: string[]) => void;
  setDefeated: (v: DefeatedMap) => void;
  setConditions: (v: ConditionsMap) => void;
  removeLibEnemy: (id: number) => void;
  onCreateGroup: (ids: (number | string)[]) => void;
  onDissolveGroup: (groupId: string) => void;
  onLeaveGroup: (id: number | string) => void;
  onSetRoomDark: (id: string, dark: boolean) => void;
  onToggleRoomReveal: (id: string) => void;
  onRenameRoom: (id: string, name: string) => void;
  onDeleteRoom: (id: string) => void;
  onAddDoor: (id: string) => void;
  onResetExplored: (id: string) => void;
  /** Llança una màgia del grimori d'un jugador des del seu token (`origin` = centre). */
  onCastSpell: (type: import('@/types').SpellType, origin: import('@/types').Point) => void;
  /** Tria un atac del menú: el ratolí apunta l'objectiu amb l'abast al mapa (`aimAttack`). */
  onAttack: (p: AttackPending) => void;
  /** Llança un poder d'una criatura (encanteri o acció especial). */
  onCastPower: (tokenKey: string, power: MonsterPower) => void;
  /** Poders gastats en combat per token (id → recàrrega que cal al d6). */
  powerSpent: Record<string, Record<string, number>>;
  /** Diàlegs preparats de cada token (veure `useDialog`). */
  dialogs: Record<string, SavedDialog[]>;
  /** Frase improvisada: globus sobre el token (combat) o escena (barres i càmera). */
  onSpeak: (tokenKey: string, text: string, kind: 'scene' | 'bubble') => void;
  onPlayDialog: (tokenKey: string, id: string) => void;
  /** Obre la pestanya «Diàleg» per preparar-ne un per a aquest token. */
  onEditDialogs: (tokenKey: string) => void;
  /** Fitxes de la API i experiència (secció «Fitxa» dels jugadors). */
  characters: CharacterMenuProps;
}

/**
 * «Parlar»: una frase al moment (globus sobre el token, que no trenca els torns, o escena
 * amb barres i càmera) i els diàlegs preparats d'aquest token.
 */
function TokenSpeech({ tokenKey, dialogs, onSpeak, onPlay, onEdit }: {
  tokenKey: string; dialogs: SavedDialog[];
  onSpeak: (text: string, kind: 'scene' | 'bubble') => void; onPlay: (id: string) => void; onEdit: () => void;
}) {
  const [text, setText] = useState('');
  const send = (kind: 'scene' | 'bubble') => { if (text.trim()) { onSpeak(text, kind); setText(''); } };
  return (
    <div style={{ borderTop: `1px solid ${C.border}`, padding: '7px 8px 8px', display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ ...sectionLabel, display: 'flex', alignItems: 'center', gap: 5, marginBottom: 0 }}>
        <SpeechIcon size={11} /> Parlar
        <span style={{ flex: 1 }} />
        <button onMouseDown={e => { e.stopPropagation(); onEdit(); }} title="Preparar un diàleg per a aquest token"
          style={{ background: 'none', border: 'none', color: C.dim, fontSize: FS.xs, cursor: 'pointer', textDecoration: 'underline', padding: 0, textTransform: 'none', letterSpacing: 0 }}>Preparar…</button>
      </div>
      <div style={{ display: 'flex', gap: 4 }}>
        <input value={text} onChange={e => setText(e.target.value)} placeholder="Què diu?" aria-label="Frase que diu el token"
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); send(e.shiftKey ? 'scene' : 'bubble'); } }}
          style={{ ...fieldStyle, flex: 1, minWidth: 0 }} data-token={tokenKey} />
        <Button size="sm" variant="secondary" disabled={!text.trim()} onMouseDown={e => { e.stopPropagation(); send('bubble'); }}
          title="Globus sobre el token, sense barres ni càmera (Enter)">Globus</Button>
        <Button size="sm" variant="secondary" disabled={!text.trim()} onMouseDown={e => { e.stopPropagation(); send('scene'); }}
          title="Escena: barres, càmera i caixa de diàleg (Maj+Enter)">Escena</Button>
      </div>
      {dialogs.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {dialogs.map(dl => (
            <Button key={dl.id} size="sm" variant="tint" color={C.magicBright} onMouseDown={e => { e.stopPropagation(); onPlay(dl.id); }}
              title={dl.afterBoss ? 'Comença després de la cinemàtica de boss' : 'Començar aquest diàleg'}>
              <PlayIcon size={9} /> {dl.title || 'Diàleg'}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Amplada dels menús: prou per als quatre camps de la fitxa d'un jugador en una fila. */
const MENU_W = 272;

const menuBox = (x: number, y: number, maxH: number): React.CSSProperties => ({
  position: 'fixed',
  left: Math.max(8, Math.min(x, window.innerWidth - MENU_W - 8)),
  top: Math.max(8, Math.min(y, window.innerHeight - maxH)),
  width: MENU_W, maxHeight: window.innerHeight - 16, overflowY: 'auto',
  background: C.panel, border: `1px solid ${C.border}`, borderRadius: RADIUS.lg,
  zIndex: 9999, boxShadow: SHADOW.menu,
});

/** Distància entre el token i el menú obert al seu costat (px). */
const SIDE_GAP = 14;
/**
 * Menú d'un token obert des del mapa (`anchor` = capsa del token a la finestra): al costat del token
 * (a la dreta; si no hi cap, a l'esquerra), centrat verticalment respecte d'ell i sempre dins de la
 * finestra. Abans s'obria sota el cursor i tapava el token que s'estava editant. `h`: alçada mesurada.
 */
export const anchoredBox = (a: NonNullable<ContextMenuState['anchor']>, h: number): React.CSSProperties => {
  const W = window.innerWidth, H = window.innerHeight;
  let left = a.r + SIDE_GAP;
  if (left + MENU_W > W - 8) left = a.l - SIDE_GAP - MENU_W;
  if (left < 8) left = Math.max(8, Math.min(a.r + SIDE_GAP, W - MENU_W - 8));  // pantalla estreta: no hi cap a cap costat
  const hh = Math.min(h, H - 16);
  const top = Math.max(8, Math.min((a.t + a.b) / 2 - hh / 2, H - hh - 8));
  return { ...menuBox(left, top, 0), left, top };
};

/** Posició d'un menú flotant (l'ha mogut el DM): on l'ha deixat, amb la capçalera sempre a la vista. */
const floatBox = (p: MenuPos): React.CSSProperties => {
  const top = Math.max(8, Math.min(p.y, window.innerHeight - 48));
  return {
    ...menuBox(p.x, top, 0), top, maxHeight: window.innerHeight - top - 8,
    border: `1px solid ${tint(C.accent, 0.45)}`,
  };
};

const sectionLabel: React.CSSProperties = {
  fontSize: FS.xs, color: C.dim, marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.08em',
};

const fieldStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', background: C.bg, border: `1px solid ${C.border}`,
  borderRadius: RADIUS.sm, padding: '4px 6px', color: C.text, fontSize: FS.sm, outline: 'none',
};

/**
 * Treu el focus del camp que s'estigui editant: el seu `onBlur` aplica el valor. Cal fer-ho
 * ABANS de tancar el menú, perquè un camp que es desmunta amb el focus no rep el `blur`.
 */
function blurActive() {
  const el = document.activeElement;
  if (el instanceof HTMLElement) el.blur();
}

/**
 * Capçalera comuna dels menús: mànec per moure'l, títol, accessoris opcionals i ✕ de tancar
 * (✕ = tancar, sempre). S'arrossega pel mànec o per qualsevol tros buit de la capçalera.
 */
function MenuHeader({ title, children, onClose, onDrag, floating }: {
  title: React.ReactNode; children?: React.ReactNode; onClose: () => void;
  onDrag: (e: React.PointerEvent<HTMLElement>) => void; floating: boolean;
}) {
  return (
    <div onPointerDown={onDrag}
      style={{ padding: '7px 8px 7px 4px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 6, cursor: 'grab', touchAction: 'none' }}>
      <span title={floating ? 'Menú flotant: es queda obert on l\'has deixat (✕ o Esc per tancar-lo)' : 'Arrossega per moure el menú i deixar-lo fix al costat del mapa'}
        style={{ display: 'flex', flexShrink: 0, color: floating ? C.accent : C.dim, padding: '2px 0' }}>
        <GripIcon size={13} />
      </span>
      {typeof title === 'string'
        ? <span style={{ flex: 1, minWidth: 0, color: C.bright, fontFamily: FONT_SERIF, fontWeight: 600, fontSize: 17, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</span>
        : <div style={{ flex: 1, minWidth: 0, display: 'flex' }}>{title}</div>}
      {children}
      <button onMouseDown={e => { e.stopPropagation(); onClose(); }} title="Tancar (Esc)"
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.dim, padding: 2, display: 'flex', flexShrink: 0 }}>
        <X size={13} />
      </button>
    </div>
  );
}

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
function AttackList({ attacks, onPick, ammoOf }: { attacks: SheetAttack[]; onPick: (a: SheetAttack) => void; ammoOf?: (a: SheetAttack) => number | null }) {
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
            <Button key={`${a.name}-${i}`} size="sm" variant="tint" color={C.enemy}
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

/** Descans d'un jugador (v5.03): el curt torna les habilitats de descans curt; el llarg, totes i tota la vida. */
function RestButtons({ onRest }: { onRest: (kind: 'short' | 'long') => void }) {
  return (
    <div style={{ padding: '6px 8px', borderTop: `1px solid ${C.border}`, display: 'flex', gap: 4 }}>
      <Button size="sm" variant="tint" title="Torna les habilitats de descans curt" onMouseDown={e => { e.stopPropagation(); onRest('short'); }}>Descans curt</Button>
      <Button size="sm" variant="tint" color={C.ok} title="Torna tota la vida i totes les habilitats" onMouseDown={e => { e.stopPropagation(); onRest('long'); }}>Descans llarg</Button>
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
function PowerList({ powers, spent, onCast, title = 'Poders i conjurs' }: { powers: MonsterPower[]; spent: Record<string, number>; onCast: (p: MonsterPower) => void; title?: string }) {
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
                <Button key={p.id} size="sm" variant="tint" color={meta?.color ?? C.magic}
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
function Spellbook({ playerName, onCast }: { playerName: string; onCast: (type: import('@/types').SpellType) => void }) {
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
                <Button key={b.type} size="sm" variant="tint" color={meta?.color ?? C.magic}
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

export function ContextMenuOverlay({
  contextMenu, conditions, defeated, rDefeated, defeatedAnimRef, rConditions,
  edit, onRemovePlayer,
  onClose: closeMenu, onToggleCondition, onDeletePaintedZone, onDeleteAreaSpell, onOpenSceneConfig, onBroadcast, onBeforeTokens,
  setDefeated, setConditions,
  removeLibEnemy,
  onCreateGroup, onDissolveGroup, onLeaveGroup,
  onSetRoomDark, onToggleRoomReveal, onRenameRoom, onDeleteRoom, onAddDoor, onResetExplored, onCastSpell, onAttack, onCastPower, powerSpent,
  dialogs, onSpeak, onPlayDialog, onEditDialogs, floatPos, onFloat, characters,
}: Props) {
  // Confirmació d'eliminar sala: esborrar una sala també n'esborra les parets exclusives,
  // així que el botó demana confirmació en dos passos (com el ✕ del TurnTracker). Es desa
  // l'id de la sala en comptes d'un booleà: així obrir el menú d'una altra sala ja no arriba
  // confirmat, sense necessitat d'un efecte que reiniciï l'estat.
  const [confirmDelRoomId, setConfirmDelRoomId] = useState<string | null>(null);
  // Mateix criteri per eliminar un jugador (treu el jugador de la partida, no només del mapa).
  const [confirmDelPlayer, setConfirmDelPlayer] = useState<string | null>(null);
  // Tancar = primer aplicar el camp a mig editar (nom, vida màxima…), després desmuntar.
  const onClose = useCallback(() => { blurActive(); closeMenu(); }, [closeMenu]);
  // ✕ i Esc tanquen del tot: també deixa de ser flotant (el pròxim s'obre al costat del cursor).
  // Les accions del menú que el tanquen (parlar, llançar un conjur…) conserven el lloc flotant.
  const onDismiss = useCallback(() => { onFloat(null); onClose(); }, [onFloat, onClose]);
  const floating = !!floatPos;
  // Alçada real del menú del token, per centrar-lo verticalment respecte del token (`anchoredBox`).
  // ResizeObserver avisa després del layout i abans de pintar: no es veu cap salt.
  const [menuEl, setMenuEl] = useState<HTMLDivElement | null>(null);
  const [menuH, setMenuH] = useState(0);
  useLayoutEffect(() => {
    if (!menuEl) return;
    const ro = new ResizeObserver(() => setMenuH(menuEl.offsetHeight));
    ro.observe(menuEl);
    return () => ro.disconnect();
  }, [menuEl]);

  useEffect(() => {
    if (!contextMenu) return;
    // Flotant: un clic fora (al mapa, al lateral) no el tanca; per això s'ha mogut.
    const close = (e: MouseEvent) => { if (!floating && !(e.target as Element).closest?.('[data-ctxmenu]')) onClose(); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onDismiss(); };
    window.addEventListener('mousedown', close);
    window.addEventListener('keydown', esc);
    return () => { window.removeEventListener('mousedown', close); window.removeEventListener('keydown', esc); };
  }, [contextMenu, onClose, onDismiss, floating]);

  /** Arrossegar el menú per la capçalera (no des dels camps ni dels botons que hi ha). */
  const startDrag = (e: React.PointerEvent<HTMLElement>) => {
    if (e.button !== 0 || (e.target as Element).closest('input, textarea, select, button')) return;
    const menu = e.currentTarget.closest('[data-ctxmenu]');
    if (!menu) return;
    e.preventDefault();
    const r = menu.getBoundingClientRect();
    const dx = e.clientX - r.left, dy = e.clientY - r.top;
    const move = (ev: PointerEvent) => onFloat({ x: ev.clientX - dx, y: ev.clientY - dy });
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    onFloat({ x: r.left, y: r.top });
  };
  // Obert des d'un token del mapa (`anchor`): al seu costat; si no, sota el cursor (sales, zones, lateral).
  const box = (x: number, y: number, maxH: number) => floatPos ? floatBox(floatPos)
    : contextMenu?.anchor ? anchoredBox(contextMenu.anchor, menuH || maxH) : menuBox(x, y, maxH);
  const head = { onClose: onDismiss, onDrag: startDrag, floating };

  if (!contextMenu) return null;
  const id = String(contextMenu.id);

  // ── Menú de sala (eina Parets) ────────────────────────────────────────────
  if (contextMenu.isRoom) {
    const rid = String(contextMenu.id);
    const dark = !!contextMenu.roomDark;
    const revealed = !!contextMenu.roomRevealed;
    return (
      <div data-ctxmenu="1" style={box(contextMenu.x, contextMenu.y, 300)}>
        <MenuHeader title="Sala" {...head}>
          <span style={{ color: C.dim, fontSize: FS.xs }}>{dark ? (revealed ? 'fosca · revelada' : 'fosca · amagada') : 'normal'}</span>
        </MenuHeader>
        <div style={{ padding: '6px 8px', borderBottom: `1px solid ${C.border}` }}>
          <div style={sectionLabel}>Nom</div>
          <input
            defaultValue={contextMenu.name}
            onKeyDown={e => { if (e.key === 'Enter') { onRenameRoom(rid, (e.target as HTMLInputElement).value); onClose(); } }}
            onBlur={e => onRenameRoom(rid, e.target.value)}
            style={fieldStyle}
          />
        </div>
        <div style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Button block active={dark} variant="secondary" onMouseDown={e => { e.stopPropagation(); onSetRoomDark(rid, !dark); }}>
            <MoonIcon size={13} /> {dark ? 'És una sala fosca (treure)' : 'Marcar com a sala fosca'}
          </Button>
          {dark && (
            <Button block variant="tint" color={C.room} onMouseDown={e => { e.stopPropagation(); onToggleRoomReveal(rid); }}>
              {revealed ? <><EyeOff size={13} /> Amagar als jugadors</> : <><Eye size={13} /> Revelar als jugadors</>}
            </Button>
          )}
          <Button block variant="tint" color={C.ok} onMouseDown={e => { e.stopPropagation(); onAddDoor(rid); }}>
            <DoorIcon size={13} /> Afegir porta (clic sobre una paret)
          </Button>
          {dark && (
            <Button block variant="secondary" onMouseDown={e => { e.stopPropagation(); onResetExplored(rid); }}>
              <RotateCcw size={13} /> Resetejar explorat (torna a negra)
            </Button>
          )}
          {confirmDelRoomId === rid ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, padding: '7px 8px', borderRadius: RADIUS.md, background: tint(C.enemy, 0.1), border: `1px solid ${tint(C.enemy, 0.35)}` }}>
              <span style={{ color: C.enemy, fontSize: FS.sm, fontWeight: 700 }}>Eliminar «{contextMenu.name}»?</span>
              <span style={{ color: C.dim, fontSize: FS.xs, lineHeight: 1.35 }}>També s&apos;esborraran les parets que només pertanyen a aquesta sala.</span>
              <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
                <Button style={{ flex: 1, background: C.enemy, borderColor: C.enemy, color: '#fff' }} onMouseDown={e => { e.stopPropagation(); onDeleteRoom(rid); onClose(); }}>
                  Sí, eliminar
                </Button>
                <Button style={{ flex: 1 }} onMouseDown={e => { e.stopPropagation(); setConfirmDelRoomId(null); }}>
                  Cancel·la
                </Button>
              </div>
            </div>
          ) : (
            <Button block variant="danger" onMouseDown={e => { e.stopPropagation(); setConfirmDelRoomId(rid); }}>
              <Trash2 size={13} /> Eliminar sala (esborra les seves parets)
            </Button>
          )}
        </div>
      </div>
    );
  }

  if (contextMenu.isMultiSelect && contextMenu.ids) {
    const ids = contextMenu.ids;
    const idsStr = ids.map(String);
    const libCount = ids.filter(tid => typeof tid === 'string' && tid.startsWith('lib_')).length;
    return (
      <div ref={setMenuEl} data-ctxmenu="1" style={box(contextMenu.x, contextMenu.y, 440)}>
        <MenuHeader title={contextMenu.name} {...head} />
        <ConditionPicker
          multi
          active={[]}
          onToggle={condId => idsStr.forEach(tid => onToggleCondition(tid, condId))}
          onClear={() => {
            onBeforeTokens('treure els estats', idsStr);
            const nc = { ...rConditions.current };
            idsStr.forEach(tid => delete nc[tid]);
            rConditions.current = nc; setConditions({ ...nc }); onBroadcast();
          }}
        />
        <div style={{ borderTop: `1px solid ${C.border}`, padding: '6px 8px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {contextMenu.existingGroupId ? (
            <Button block variant="tint" color={C.magicBright} onMouseDown={e => { e.stopPropagation(); onDissolveGroup(contextMenu.existingGroupId!); onClose(); }}>
              <UnlinkIcon size={13} /> Dissoldre grup
            </Button>
          ) : (
            <Button block variant="tint" color={C.magicBright} onMouseDown={e => { e.stopPropagation(); onCreateGroup(ids); onClose(); }}>
              <LinkIcon size={13} /> Crear grup
            </Button>
          )}
          <Button block variant="danger" onMouseDown={e => {
            e.stopPropagation();
            onBeforeTokens('marcar tots derrotats', idsStr);
            const nd = { ...rDefeated.current };
            idsStr.forEach(tid => { if (!nd[tid]) { nd[tid] = true; defeatedAnimRef.current[tid] = 0; } });
            rDefeated.current = nd; setDefeated({ ...nd }); onBroadcast();
          }}>
            <SkullIcon size={13} /> Marcar tots derrotats
          </Button>
          {libCount > 0 && (
            <Button block variant="danger" onMouseDown={e => {
              e.stopPropagation();
              ids.forEach(tid => { if (typeof tid === 'string' && tid.startsWith('lib_')) removeLibEnemy(parseInt(tid.replace('lib_', ''))); });
              onClose();
            }}>
              <Trash2 size={13} /> Treure de l&apos;escena ({libCount})
            </Button>
          )}
        </div>
      </div>
    );
  }

  // ── Zona màgica / encanteri d'àrea ────────────────────────────────────────
  if (contextMenu.isPaintedZone || contextMenu.isAreaSpell) {
    return (
      <div data-ctxmenu="1" style={box(contextMenu.x, contextMenu.y, 140)}>
        <MenuHeader title={contextMenu.name} {...head}>
          <span style={{ color: C.dim, fontSize: FS.xs }}>{contextMenu.isPaintedZone ? 'Zona màgica' : 'Encanteri d\'àrea'}</span>
        </MenuHeader>
        <div style={{ padding: 8 }}>
          <Button block variant="danger" onMouseDown={e => { e.stopPropagation(); if (contextMenu.isPaintedZone) onDeletePaintedZone(id); else onDeleteAreaSpell(id); onClose(); }}>
            <Trash2 size={13} /> Eliminar {contextMenu.isPaintedZone ? 'zona' : 'encanteri'}
          </Button>
        </div>
      </div>
    );
  }

  // ── Token (jugador o enemic de la biblioteca) ────────────────────
  const isDefeated = !!defeated[id];
  const toggleDefeated = () => {
    onBeforeTokens(defeated[id] ? 'treure derrotat' : 'derrotar', [String(id)]);
    const nd = { ...rDefeated.current };
    if (nd[id]) delete nd[id]; else { nd[id] = true; defeatedAnimRef.current[id] = 0; }
    if (!nd[id]) delete defeatedAnimRef.current[id];
    rDefeated.current = nd; setDefeated({ ...nd }); onBroadcast();
  };

  // El nom, la vida i la resta de la fitxa es llegeixen de l'estat (no del `contextMenu`, que
  // és una foto del moment d'obrir-lo): així el menú es refresca mentre s'edita.
  const t = resolveToken(contextMenu.id, edit);
  if (!t) return null;
  const lib = t.lib;
  const pl = t.player;
  const book = contextMenu.casterPos ? spellbookFor(t.name) : [];
  const actionBtn: React.CSSProperties = { flex: '1 1 auto', minWidth: 0 };
  return (
    <div key={t.key} ref={setMenuEl} data-ctxmenu="1" style={box(contextMenu.x, contextMenu.y, book.length > 0 ? 680 : 460)}>
      <MenuHeader title={<NameField key={`${t.key}:${t.name}`} value={t.name} onCommit={t.rename} />} {...head}>
        {/* Derrotat és un interruptor amb nom: abans era un ✕ solt just on s'espera el botó
            de tancar el menú, i en tota la resta de l'app ✕ vol dir tancar o eliminar. */}
        <Button size="sm" variant="secondary" active={isDefeated} color={C.enemy}
          onMouseDown={e => { e.stopPropagation(); toggleDefeated(); }}
          title={isDefeated ? 'Derrotat · clic per tornar-lo a la vida' : 'Marcar com a derrotat (surt amb la X al mapa i se li salta el torn)'}>
          <SkullIcon size={12} /> {isDefeated ? 'Derrotat' : 'Derrotar'}
        </Button>
      </MenuHeader>

      {/* Ordre: Dades (vida i camps del token), Conjurs, Estats, Parla i Nivell (fitxa del
          personatge); al final, les accions de gestió. */}
      <div style={{ padding: '7px 8px 8px', borderBottom: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', gap: 7 }}>
        <div style={sectionLabel}>Dades</div>
        {t.hpMax > 0 && <div style={{ display: 'flex' }}><HpControl hp={t.hp} hpMax={t.hpMax} onAdjust={t.adjustHp} size="md" /></div>}
        <TokenFields t={t} p={edit} />
      </div>

      {contextMenu.canAttack && (() => {
        const ch = pl ? characterFor(pl, characters.characters) : null;
        // Enemics: els atacs del seu bloc de 5e (bestiari de l'app) o, si no en té, un cos a cos amb
        // l'abast de la BD (`defenses.reachFt`, 5 ft si no en té).
        const mo = lib ? monsterForEnemy(lib) : null;
        const own = ch ? attacksOf(sheetOf(ch)) : mo ? mo.attacks.filter(a => a.damage) : [];
        const reach = lib ? enemyDefenses(lib)?.reachFt : undefined;
        const generic = reach !== undefined ? { ...GENERIC_MELEE, reachFt: reach } : GENERIC_MELEE;
        const list = own.length > 0 ? own : [generic];
        return <><AttackList attacks={list} ammoOf={ch ? a => ammoLeft(sheetOf(ch), a) : undefined} onPick={a => {
          const { normalFt, longFt } = attackRanges(a);
          onAttack({ key: t.key, label: a.name, normalFt, longFt, damageType: a.damageType, kind: a.kind, ammo: a.ammo });
          onClose();
        }} />
        {ch && sheetOf(ch).ammo?.length ? <AmmoControls stacks={sheetOf(ch).ammo!} onAdjust={(name, d) => characters.onAdjustAmmo(ch.id, name, d)} /> : null}</>;
      })()}

      {pl && <RestButtons onRest={k => characters.onRest(pl.id, k)} />}

      {pl && (() => {
        const ch = characterFor(pl, characters.characters);
        const sh = ch ? sheetOf(ch) : null;
        return sh?.powers?.length ? <PowerList title="Habilitats" powers={sh.powers} spent={powerSpent[t.key] ?? {}}
          onCast={p => { onCastPower(t.key, p); onClose(); }} /> : null;
      })()}

      {lib && (() => {
        const mo = monsterForEnemy(lib);
        return mo?.powers?.length ? <PowerList powers={mo.powers} spent={powerSpent[t.key] ?? {}} onCast={p => { onCastPower(t.key, p); onClose(); }} /> : null;
      })()}

      {contextMenu.casterPos && (() => {
        const origin = contextMenu.casterPos;
        return <Spellbook playerName={t.name} onCast={type => { onCastSpell(type, origin); onClose(); }} />;
      })()}

      {lib && <MonsterBlock monster={monsterForEnemy(lib)} defenses={enemyDefenses(lib)} />}
      {pl && (() => {
        const ch = characterFor(pl, characters.characters);
        return ch ? <MonsterBlock player monster={monsterFromCharacter(ch)} /> : null;
      })()}

      <ConditionPicker
        active={conditions[id] || []}
        onToggle={condId => onToggleCondition(id, condId)}
        onClear={() => {
          const nc = { ...rConditions.current }; delete nc[id];
          rConditions.current = nc; setConditions({ ...nc }); onBroadcast();
        }}
      />

      <TokenSpeech tokenKey={t.key} dialogs={dialogs[t.key] ?? []}
        onSpeak={(text, kind) => { onSpeak(t.key, text, kind); onClose(); }}
        onPlay={dlgId => { onPlayDialog(t.key, dlgId); onClose(); }}
        onEdit={() => { onEditDialogs(t.key); onClose(); }} />

      {pl && <CharacterSection player={pl} p={{ ...characters, onShowSheet: (cid, key) => { characters.onShowSheet(cid, key); onClose(); } }} />}

      <div style={{ borderTop: `1px solid ${C.border}`, padding: '6px 8px 8px' }}>
        {pl && confirmDelPlayer === t.key ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ flex: 1, minWidth: 0, fontSize: FS.sm, color: C.enemy, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Eliminar {t.name}?</span>
            <Button size="sm" variant="danger" onMouseDown={e => { e.stopPropagation(); onRemovePlayer(pl.id); onClose(); }}>Sí, eliminar</Button>
            <Button size="sm" onMouseDown={e => { e.stopPropagation(); setConfirmDelPlayer(null); }}>No</Button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {contextMenu.existingGroupId && (
              <Button size="sm" variant="secondary" style={actionBtn} onMouseDown={e => { e.stopPropagation(); onLeaveGroup(contextMenu.id); onClose(); }}>
                <UnlinkIcon size={11} /> Sortir del grup
              </Button>
            )}
            <Button size="sm" variant="tint" color={C.magicBright} style={actionBtn} title="Presentació del boss a les pantalles de jugador"
              onMouseDown={e => { e.stopPropagation(); onOpenSceneConfig(); }}>
              <ZapIcon size={11} /> Cinemàtica
            </Button>
            {lib && (
              <Button size="sm" variant="danger" style={actionBtn} onMouseDown={e => { e.stopPropagation(); removeLibEnemy(lib.id); onClose(); }}>
                <Trash2 size={11} /> Treure de l&apos;escena
              </Button>
            )}
            {pl && (
              <Button size="sm" variant="danger" style={actionBtn} title="Treu el jugador de la partida"
                onMouseDown={e => { e.stopPropagation(); setConfirmDelPlayer(t.key); }}>
                <Trash2 size={11} /> Eliminar jugador
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
