'use client';
import React, { useEffect, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import { C, FS, RADIUS, tint } from '@/constants';
import { Button } from '@/components/ui/Button';
import { StepForward } from '@/components/icons';
import type { Player, LibEnemy, MapStructure, PsdEnemyOverrides, VisMap, TurnState, DefeatedMap, ConditionsMap } from '@/types';
import { movementLimit } from '@/lib/rules/conditions';
import { budgetFor } from '@/lib/turn';

interface Props {
  turn: TurnState;
  players: Player[];
  libEnemies: LibEnemy[];
  struct: MapStructure | null;
  psdEnemyOverrides: PsdEnemyOverrides;
  vis: VisMap;
  /** Tokens derrotats: el seu xip surt atenuat i amb la ✕ (ja no agafen torn). */
  defeated: DefeatedMap;
  /** Estats dels tokens: limiten el moviment (Agafat → 0 peus, Tombat → la meitat). */
  conditions: ConditionsMap;
  tokenGroupsRef: MutableRefObject<Map<number | string, string>>;
  onStart: (ids: (number | string)[]) => void;
  onEnd: () => void;
  onAdvance: () => void;
  onAdvanceRound: () => void;
  onRecoverTurn: (id: number | string) => void;
  onReorder: (newOrder: (number | string)[]) => void;
}

interface TokenInfo { name: string; color: string; img: string | null }

export function TurnTracker({
  turn, players, libEnemies, struct, psdEnemyOverrides, vis, defeated, conditions, tokenGroupsRef,
  onStart, onEnd, onAdvance, onAdvanceRound, onRecoverTurn, onReorder,
}: Props) {
  const [selecting, setSelecting] = useState(false);
  const [selEnemies, setSelEnemies] = useState<Set<string>>(new Set());
  const [selGroups, setSelGroups] = useState<Set<string>>(new Set());
  // Barra activa
  const [confirmEnd, setConfirmEnd] = useState(false);
  // «Ronda» salta tots els que queden de la ronda: demana confirmació perquè no es faci per error.
  const [confirmRound, setConfirmRound] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [menuFor, setMenuFor] = useState<number | string | null>(null);  // clic dret → recuperar torn
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  // Amb molts tokens a la cua els xips fan scroll: el del torn actiu sempre queda a la vista.
  const chipsRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const c = chipsRef.current;
    const el = c?.querySelector<HTMLElement>('[data-active="1"]');
    if (c && el) c.scrollTo({ left: el.offsetLeft - c.clientWidth / 2 + el.offsetWidth / 2, behavior: 'smooth' });
  }, [turn.turnIndex, turn.active]);

  // Resol un id de token a la seva info de presentació (nom, color, imatge opcional).
  const resolve = (id: number | string): TokenInfo => {
    const s = String(id);
    if (s.startsWith('pl_')) {
      const p = players.find(pl => `pl_${pl.id}` === s);
      return { name: p?.name ?? '?', color: p?.color ?? '#888', img: null };
    }
    if (s.startsWith('lib_')) {
      const e = libEnemies.find(en => `lib_${en.id}` === s);
      return { name: e?.name ?? '?', color: e?.color ?? '#b0424a', img: e?.imageData ?? null };
    }
    const en = struct?.enemyRooms.flatMap(r => r.enemies).find(e => e.id === Number(id));
    const ov = psdEnemyOverrides[Number(id)];
    return { name: ov?.name ?? en?.name ?? '?', color: '#b0424a', img: ov?.imageData ?? null };
  };

  const Avatar = ({ id, size }: { id: number | string; size: number }) => {
    const info = resolve(id);
    return (
      <div style={{
        width: size, height: size, borderRadius: '50%', flexShrink: 0,
        background: info.img ? `#000 center/cover url(${info.img})` : info.color,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#fff', fontSize: size * 0.4, fontWeight: 800, overflow: 'hidden',
        border: `1px solid rgba(255,255,255,0.25)`,
      }}>
        {!info.img && info.name.slice(0, 2).toUpperCase()}
      </div>
    );
  };

  // ── Popover de selecció (combat inactiu) ───────────────────────────────────
  const openSelect = () => { setSelEnemies(new Set()); setSelGroups(new Set()); setSelecting(true); };

  const psdEnemies = (struct?.enemyRooms.flatMap(r => r.enemies) ?? []).filter(en => vis[en.id]);
  const libVisible = libEnemies.filter(en => en.visible !== false);

  const groupMap = new Map<string, (number | string)[]>();
  tokenGroupsRef.current.forEach((gid, tid) => {
    const arr = groupMap.get(gid) ?? [];
    arr.push(tid);
    groupMap.set(gid, arr);
  });
  const groups = [...groupMap.entries()];

  const toggle = (set: Set<string>, setSet: (s: Set<string>) => void, key: string) => {
    const n = new Set(set);
    if (n.has(key)) n.delete(key); else n.add(key);
    setSet(n);
  };

  // «Tots / Cap»: selecciona (o treu) d'un cop tots els enemics visibles de la llista.
  const allEnemyKeys = [...psdEnemies.map(en => String(en.id)), ...libVisible.map(en => `lib_${en.id}`)];
  const allEnemiesSelected = allEnemyKeys.length > 0 && allEnemyKeys.every(k => selEnemies.has(k));
  const toggleAllEnemies = () => setSelEnemies(allEnemiesSelected ? new Set() : new Set(allEnemyKeys));

  const confirmStart = () => {
    const ids = new Set<number | string>();
    selGroups.forEach(gid => (groupMap.get(gid) ?? []).forEach(id => ids.add(id)));
    selEnemies.forEach(id => ids.add(id.startsWith('lib_') || id.startsWith('pl_') ? id : Number(id)));
    setSelecting(false);
    onStart([...ids]);
  };

  const wrap: React.CSSProperties = {
    position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)',
    // Sense envair la barra d'eines de l'esquerra (a sota quedaria inaccessible): si hi ha
    // molts tokens a la cua, els xips fan scroll en lloc d'eixamplar la barra.
    zIndex: 12, width: 'max-content', maxWidth: 'calc(100% - 150px)',
  };

  if (!turn.active) {
    return (
      <div style={wrap}>
        {selecting && (
          <div style={{
            position: 'absolute', bottom: 52, left: '50%', transform: 'translateX(-50%)',
            width: 360, maxHeight: 380, overflowY: 'auto',
            background: 'rgba(13,17,23,0.98)', border: `1px solid ${C.border}`, borderRadius: RADIUS.lg,
            boxShadow: '0 8px 32px rgba(0,0,0,0.7)', padding: 14,
          }}>
            <div style={{ color: C.bright, fontWeight: 700, fontSize: FS.lg, marginBottom: 4 }}>Iniciar combat per torns</div>
            <div style={{ color: C.dim, fontSize: FS.sm, marginBottom: 10 }}>
              Tots els jugadors s&apos;afegeixen automàticament. Tria quins enemics o grups incloure:
            </div>

            {groups.length > 0 && (
              <div style={{ marginBottom: 10 }}>
                <div style={{ color: C.dim, fontSize: FS.xs, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5 }}>Grups</div>
                {groups.map(([gid, ids], i) => (
                  <label key={gid} style={rowStyle(selGroups.has(gid))} onClick={() => toggle(selGroups, setSelGroups, gid)}>
                    <span style={{ display: 'flex', marginRight: 8 }}>
                      {ids.slice(0, 4).map(id => (
                        <span key={String(id)} style={{ marginLeft: -6 }}><Avatar id={id} size={24} /></span>
                      ))}
                    </span>
                    <span style={{ flex: 1, color: C.text, fontSize: FS.lg }}>Grup {i + 1}</span>
                    <span style={{ color: C.dim, fontSize: FS.sm }}>{ids.length} tokens</span>
                    {check(selGroups.has(gid))}
                  </label>
                ))}
              </div>
            )}

            {(psdEnemies.length > 0 || libVisible.length > 0) && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: 5 }}>
                  <span style={{ flex: 1, color: C.dim, fontSize: FS.xs, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Enemics</span>
                  <Button size="sm" variant="ghost" onClick={toggleAllEnemies} style={{ color: C.accent }}>
                    {allEnemiesSelected ? 'Cap' : 'Tots'}
                  </Button>
                </div>
                {psdEnemies.map(en => {
                  const key = String(en.id);
                  return (
                    <label key={key} style={rowStyle(selEnemies.has(key))} onClick={() => toggle(selEnemies, setSelEnemies, key)}>
                      <span style={{ marginRight: 8 }}><Avatar id={en.id} size={24} /></span>
                      <span style={{ flex: 1, color: C.text, fontSize: FS.lg }}>{psdEnemyOverrides[en.id]?.name ?? en.name}</span>
                      {check(selEnemies.has(key))}
                    </label>
                  );
                })}
                {libVisible.map(en => {
                  const key = `lib_${en.id}`;
                  return (
                    <label key={key} style={rowStyle(selEnemies.has(key))} onClick={() => toggle(selEnemies, setSelEnemies, key)}>
                      <span style={{ marginRight: 8 }}><Avatar id={key} size={24} /></span>
                      <span style={{ flex: 1, color: C.text, fontSize: FS.lg }}>{en.name}</span>
                      {check(selEnemies.has(key))}
                    </label>
                  );
                })}
              </div>
            )}

            {groups.length === 0 && psdEnemies.length === 0 && libVisible.length === 0 && (
              <div style={{ color: C.dim, fontSize: FS.sm, padding: '6px 0' }}>Cap enemic visible. Es començarà només amb els jugadors.</div>
            )}

            <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
              <Button style={{ flex: 1 }} onClick={() => setSelecting(false)}>Cancel·lar</Button>
              <Button variant="primary" style={{ flex: 2 }} onClick={confirmStart}>Començar combat</Button>
            </div>
          </div>
        )}
        <button
          onClick={() => (selecting ? setSelecting(false) : openSelect())}
          title="Iniciar sistema per torns"
          style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '11px 18px', borderRadius: 22,
            border: `1px solid ${selecting ? C.accent : C.border}`,
            background: selecting ? `${C.accent}22` : 'rgba(13,17,23,0.95)',
            color: selecting ? C.accent : C.text, cursor: 'pointer', fontWeight: 700, fontSize: FS.lg,
            boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
          }}>
          ⚔️ Iniciar torns
        </button>
      </div>
    );
  }

  // ── Barra de torns (combat actiu) ──────────────────────────────────────────
  const moveInOrder = (from: number, to: number) => {
    if (from === to) return;
    const no = [...turn.order];
    const [moved] = no.splice(from, 1);
    no.splice(to, 0, moved);
    onReorder(no);
  };

  return (
    <div style={wrap}>
      {/* Backdrop per tancar menús/confirmacions amb un clic fora */}
      {(menuFor !== null || confirmEnd || confirmRound) && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1 }} onClick={() => { setMenuFor(null); setConfirmEnd(false); setConfirmRound(false); }} />
      )}
      {/* Menú "recuperar torn": fora del contenidor de chips (que té overflow i el retallaria) */}
      {menuFor !== null && (
        <div style={{
          position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)', marginBottom: 10, zIndex: 3,
          background: 'rgba(13,17,23,0.99)', border: `1px solid ${C.border}`, borderRadius: RADIUS.lg,
          boxShadow: '0 6px 20px rgba(0,0,0,0.7)', padding: 4, whiteSpace: 'nowrap',
        }}>
          <button
            onClick={() => { onRecoverTurn(menuFor); setMenuFor(null); }}
            style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 14px', borderRadius: RADIUS.md, border: 'none', background: 'transparent', color: C.text, cursor: 'pointer', fontSize: FS.md, fontWeight: 600 }}
            onMouseEnter={(e) => (e.currentTarget.style.background = `${C.accent}22`)}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
            ↩ Recuperar el torn de {resolve(menuFor).name}
          </button>
        </div>
      )}
      <div style={{
        position: 'relative', zIndex: 2,
        display: 'flex', alignItems: 'center', gap: 10,
        background: 'rgba(13,17,23,0.97)', border: `1px solid ${editMode ? C.accent : C.border}`, borderRadius: 16,
        padding: '10px 12px', boxShadow: '0 8px 28px rgba(0,0,0,0.65)',
      }}>
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: '4px 14px', borderRadius: RADIUS.lg, background: `${C.accent}18`, border: `1px solid ${C.accent}55`, flexShrink: 0,
        }}>
          <span style={{ color: C.dim, fontSize: FS.xs, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Ronda</span>
          <span style={{ color: C.accent, fontSize: 24, fontWeight: 800, lineHeight: 1 }}>{turn.round}</span>
        </div>

        {/* Botó configuració/edició d'ordre (com el dels jugadors) */}
        <button onClick={() => { setEditMode(v => !v); setMenuFor(null); }}
          title={editMode ? 'Sortir del mode edició' : 'Editar ordre (arrossega els tokens)'}
          style={{
            flexShrink: 0, width: 38, height: 38, borderRadius: RADIUS.lg, cursor: 'pointer',
            border: `1px solid ${editMode ? C.accent : C.border}`,
            background: editMode ? `${C.accent}22` : 'transparent',
            color: editMode ? C.accent : C.dim, fontSize: 17, lineHeight: 1,
          }}>
          ⚙
        </button>

        <div ref={chipsRef} style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 8, overflowX: 'auto', flex: '0 1 auto', minWidth: 0, padding: '2px 0' }}>
          {turn.order.map((id, i) => {
            /* Peus efectius del token actiu: el saldo del torn retallat pels seus estats
               (mateix `movementLimit` que fa servir el clamp del jugador i la validació). */
            const info = resolve(id);
            const isActive = i === turn.turnIndex;
            const isPlayer = String(id).startsWith('pl_');
            const isDefeated = !!defeated[String(id)];
            const activeTotalFt = isActive ? budgetFor(id, players) : 0;
            const activeLimit = isActive
              ? movementLimit(turn.activeRemainingFt, conditions[String(id)])
              : { ft: 0, reason: null, immobile: false };
            return (
              <div
                key={String(id)}
                data-active={isActive ? '1' : undefined}
                draggable={editMode}
                onDragStart={editMode ? () => setDragIdx(i) : undefined}
                onDragOver={editMode ? (e) => e.preventDefault() : undefined}
                onDrop={editMode ? () => { if (dragIdx !== null) moveInOrder(dragIdx, i); setDragIdx(null); } : undefined}
                onClick={!editMode && isActive ? onAdvance : undefined}
                onContextMenu={(e) => { e.preventDefault(); if (!isActive) setMenuFor(id); }}
                title={editMode ? 'Arrossega per reordenar' : isDefeated ? `${info.name} · derrotat, se li salta el torn` : isActive ? 'Clica per passar el torn · clic dret per recuperar un torn anterior' : `${info.name} · clic dret per recuperar el seu torn`}
                style={{
                  position: 'relative',
                  display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0,
                  padding: isActive ? '5px 12px 5px 6px' : '5px 7px',
                  borderRadius: 22,
                  cursor: editMode ? 'grab' : isActive ? 'pointer' : 'default',
                  border: isActive ? `2px solid ${C.accent}` : editMode ? `1px dashed ${C.dim}66` : '2px solid transparent',
                  background: isActive ? `${C.accent}22` : dragIdx === i ? `${C.accent}18` : 'transparent',
                  boxShadow: isActive ? `0 0 16px ${C.accent}66` : 'none',
                  opacity: isDefeated ? 0.34 : isActive ? 1 : 0.75,
                  filter: isDefeated ? 'grayscale(1)' : 'none',
                }}>
                <Avatar id={id} size={isActive ? 42 : 34} />
                {isDefeated && (
                  <span aria-hidden style={{
                    position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: C.enemy, fontSize: isActive ? 30 : 24, fontWeight: 900, lineHeight: 1, pointerEvents: 'none',
                  }}>✕</span>
                )}
                {isActive && (
                  <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2, textAlign: 'left', minWidth: isPlayer ? 104 : undefined }}>
                    <span style={{ color: C.bright, fontSize: FS.lg, fontWeight: 700, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{info.name}</span>
                    {isPlayer && (activeLimit.immobile ? (
                      // Un estat li impedeix moure's: val més dir-ho que ensenyar peus que no pot gastar.
                      <span style={{ color: C.enemy, fontSize: FS.md, fontWeight: 800 }} title={`${activeLimit.reason}: no es pot moure`}>
                        ✋ {activeLimit.reason}
                      </span>
                    ) : (
                      <>
                        <span style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                          <span style={{ color: activeLimit.ft >= 5 ? C.accent : C.enemy, fontSize: 22, fontWeight: 800, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
                            {activeLimit.ft}
                          </span>
                          <span style={{ color: C.dim, fontSize: FS.sm, fontWeight: 700 }}>/ {activeTotalFt} ft</span>
                        </span>
                        <span style={{ display: 'block', marginTop: 3, height: 4, width: '100%', borderRadius: RADIUS.sm, background: 'rgba(255,255,255,0.14)', overflow: 'hidden' }}>
                          <span style={{
                            display: 'block', height: '100%', borderRadius: RADIUS.sm,
                            width: `${Math.max(0, Math.min(1, activeTotalFt > 0 ? activeLimit.ft / activeTotalFt : 0)) * 100}%`,
                            background: activeLimit.ft >= 5 ? C.accent : C.enemy, transition: 'width 0.3s ease',
                          }} />
                        </span>
                      </>
                    ))}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {editMode ? (
          <span style={{ flexShrink: 0, color: C.dim, fontSize: FS.xs, maxWidth: 92, lineHeight: 1.25 }}>Arrossega per reordenar</span>
        ) : (
          <>
            {/* Passar torn és l'acció més freqüent del combat: botó principal i gran, amb
                drecera (Enter). Abans només es podia fer clicant el xip actiu, i el botó
                destacat era «Ronda», que salta tots els que queden. */}
            <Button variant="primary" size="lg" onClick={onAdvance} title="Passar el torn al següent (Enter)"
              style={{ flexShrink: 0, gap: 6 }}>
              Següent <StepForward size={13} />
            </Button>
            {confirmRound ? (
              <div style={{ position: 'relative', zIndex: 2, display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                <span style={{ color: C.dim, fontSize: FS.sm, lineHeight: 1.2, maxWidth: 110 }}>Saltar a la ronda {turn.round + 1}?</span>
                <Button variant="primary" onClick={() => { setConfirmRound(false); onAdvanceRound(); }}>Sí</Button>
                <Button onClick={() => setConfirmRound(false)}>No</Button>
              </div>
            ) : (
              <Button variant="secondary" onClick={() => setConfirmRound(true)}
                title="Acabar la ronda ara: salta tots els que queden i comença la següent (tots recuperen moviment)"
                style={{ flexShrink: 0 }}>
                ⏭ Ronda
              </Button>
            )}
          </>
        )}

        {/* Acabar combat amb confirmació */}
        {confirmEnd ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
            <span style={{ color: C.dim, fontSize: FS.sm }}>Finalitzar?</span>
            <Button onClick={() => { setConfirmEnd(false); setEditMode(false); onEnd(); }}
              style={{ background: C.enemy, borderColor: C.enemy, color: '#fff' }}>Sí</Button>
            <Button onClick={() => setConfirmEnd(false)}>No</Button>
          </div>
        ) : (
          <button onClick={() => setConfirmEnd(true)} title="Acabar combat"
            style={{
              flexShrink: 0, width: 36, height: 36, borderRadius: RADIUS.lg, border: `1px solid ${C.border}`,
              background: 'transparent', color: C.dim, cursor: 'pointer', fontSize: 15, lineHeight: 1,
            }}>
            ✕
          </button>
        )}
      </div>
    </div>
  );
}

const rowStyle = (sel: boolean): React.CSSProperties => ({
  display: 'flex', alignItems: 'center', padding: '5px 6px', borderRadius: RADIUS.md, cursor: 'pointer',
  background: sel ? tint(C.accent, 0.14) : 'transparent', marginBottom: 2,
});

const check = (sel: boolean) => (
  <span style={{
    width: 16, height: 16, marginLeft: 6, borderRadius: RADIUS.sm, flexShrink: 0,
    border: `1px solid ${sel ? C.accent : '#3a4048'}`, background: sel ? C.accent : 'transparent',
    color: C.onAccent, fontSize: FS.sm, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center',
  }}>{sel ? '✓' : ''}</span>
);
