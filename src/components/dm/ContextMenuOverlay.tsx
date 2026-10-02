'use client';
import React, { useEffect, useState } from 'react';
import { X } from '@/components/icons';
import { ConditionPicker } from '@/components/ui/ConditionPicker';
import { HpControl } from '@/components/ui/HpControl';
import { Button } from '@/components/ui/Button';
import { C, FS, RADIUS, SHADOW, tint } from '@/constants';
import type { ContextMenuState, ConditionsMap, DefeatedMap, LibEnemy, PsdEnemyOverrides } from '@/types';

interface Props {
  contextMenu: ContextMenuState | null;
  conditions: ConditionsMap;
  defeated: DefeatedMap;
  rDefeated: React.MutableRefObject<DefeatedMap>;
  defeatedAnimRef: React.MutableRefObject<Record<string, number>>;
  rConditions: React.MutableRefObject<ConditionsMap>;
  // Estat (no refs): el menú en llegeix la vida i el nom durant el render.
  libEnemies: LibEnemy[];
  psdEnemyOverrides: PsdEnemyOverrides;
  players: import('@/types').Player[];
  ctxEditName: string;
  setCtxEditName: (v: string) => void;
  ctxEditHpMax: number;
  setCtxEditHpMax: (v: number) => void;
  ctxEditSizeFt: number;
  setCtxEditSizeFt: (v: number) => void;
  onSetTokenSize: (id: string, feet: number) => void;
  onClose: () => void;
  onToggleCondition: (tokenId: string, condId: string) => void;
  onDeletePaintedZone: (id: string) => void;
  onDeleteAreaSpell: (id: string) => void;
  onOpenSceneConfig: () => void;
  onBroadcast: () => void;
  setDefeated: (v: DefeatedMap) => void;
  setConditions: (v: ConditionsMap) => void;
  adjustLibEnemyHp: (id: number, delta: number) => void;
  adjustPsdEnemyHp: (id: number, delta: number) => void;
  adjustPlayerHp: (id: number, delta: number) => void;
  setPsdEnemyProps: (id: number, props: import('@/types').PsdEnemyOverride) => void;
  setLibEnemyProps: (id: number, props: Partial<LibEnemy>) => void;
  removeLibEnemy: (id: number) => void;
  onLaunchBossIntro: (req: import('@/hooks/useCinematic').BossIntroRequest) => Promise<string | null>;
  onCreateGroup: (ids: (number | string)[]) => void;
  onDissolveGroup: (groupId: string) => void;
  onLeaveGroup: (id: number | string) => void;
  onSetRoomDark: (id: string, dark: boolean) => void;
  onToggleRoomReveal: (id: string) => void;
  onRenameRoom: (id: string, name: string) => void;
  onDeleteRoom: (id: string) => void;
  onAddDoor: (id: string) => void;
  onResetExplored: (id: string) => void;
}

/** Amplada dels menús: prou per a la graella d'estats a 4 columnes amb els noms llegibles. */
const MENU_W = 264;

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

/** Capçalera comuna dels menús: títol, accessoris opcionals i ✕ de tancar (✕ = tancar, sempre). */
function MenuHeader({ title, children, onClose }: { title: React.ReactNode; children?: React.ReactNode; onClose: () => void }) {
  return (
    <div style={{ padding: '7px 8px 7px 12px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ flex: 1, minWidth: 0, color: C.bright, fontWeight: 700, fontSize: FS.md, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</span>
      {children}
      <button onMouseDown={e => { e.stopPropagation(); onClose(); }} title="Tancar (Esc)"
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.dim, padding: 2, display: 'flex', flexShrink: 0 }}>
        <X size={13} />
      </button>
    </div>
  );
}

