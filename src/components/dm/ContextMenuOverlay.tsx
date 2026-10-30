'use client';
import React, { useCallback, useEffect, useState } from 'react';
import { X, SparklesIcon, MoonIcon, Eye, EyeOff, DoorIcon, RotateCcw, Trash2, UnlinkIcon, LinkIcon, SkullIcon, ZapIcon } from '@/components/icons';
import { ConditionPicker } from '@/components/ui/ConditionPicker';
import { HpControl } from '@/components/ui/HpControl';
import { Button } from '@/components/ui/Button';
import { NameField, TokenFields, resolveToken, type TokenEditProps } from '@/components/dm/TokenFields';
import { C, FS, RADIUS, SHADOW, tint, SPELL_BY_TYPE, SPELL_MODES, AREA_SPELL_DATA, spellRangeFt, spellbookFor, FONT_SERIF } from '@/constants';
import type { ContextMenuState, ConditionsMap, DefeatedMap } from '@/types';

interface Props {
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

/** Capçalera comuna dels menús: títol, accessoris opcionals i ✕ de tancar (✕ = tancar, sempre). */
function MenuHeader({ title, children, onClose }: { title: React.ReactNode; children?: React.ReactNode; onClose: () => void }) {
  return (
    <div style={{ padding: '7px 8px 7px 12px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 6 }}>
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
                  <span style={{ flexShrink: 0 }}>{meta?.emoji}</span>
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
  onClose: closeMenu, onToggleCondition, onDeletePaintedZone, onDeleteAreaSpell, onOpenSceneConfig, onBroadcast,
  setDefeated, setConditions,
  removeLibEnemy,
  onCreateGroup, onDissolveGroup, onLeaveGroup,
  onSetRoomDark, onToggleRoomReveal, onRenameRoom, onDeleteRoom, onAddDoor, onResetExplored, onCastSpell,
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

  useEffect(() => {
    if (!contextMenu) return;
    const close = (e: MouseEvent) => { if (!(e.target as Element).closest?.('[data-ctxmenu]')) onClose(); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('mousedown', close);
    window.addEventListener('keydown', esc);
    return () => { window.removeEventListener('mousedown', close); window.removeEventListener('keydown', esc); };
  }, [contextMenu, onClose]);

  if (!contextMenu) return null;
  const id = String(contextMenu.id);

  // ── Menú de sala (eina Parets) ────────────────────────────────────────────
  if (contextMenu.isRoom) {
    const rid = String(contextMenu.id);
    const dark = !!contextMenu.roomDark;
    const revealed = !!contextMenu.roomRevealed;
    return (
      <div data-ctxmenu="1" style={menuBox(contextMenu.x, contextMenu.y, 300)}>
        <MenuHeader title="Sala" onClose={onClose}>
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
      <div data-ctxmenu="1" style={menuBox(contextMenu.x, contextMenu.y, 440)}>
        <MenuHeader title={contextMenu.name} onClose={onClose} />
        <ConditionPicker
          multi
          active={[]}
          onToggle={condId => idsStr.forEach(tid => onToggleCondition(tid, condId))}
          onClear={() => {
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
      <div data-ctxmenu="1" style={menuBox(contextMenu.x, contextMenu.y, 140)}>
        <MenuHeader title={contextMenu.name} onClose={onClose}>
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

  // ── Token (jugador, enemic del PSD o de la biblioteca) ────────────────────
  const isDefeated = !!defeated[id];
  const toggleDefeated = () => {
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
    <div key={t.key} data-ctxmenu="1" style={menuBox(contextMenu.x, contextMenu.y, book.length > 0 ? 620 : 400)}>
      <MenuHeader title={<NameField key={`${t.key}:${t.name}`} value={t.name} onCommit={t.rename} />} onClose={onClose}>
        {/* Derrotat és un interruptor amb nom: abans era un ✕ solt just on s'espera el botó
            de tancar el menú, i en tota la resta de l'app ✕ vol dir tancar o eliminar. */}
        <Button size="sm" variant="secondary" active={isDefeated} color={C.enemy}
          onMouseDown={e => { e.stopPropagation(); toggleDefeated(); }}
          title={isDefeated ? 'Derrotat · clic per tornar-lo a la vida' : 'Marcar com a derrotat (surt amb la X al mapa i se li salta el torn)'}>
          <SkullIcon size={12} /> {isDefeated ? 'Derrotat' : 'Derrotar'}
        </Button>
      </MenuHeader>

      {/* Fitxa: vida i, a sota, els camps que es configuren (vida màxima, mida, velocitat…). */}
      <div style={{ padding: '7px 8px 8px', borderBottom: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', gap: 7 }}>
        {t.hpMax > 0 && <div style={{ display: 'flex' }}><HpControl hp={t.hp} hpMax={t.hpMax} onAdjust={t.adjustHp} size="md" /></div>}
        <TokenFields t={t} p={edit} />
      </div>

      <ConditionPicker
        active={conditions[id] || []}
        onToggle={condId => onToggleCondition(id, condId)}
        onClear={() => {
          const nc = { ...rConditions.current }; delete nc[id];
          rConditions.current = nc; setConditions({ ...nc }); onBroadcast();
        }}
      />

      {contextMenu.casterPos && (() => {
        const origin = contextMenu.casterPos;
        return <Spellbook playerName={t.name} onCast={type => { onCastSpell(type, origin); onClose(); }} />;
      })()}

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
