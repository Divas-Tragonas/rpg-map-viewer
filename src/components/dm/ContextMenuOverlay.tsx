'use client';
import React, { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { X, GripIcon, MoonIcon, Eye, EyeOff, DoorIcon, RotateCcw, Trash2, UnlinkIcon, LinkIcon, SkullIcon, ZapIcon, SpeechIcon, PlayIcon, SwordsIcon } from '@/components/icons';
import { ConditionPicker } from '@/components/ui/ConditionPicker';
import { HpControl } from '@/components/ui/HpControl';
import { Button } from '@/components/ui/Button';
import { NameField, TokenFields, resolveToken, type TokenEditProps } from '@/components/dm/TokenFields';
import { CharacterSection, type CharacterMenuProps } from '@/components/dm/CharacterSection';
import { C, FS, RADIUS, SHADOW, tint, FONT_SERIF } from '@/constants';
import type { ContextMenuState, ConditionsMap, DefeatedMap, SavedDialog } from '@/types';
import { characterFor, monsterFromCharacter } from '@/lib/characters';
import { monsterForEnemy } from '@/lib/db-enemies';
import { enemyDefenses } from '@/lib/rules/damage';
import { MonsterBlock } from '@/components/dm/MonsterBlock';

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
  onCreateGroup: (ids: (number | string)[], at: { x: number; y: number }) => void;
  onDissolveGroup: (groupId: string) => void;
  onLeaveGroup: (id: number | string) => void;
  onSetRoomDark: (id: string, dark: boolean) => void;
  onToggleRoomReveal: (id: string) => void;
  onRenameRoom: (id: string, name: string) => void;
  onDeleteRoom: (id: string) => void;
  onAddDoor: (id: string) => void;
  onResetExplored: (id: string) => void;
  /** Obre el panell d'accions (atacs, poders, conjurs) amb aquest token. */
  onOpenActions?: (tokenKey: string) => void;
  /** Moure el token a la força (empènyer, estirar, l'Empenta): el ratolí tria la direcció. */
  onForceMove?: (tokenKey: string, ft: number) => void;
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
const MENU_W = 336;

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

/** Descans d'un jugador (v5.03): el curt torna les habilitats de descans curt; el llarg, totes i tota la vida. */
function RestButtons({ onRest }: { onRest: (kind: 'short' | 'long') => void }) {
  return (
    <div style={{ padding: '6px 8px', borderTop: `1px solid ${C.border}`, display: 'flex', gap: 4 }}>
      <Button size="sm" variant="tint" title="Torna les habilitats de descans curt" onMouseDown={e => { e.stopPropagation(); onRest('short'); }}>Descans curt</Button>
      <Button size="sm" variant="tint" color={C.ok} title="Torna tota la vida i totes les habilitats" onMouseDown={e => { e.stopPropagation(); onRest('long'); }}>Descans llarg</Button>
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
  onSetRoomDark, onToggleRoomReveal, onRenameRoom, onDeleteRoom, onAddDoor, onResetExplored, onOpenActions, onForceMove,
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
            <Button block variant="tint" color={C.magicBright} onMouseDown={e => { e.stopPropagation(); onCreateGroup(ids, { x: e.clientX, y: e.clientY }); onClose(); }}>
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
  const actionBtn: React.CSSProperties = { flex: '1 1 auto', minWidth: 0 };
  return (
    <div key={t.key} ref={setMenuEl} data-ctxmenu="1" style={box(contextMenu.x, contextMenu.y, 460)}>
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

      {/* Atacs, poders i conjurs: al panell d'accions de la dreta (v5.42). Aquí, un botó per obrir-lo. */}
      {contextMenu.canAttack && onOpenActions && (
        <div style={{ padding: '6px 8px', borderTop: `1px solid ${C.border}` }}>
          <Button size="sm" block variant="tint" color={C.enemy} title="Atacs, poders i conjurs d'aquest token al panell de la dreta"
            onMouseDown={e => { e.stopPropagation(); onOpenActions(t.key); onClose(); }}>
            <SwordsIcon size={12} /> Accions (atacs, poders, conjurs)
          </Button>
        </div>
      )}

      {onForceMove && (pl || lib) && (
        <div style={{ padding: '6px 8px', borderTop: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 4 }}
          title="Empènyer o estirar el token en línia recta (Empenta, una envestida, un conjur): tria els peus, apunta amb el ratolí cap on surt i clica. S'atura a les parets i a les altres criatures; no gasta peus del seu torn. Esc cancel·la">
          <span style={{ flex: 1, fontSize: FS.xs, color: C.dim, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Moure a la força</span>
          {[5, 10, 15, 20].map(ft => (
            <Button key={ft} size="sm" variant="secondary" onMouseDown={e => { e.stopPropagation(); onForceMove(t.key, ft); onClose(); }}>{ft}</Button>
          ))}
          <span style={{ fontSize: FS.xs, color: C.dim }}>ft</span>
        </div>
      )}

      {pl && <RestButtons onRest={k => characters.onRest(pl.id, k)} />}

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