export function ContextMenuOverlay({
  contextMenu, conditions, defeated, rDefeated, defeatedAnimRef, rConditions,
  libEnemies, psdEnemyOverrides, players,
  ctxEditName, setCtxEditName, ctxEditHpMax, setCtxEditHpMax,
  ctxEditSizeFt, setCtxEditSizeFt, onSetTokenSize,
  onClose, onToggleCondition, onDeletePaintedZone, onDeleteAreaSpell, onOpenSceneConfig, onBroadcast,
  setDefeated, setConditions,
  adjustLibEnemyHp, adjustPsdEnemyHp, adjustPlayerHp,
  setPsdEnemyProps, setLibEnemyProps, removeLibEnemy,
  onLaunchBossIntro,
  onCreateGroup, onDissolveGroup, onLeaveGroup,
  onSetRoomDark, onToggleRoomReveal, onRenameRoom, onDeleteRoom, onAddDoor, onResetExplored,
}: Props) {
  // Confirmació d'eliminar sala: esborrar una sala també n'esborra les parets exclusives,
  // així que el botó demana confirmació en dos passos (com el ✕ del TurnTracker). Es desa
  // l'id de la sala en comptes d'un booleà: així obrir el menú d'una altra sala ja no arriba
  // confirmat, sense necessitat d'un efecte que reiniciï l'estat.
  const [confirmDelRoomId, setConfirmDelRoomId] = useState<string | null>(null);

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
        <MenuHeader title="🧱 Sala" onClose={onClose}>
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
            {dark ? '🌑 És una sala fosca (treure)' : '🌑 Marcar com a sala fosca'}
          </Button>
          {dark && (
            <Button block variant="tint" color={C.room} onMouseDown={e => { e.stopPropagation(); onToggleRoomReveal(rid); }}>
              {revealed ? '🙈 Amagar als jugadors' : '👁 Revelar als jugadors'}
            </Button>
          )}
          <Button block variant="tint" color={C.ok} onMouseDown={e => { e.stopPropagation(); onAddDoor(rid); }}>
            🚪 Afegir porta (clic sobre una paret)
          </Button>
          {dark && (
            <Button block variant="secondary" onMouseDown={e => { e.stopPropagation(); onResetExplored(rid); }}>
              🌑 Resetejar explorat (torna a negra)
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
              🗑 Eliminar sala (esborra les seves parets)
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
              🔓 Dissoldre grup
            </Button>
          ) : (
            <Button block variant="tint" color={C.magicBright} onMouseDown={e => { e.stopPropagation(); onCreateGroup(ids); onClose(); }}>
              🔗 Crear grup
            </Button>
          )}
          <Button block variant="danger" onMouseDown={e => {
            e.stopPropagation();
            const nd = { ...rDefeated.current };
            idsStr.forEach(tid => { if (!nd[tid]) { nd[tid] = true; defeatedAnimRef.current[tid] = 0; } });
            rDefeated.current = nd; setDefeated({ ...nd }); onBroadcast();
          }}>
            💀 Marcar tots derrotats
          </Button>
          {libCount > 0 && (
            <Button block variant="danger" onMouseDown={e => {
              e.stopPropagation();
              ids.forEach(tid => { if (typeof tid === 'string' && tid.startsWith('lib_')) removeLibEnemy(parseInt(tid.replace('lib_', ''))); });
              onClose();
            }}>
              🗑 Treure de l&apos;escena ({libCount})
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
            🗑 Eliminar {contextMenu.isPaintedZone ? 'zona' : 'encanteri'}
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

  // Vida del token, sigui quin sigui el seu tipus: sempre el mateix control.
  let hpBlock: { hp: number; hpMax: number; adjust: (d: number) => void } | null = null;
  const lib = contextMenu.isLibEnemy ? libEnemies.find(e => e.id === contextMenu.libEnemyId) : undefined;
  if (lib && lib.hpMax > 0) hpBlock = { hp: lib.hp ?? lib.hpMax, hpMax: lib.hpMax, adjust: d => adjustLibEnemyHp(lib.id, d) };
  if (typeof contextMenu.id === 'number') {
    const pov = psdEnemyOverrides[contextMenu.id] || {};
    const hm = pov.hpMax || 0;
    const psdId = contextMenu.id;
    if (hm > 0) hpBlock = { hp: Math.max(0, pov.hp ?? hm), hpMax: hm, adjust: d => adjustPsdEnemyHp(psdId, d) };
  }
  if (typeof contextMenu.id === 'string' && contextMenu.id.startsWith('pl_')) {
    const plId = parseInt(contextMenu.id.replace('pl_', ''));
    const pl = players.find(p => p.id === plId);
    if (pl && pl.hpMax) hpBlock = { hp: pl.hp ?? pl.hpMax, hpMax: pl.hpMax, adjust: d => adjustPlayerHp(pl.id, d) };
  }
  const psdNeedsHp = typeof contextMenu.id === 'number' && !((psdEnemyOverrides[contextMenu.id]?.hpMax ?? 0) > 0);

  const saveName = () => {
    if (typeof contextMenu.id === 'number') setPsdEnemyProps(contextMenu.id, { name: ctxEditName });
    else if (contextMenu.isLibEnemy && contextMenu.libEnemyId !== undefined) setLibEnemyProps(contextMenu.libEnemyId, { name: ctxEditName });
  };

  return (
    <div data-ctxmenu="1" style={menuBox(contextMenu.x, contextMenu.y, 560)}>
      <MenuHeader title={contextMenu.name} onClose={onClose}>
        {/* Derrotat és un interruptor amb nom: abans era un ✕ solt just on s'espera el botó
            de tancar el menú, i en tota la resta de l'app ✕ vol dir tancar o eliminar. */}
        <Button size="sm" variant="secondary" active={isDefeated} color={C.enemy}
          onMouseDown={e => { e.stopPropagation(); toggleDefeated(); }}
          title={isDefeated ? 'Derrotat · clic per tornar-lo a la vida' : 'Marcar com a derrotat (surt amb la X al mapa i se li salta el torn)'}>
          💀 {isDefeated ? 'Derrotat' : 'Derrotar'}
        </Button>
      </MenuHeader>

      {hpBlock && (
        <div style={{ padding: '6px 8px', borderBottom: `1px solid ${C.border}`, display: 'flex' }}>
          <HpControl hp={hpBlock.hp} hpMax={hpBlock.hpMax} onAdjust={hpBlock.adjust} size="md" />
        </div>
      )}

      {/* Nom (enemics del PSD i de la biblioteca; el dels jugadors s'edita a la seva targeta) */}
      {(typeof contextMenu.id === 'number' || contextMenu.isLibEnemy) && (
        <div style={{ padding: '6px 8px', borderBottom: `1px solid ${C.border}` }}>
          <div style={sectionLabel}>Nom</div>
          <input
            value={ctxEditName}
            onChange={e => setCtxEditName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') saveName(); }}
            onBlur={saveName}
            style={fieldStyle}
          />
          {psdNeedsHp && (
            <>
              <div style={{ ...sectionLabel, marginTop: 6 }}>Vida màxima (0 = sense vida)</div>
              <input
                type="number" min={0} max={9999} value={ctxEditHpMax}
                onChange={e => setCtxEditHpMax(parseInt(e.target.value) || 0)}
                onBlur={() => { if (ctxEditHpMax > 0) setPsdEnemyProps(contextMenu.id as number, { hpMax: ctxEditHpMax, hp: ctxEditHpMax }); }}
                onKeyDown={e => { if (e.key === 'Enter' && ctxEditHpMax > 0) setPsdEnemyProps(contextMenu.id as number, { hpMax: ctxEditHpMax, hp: ctxEditHpMax }); }}
                style={fieldStyle}
              />
            </>
          )}
        </div>
      )}

      <div style={{ padding: '6px 8px', borderBottom: `1px solid ${C.border}` }}>
        <div style={sectionLabel}>Mida (peus)</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input
            type="number" min={1} step={0.5} value={ctxEditSizeFt}
            onChange={e => setCtxEditSizeFt(parseFloat(e.target.value) || 0)}
            onBlur={() => { if (ctxEditSizeFt > 0) onSetTokenSize(id, ctxEditSizeFt); }}
            onKeyDown={e => { if (e.key === 'Enter' && ctxEditSizeFt > 0) onSetTokenSize(id, ctxEditSizeFt); }}
            style={{ ...fieldStyle, width: 64 }}
          />
          <span style={{ color: C.dim, fontSize: FS.xs }}>ft de diàmetre</span>
        </div>
      </div>

      <ConditionPicker
        active={conditions[id] || []}
        onToggle={condId => onToggleCondition(id, condId)}
        onClear={() => {
          const nc = { ...rConditions.current }; delete nc[id];
          rConditions.current = nc; setConditions({ ...nc }); onBroadcast();
        }}
      />

      <div style={{ borderTop: `1px solid ${C.border}`, padding: '6px 8px', display: 'flex', flexDirection: 'column', gap: 5 }}>
        {contextMenu.existingGroupId && (
          <Button block variant="secondary" onMouseDown={e => { e.stopPropagation(); onLeaveGroup(contextMenu.id); onClose(); }}>
            🔓 Sortir del grup
          </Button>
        )}
        <Button block variant="tint" color={C.magicBright} onMouseDown={e => {
          e.stopPropagation();
          if (lib?.imageData) {
            const img = new Image(); img.src = lib.imageData;
            void onLaunchBossIntro({ tokenId: contextMenu.id, bossName: contextMenu.name, portrait: img, tokenPos: contextMenu.tokenPos ?? null });
            onClose(); return;
          }
          onOpenSceneConfig();
        }}>
          ⚡ Cinemàtica
        </Button>
        {lib && (
          <Button block variant="danger" onMouseDown={e => { e.stopPropagation(); removeLibEnemy(lib.id); onClose(); }}>
            🗑 Treure de l&apos;escena
          </Button>
        )}
      </div>
    </div>
  );
}
