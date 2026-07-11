'use client';
import React, { useState } from 'react';
import type { MutableRefObject } from 'react';
import { C } from '@/constants';
import type { Player, LibEnemy, MapStructure, PsdEnemyOverrides, VisMap, TurnState } from '@/types';

interface Props {
  turn: TurnState;
  players: Player[];
  libEnemies: LibEnemy[];
  struct: MapStructure | null;
  psdEnemyOverrides: PsdEnemyOverrides;
  vis: VisMap;
  tokenGroupsRef: MutableRefObject<Map<number | string, string>>;
  onStart: (ids: (number | string)[]) => void;
  onEnd: () => void;
  onAdvance: () => void;
  onAdvanceRound: () => void;
}

interface TokenInfo { name: string; color: string; img: string | null }

export function TurnTracker({
  turn, players, libEnemies, struct, psdEnemyOverrides, vis, tokenGroupsRef,
  onStart, onEnd, onAdvance, onAdvanceRound,
}: Props) {
  const [selecting, setSelecting] = useState(false);
  const [selEnemies, setSelEnemies] = useState<Set<string>>(new Set());
  const [selGroups, setSelGroups] = useState<Set<string>>(new Set());

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
  const openSelect = () => {
    setSelEnemies(new Set());
    setSelGroups(new Set());
    setSelecting(true);
  };

  const psdEnemies = (struct?.enemyRooms.flatMap(r => r.enemies) ?? []).filter(en => vis[en.id]);
  const libVisible = libEnemies.filter(en => en.visible !== false);

  // Grups existents (rTokenGroups és efímer, es llegeix en obrir): groupId -> [ids]
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

  const confirmStart = () => {
    const ids = new Set<number | string>();
    selGroups.forEach(gid => (groupMap.get(gid) ?? []).forEach(id => ids.add(id)));
    selEnemies.forEach(id => ids.add(id.startsWith('lib_') || id.startsWith('pl_') ? id : Number(id)));
    setSelecting(false);
    onStart([...ids]);
  };

  const wrap: React.CSSProperties = {
    position: 'absolute', bottom: 14, left: '50%', transform: 'translateX(-50%)',
    zIndex: 12, maxWidth: '94%',
  };

  if (!turn.active) {
    return (
      <div style={wrap}>
        {selecting && (
          <div style={{
            position: 'absolute', bottom: 46, left: '50%', transform: 'translateX(-50%)',
            width: 340, maxHeight: 360, overflowY: 'auto',
            background: 'rgba(13,17,23,0.98)', border: `1px solid ${C.border}`, borderRadius: 10,
            boxShadow: '0 8px 32px rgba(0,0,0,0.7)', padding: 12,
          }}>
            <div style={{ color: C.bright, fontWeight: 700, fontSize: 12, marginBottom: 4 }}>Iniciar combat per torns</div>
            <div style={{ color: C.dim, fontSize: 10, marginBottom: 10 }}>
              Tots els jugadors s&apos;afegeixen automàticament. Tria quins enemics o grups incloure:
            </div>

            {groups.length > 0 && (
              <div style={{ marginBottom: 10 }}>
                <div style={{ color: C.dim, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5 }}>Grups</div>
                {groups.map(([gid, ids], i) => (
                  <label key={gid} style={rowStyle(selGroups.has(gid))} onClick={() => toggle(selGroups, setSelGroups, gid)}>
                    <span style={{ display: 'flex', marginRight: 8 }}>
                      {ids.slice(0, 4).map(id => (
                        <span key={String(id)} style={{ marginLeft: -6 }}><Avatar id={id} size={22} /></span>
                      ))}
                    </span>
                    <span style={{ flex: 1, color: C.text, fontSize: 12 }}>Grup {i + 1}</span>
                    <span style={{ color: C.dim, fontSize: 10 }}>{ids.length} tokens</span>
                    {check(selGroups.has(gid))}
                  </label>
                ))}
              </div>
            )}

            {(psdEnemies.length > 0 || libVisible.length > 0) && (
              <div>
                <div style={{ color: C.dim, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5 }}>Enemics</div>
                {psdEnemies.map(en => {
                  const key = String(en.id);
                  return (
                    <label key={key} style={rowStyle(selEnemies.has(key))} onClick={() => toggle(selEnemies, setSelEnemies, key)}>
                      <span style={{ marginRight: 8 }}><Avatar id={en.id} size={22} /></span>
                      <span style={{ flex: 1, color: C.text, fontSize: 12 }}>{psdEnemyOverrides[en.id]?.name ?? en.name}</span>
                      {check(selEnemies.has(key))}
                    </label>
                  );
                })}
                {libVisible.map(en => {
                  const key = `lib_${en.id}`;
                  return (
                    <label key={key} style={rowStyle(selEnemies.has(key))} onClick={() => toggle(selEnemies, setSelEnemies, key)}>
                      <span style={{ marginRight: 8 }}><Avatar id={key} size={22} /></span>
                      <span style={{ flex: 1, color: C.text, fontSize: 12 }}>{en.name}</span>
                      {check(selEnemies.has(key))}
                    </label>
                  );
                })}
              </div>
            )}

            {groups.length === 0 && psdEnemies.length === 0 && libVisible.length === 0 && (
              <div style={{ color: C.dim, fontSize: 11, padding: '6px 0' }}>Cap enemic visible. Es començarà només amb els jugadors.</div>
            )}

            <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
              <button onClick={() => setSelecting(false)} style={btnGhost}>Cancel·lar</button>
              <button onClick={confirmStart} style={btnPrimary}>Començar combat</button>
            </div>
          </div>
        )}
        <button
          onClick={() => (selecting ? setSelecting(false) : openSelect())}
          title="Iniciar sistema per torns"
          style={{
            display: 'flex', alignItems: 'center', gap: 7, padding: '8px 14px', borderRadius: 20,
            border: `1px solid ${selecting ? C.accent : C.border}`,
            background: selecting ? `${C.accent}22` : 'rgba(13,17,23,0.95)',
            color: selecting ? C.accent : C.text, cursor: 'pointer', fontWeight: 700, fontSize: 12,
            boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
          }}>
          ⚔️ Iniciar torns
        </button>
      </div>
    );
  }

  // ── Barra de torns (combat actiu) ──────────────────────────────────────────
  return (
    <div style={wrap}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        background: 'rgba(13,17,23,0.96)', border: `1px solid ${C.border}`, borderRadius: 14,
        padding: '7px 9px', boxShadow: '0 6px 24px rgba(0,0,0,0.6)',
      }}>
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: '2px 10px', borderRadius: 8, background: `${C.accent}18`, border: `1px solid ${C.accent}55`, flexShrink: 0,
        }}>
          <span style={{ color: C.dim, fontSize: 8, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Ronda</span>
          <span style={{ color: C.accent, fontSize: 18, fontWeight: 800, lineHeight: 1 }}>{turn.round}</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflowX: 'auto', maxWidth: '58vw', padding: '2px 0' }}>
          {turn.order.map((id, i) => {
            const info = resolve(id);
            const isActive = i === turn.turnIndex;
            const isPlayer = String(id).startsWith('pl_');
            return (
              <button
                key={String(id)}
                onClick={isActive ? onAdvance : undefined}
                title={isActive ? 'Clica per passar el torn' : info.name}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
                  padding: isActive ? '4px 10px 4px 5px' : '4px 6px',
                  borderRadius: 20, cursor: isActive ? 'pointer' : 'default',
                  border: isActive ? `2px solid ${C.accent}` : '2px solid transparent',
                  background: isActive ? `${C.accent}22` : 'transparent',
                  boxShadow: isActive ? `0 0 14px ${C.accent}66` : 'none',
                  opacity: isActive ? 1 : 0.72,
                }}>
                <Avatar id={id} size={isActive ? 34 : 28} />
                {isActive && (
                  <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15, textAlign: 'left' }}>
                    <span style={{ color: C.bright, fontSize: 12, fontWeight: 700, maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{info.name}</span>
                    {isPlayer && (
                      <span style={{ color: turn.activeRemainingFt >= 5 ? C.accent : C.enemy, fontSize: 10, fontWeight: 700 }}>
                        {turn.activeRemainingFt} ft
                      </span>
                    )}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <button onClick={onAdvanceRound} title="Passar de ronda (tots recuperen moviment)"
          style={{
            display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0, padding: '7px 11px', borderRadius: 9,
            border: `1px solid ${C.accent}`, background: `${C.accent}18`, color: C.accent, cursor: 'pointer', fontWeight: 700, fontSize: 11,
          }}>
          ⏭ Ronda
        </button>
        <button onClick={onEnd} title="Acabar combat"
          style={{
            flexShrink: 0, padding: '7px 9px', borderRadius: 9, border: `1px solid ${C.border}`,
            background: 'transparent', color: C.dim, cursor: 'pointer', fontSize: 14, lineHeight: 1,
          }}>
          ✕
        </button>
      </div>
    </div>
  );
}

const rowStyle = (sel: boolean): React.CSSProperties => ({
  display: 'flex', alignItems: 'center', padding: '5px 6px', borderRadius: 7, cursor: 'pointer',
  background: sel ? 'rgba(212,160,23,0.14)' : 'transparent', marginBottom: 2,
});

const check = (sel: boolean) => (
  <span style={{
    width: 16, height: 16, marginLeft: 6, borderRadius: 4, flexShrink: 0,
    border: `1px solid ${sel ? '#d4a017' : '#3a4048'}`, background: sel ? '#d4a017' : 'transparent',
    color: '#0d1117', fontSize: 11, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center',
  }}>{sel ? '✓' : ''}</span>
);

const btnGhost: React.CSSProperties = {
  flex: 1, padding: '7px', borderRadius: 6, border: '1px solid #21262d',
  background: 'transparent', color: '#8b949e', cursor: 'pointer', fontSize: 11, fontWeight: 600,
};
const btnPrimary: React.CSSProperties = {
  flex: 2, padding: '7px', borderRadius: 6, border: 'none',
  background: '#d4a017', color: '#0d1117', cursor: 'pointer', fontSize: 11, fontWeight: 700,
};
