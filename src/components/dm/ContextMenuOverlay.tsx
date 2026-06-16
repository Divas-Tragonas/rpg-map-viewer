'use client';
import React, { useEffect } from 'react';
import { X } from '@/components/icons';
import { CONDITIONS } from '@/constants';
import { C } from '@/constants';
import type { ContextMenuState, ConditionsMap, DefeatedMap, LibEnemy, PsdEnemyOverrides } from '@/types';

interface Props {
  contextMenu: ContextMenuState | null;
  conditions: ConditionsMap;
  defeated: DefeatedMap;
  rDefeated: React.MutableRefObject<DefeatedMap>;
  defeatedAnimRef: React.MutableRefObject<Record<string, number>>;
  rConditions: React.MutableRefObject<ConditionsMap>;
  rLibEnemies: React.MutableRefObject<LibEnemy[]>;
  rPsdEnemyOverrides: React.MutableRefObject<PsdEnemyOverrides>;
  rPlayers: React.MutableRefObject<import('@/types').Player[]>;
  ctxEditName: string;
  setCtxEditName: (v: string) => void;
  ctxEditHpMax: number;
  setCtxEditHpMax: (v: number) => void;
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
  bcRef: React.MutableRefObject<BroadcastChannel | null>;
  wsRef: React.MutableRefObject<import('@/lib/ws').SyncSocket | null>;
  onTriggerBossIntro: (data: Record<string, unknown>) => void;
}

export function ContextMenuOverlay({
  contextMenu, conditions, defeated, rDefeated, defeatedAnimRef, rConditions,
  rLibEnemies, rPsdEnemyOverrides, rPlayers,
  ctxEditName, setCtxEditName, ctxEditHpMax, setCtxEditHpMax,
  onClose, onToggleCondition, onDeletePaintedZone, onDeleteAreaSpell, onOpenSceneConfig, onBroadcast,
  setDefeated, setConditions,
  adjustLibEnemyHp, adjustPsdEnemyHp, adjustPlayerHp,
  setPsdEnemyProps, setLibEnemyProps, removeLibEnemy,
  bcRef, wsRef, onTriggerBossIntro,
}: Props) {
  useEffect(() => {
    if (!contextMenu) return;
    const close = (e: MouseEvent) => { if (!(e.target as Element).closest?.('[data-ctxmenu]')) onClose(); };
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, [contextMenu, onClose]);

  if (!contextMenu) return null;
  const id = String(contextMenu.id);

  return (
    <div data-ctxmenu="1" style={{ position: 'fixed', left: Math.min(contextMenu.x, window.innerWidth - 230), top: Math.min(contextMenu.y, window.innerHeight - 500), background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, zIndex: 9999, boxShadow: '0 8px 32px rgba(0,0,0,0.65)', minWidth: 220, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '8px 12px 6px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ color: C.bright, fontWeight: 700, fontSize: 12 }}>{contextMenu.name}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {!contextMenu.isPaintedZone && !contextMenu.isAreaSpell && (
            <button
              onMouseDown={e => {
                e.stopPropagation();
                const nd = { ...rDefeated.current };
                if (nd[id]) delete nd[id]; else { nd[id] = true; defeatedAnimRef.current[id] = 0; }
                if (!nd[id]) delete defeatedAnimRef.current[id];
                rDefeated.current = nd; setDefeated({ ...nd }); onBroadcast();
              }}
              style={{ background: defeated[id] ? `${C.enemy}40` : `${C.enemy}14`, border: `1px solid ${defeated[id] ? C.enemy : `${C.enemy}4d`}`, borderRadius: 4, padding: '2px 7px', cursor: 'pointer', color: C.enemy, fontSize: 10, fontWeight: 700 }}>
              {defeated[id] ? '✕ Derrotado' : '✕'}
            </button>
          )}
          <span style={{ color: C.dim, fontSize: 10 }}>{contextMenu.isPaintedZone ? 'Zona mágica' : contextMenu.isAreaSpell ? 'Spell d\'àrea' : 'Estados'}</span>
        </div>
      </div>

      {/* Name edit for PSD enemies and lib enemies */}
      {!contextMenu.isPaintedZone && (typeof contextMenu.id === 'number' || contextMenu.isLibEnemy) && (
        <div style={{ padding: '6px 8px', borderBottom: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 9, color: C.dim, marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Nom</div>
          <input
            value={ctxEditName}
            onChange={e => setCtxEditName(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                if (typeof contextMenu.id === 'number') setPsdEnemyProps(contextMenu.id, { name: ctxEditName });
                else if (contextMenu.isLibEnemy && contextMenu.libEnemyId !== undefined) setLibEnemyProps(contextMenu.libEnemyId, { name: ctxEditName });
              }
            }}
            onBlur={() => {
              if (typeof contextMenu.id === 'number') setPsdEnemyProps(contextMenu.id, { name: ctxEditName });
              else if (contextMenu.isLibEnemy && contextMenu.libEnemyId !== undefined) setLibEnemyProps(contextMenu.libEnemyId, { name: ctxEditName });
            }}
            style={{ width: '100%', boxSizing: 'border-box', background: '#0d1117', border: `1px solid ${C.border}`, borderRadius: 4, padding: '3px 6px', color: C.text, fontSize: 11, outline: 'none' }}
          />
          {typeof contextMenu.id === 'number' && !((rPsdEnemyOverrides.current[contextMenu.id] || {}).hpMax ?? 0 > 0) && (
            <>
              <div style={{ fontSize: 9, color: C.dim, marginTop: 5, marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.08em' }}>HP màxims (0 = cap)</div>
              <input
                type="number" min={0} max={9999} value={ctxEditHpMax}
                onChange={e => setCtxEditHpMax(parseInt(e.target.value) || 0)}
                onBlur={() => { if (ctxEditHpMax > 0) setPsdEnemyProps(contextMenu.id as number, { hpMax: ctxEditHpMax, hp: ctxEditHpMax }); }}
                onKeyDown={e => { if (e.key === 'Enter' && ctxEditHpMax > 0) setPsdEnemyProps(contextMenu.id as number, { hpMax: ctxEditHpMax, hp: ctxEditHpMax }); }}
                style={{ width: '100%', boxSizing: 'border-box', background: '#0d1117', border: `1px solid ${C.border}`, borderRadius: 4, padding: '3px 6px', color: C.text, fontSize: 11, outline: 'none' }}
              />
            </>
          )}
        </div>
      )}

      {(contextMenu.isPaintedZone || contextMenu.isAreaSpell) ? (
        <div style={{ padding: 8 }}>
          <button onMouseDown={e => { e.stopPropagation(); contextMenu.isPaintedZone ? onDeletePaintedZone(id as string) : onDeleteAreaSpell(id as string); onClose(); }}
            style={{ width: '100%', padding: '7px', background: 'rgba(248,81,73,.12)', border: '1px solid rgba(248,81,73,.3)', borderRadius: 6, color: '#f85149', cursor: 'pointer', fontSize: 12 }}>
            🗑 Eliminar {contextMenu.isPaintedZone ? 'zona' : 'spell'}
          </button>
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, padding: 6, maxHeight: 280, overflowY: 'auto' }}>
            {CONDITIONS.map(cond => {
              const active = (conditions[id] || []).includes(cond.id);
              return (
                <button key={cond.id}
                  onMouseDown={e => { e.stopPropagation(); onToggleCondition(id, cond.id); }}
                  style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '6px 8px', border: active ? `1px solid ${cond.bg}66` : '1px solid transparent', borderRadius: 6, cursor: 'pointer', background: active ? `${cond.bg}22` : 'transparent', color: active ? '#e6edf3' : C.dim, fontSize: 11, textAlign: 'left' }}>
                  <div style={{ width: 13, height: 13, borderRadius: '50%', background: cond.bg, flexShrink: 0, opacity: active ? 1 : 0.5 }} />
                  {cond.label}
                  {active && <span style={{ marginLeft: 'auto', color: cond.bg, fontSize: 9 }}>●</span>}
                </button>
              );
            })}
          </div>
          {(conditions[id] || []).length > 0 && (
            <div style={{ borderTop: `1px solid ${C.border}`, padding: '4px 6px' }}>
              <button onMouseDown={e => {
                e.stopPropagation();
                const nc = { ...rConditions.current }; delete nc[id];
                rConditions.current = nc; setConditions({ ...nc }); onBroadcast();
              }} style={{ width: '100%', padding: '5px', background: 'rgba(248,81,73,.12)', border: '1px solid rgba(248,81,73,.3)', borderRadius: 5, color: '#f85149', cursor: 'pointer', fontSize: 11 }}>
                Limpiar estados
              </button>
            </div>
          )}

          {/* Lib enemy HP controls */}
          {contextMenu.isLibEnemy && (() => {
            const _le = rLibEnemies.current.find(e => e.id === contextMenu.libEnemyId);
            if (!_le) return null;
            const _lhp = _le.hp ?? _le.hpMax;
            const _lhr = _le.hpMax > 0 ? Math.max(0, _lhp / _le.hpMax) : 0;
            const _lhc = _lhr > 0.5 ? C.hpHigh : _lhr > 0.25 ? C.hpMid : C.enemy;
            return (
              <div style={{ borderTop: `1px solid ${C.border}`, padding: '6px 8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginBottom: 5 }}>
                  <button onMouseDown={e => { e.stopPropagation(); adjustLibEnemyHp(_le.id, -10); }} style={{ flex: 1, padding: '3px 0', background: 'rgba(248,81,73,.12)', border: '1px solid rgba(248,81,73,.3)', borderRadius: 4, cursor: 'pointer', color: '#f85149', fontSize: 10, fontWeight: 700 }}>-10</button>
                  <button onMouseDown={e => { e.stopPropagation(); adjustLibEnemyHp(_le.id, -1); }} style={{ flex: 1, padding: '3px 0', background: 'rgba(248,81,73,.12)', border: '1px solid rgba(248,81,73,.3)', borderRadius: 4, cursor: 'pointer', color: '#f85149', fontSize: 10, fontWeight: 700 }}>-1</button>
                  <div style={{ flex: 2, background: 'rgba(0,0,0,.5)', borderRadius: 4, height: 20, position: 'relative', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${_lhr * 100}%`, background: _lhc }} />
                    <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#fff', fontWeight: 700 }}>{_lhp}/{_le.hpMax}</span>
                  </div>
                  <button onMouseDown={e => { e.stopPropagation(); adjustLibEnemyHp(_le.id, 1); }} style={{ flex: 1, padding: '3px 0', background: 'rgba(63,185,80,.12)', border: '1px solid rgba(63,185,80,.3)', borderRadius: 4, cursor: 'pointer', color: '#3fb950', fontSize: 10, fontWeight: 700 }}>+1</button>
                  <button onMouseDown={e => { e.stopPropagation(); adjustLibEnemyHp(_le.id, 10); }} style={{ flex: 1, padding: '3px 0', background: 'rgba(63,185,80,.12)', border: '1px solid rgba(63,185,80,.3)', borderRadius: 4, cursor: 'pointer', color: '#3fb950', fontSize: 10, fontWeight: 700 }}>+10</button>
                </div>
                <button onMouseDown={e => { e.stopPropagation(); removeLibEnemy(_le.id); onClose(); }}
                  style={{ width: '100%', padding: '5px', background: 'rgba(248,81,73,.12)', border: '1px solid rgba(248,81,73,.3)', borderRadius: 5, color: '#f85149', cursor: 'pointer', fontSize: 11 }}>
                  🗑 Eliminar de l&apos;escena
                </button>
              </div>
            );
          })()}

          {/* PSD enemy HP controls */}
          {typeof contextMenu.id === 'number' && (() => {
            const _pov = rPsdEnemyOverrides.current[contextMenu.id] || {};
            const _hm = _pov.hpMax || 0;
            if (_hm <= 0) return null;
            const _hp = Math.max(0, _pov.hp ?? _hm);
            const _hr = _hm > 0 ? _hp / _hm : 0;
            const _hc = _hr > 0.5 ? C.hpHigh : _hr > 0.25 ? C.hpMid : C.enemy;
            return (
              <div style={{ borderTop: `1px solid ${C.border}`, padding: '6px 8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                  <button onMouseDown={e => { e.stopPropagation(); adjustPsdEnemyHp(contextMenu.id as number, -10); }} style={{ flex: 1, padding: '3px 0', background: 'rgba(248,81,73,.12)', border: '1px solid rgba(248,81,73,.3)', borderRadius: 4, cursor: 'pointer', color: '#f85149', fontSize: 10, fontWeight: 700 }}>-10</button>
                  <button onMouseDown={e => { e.stopPropagation(); adjustPsdEnemyHp(contextMenu.id as number, -1); }} style={{ flex: 1, padding: '3px 0', background: 'rgba(248,81,73,.12)', border: '1px solid rgba(248,81,73,.3)', borderRadius: 4, cursor: 'pointer', color: '#f85149', fontSize: 10, fontWeight: 700 }}>-1</button>
                  <div style={{ flex: 2, background: 'rgba(0,0,0,.5)', borderRadius: 4, height: 20, position: 'relative', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${_hr * 100}%`, background: _hc }} />
                    <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#fff', fontWeight: 700 }}>{_hp}/{_hm}</span>
                  </div>
                  <button onMouseDown={e => { e.stopPropagation(); adjustPsdEnemyHp(contextMenu.id as number, 1); }} style={{ flex: 1, padding: '3px 0', background: 'rgba(63,185,80,.12)', border: '1px solid rgba(63,185,80,.3)', borderRadius: 4, cursor: 'pointer', color: '#3fb950', fontSize: 10, fontWeight: 700 }}>+1</button>
                  <button onMouseDown={e => { e.stopPropagation(); adjustPsdEnemyHp(contextMenu.id as number, 10); }} style={{ flex: 1, padding: '3px 0', background: 'rgba(63,185,80,.12)', border: '1px solid rgba(63,185,80,.3)', borderRadius: 4, cursor: 'pointer', color: '#3fb950', fontSize: 10, fontWeight: 700 }}>+10</button>
                </div>
              </div>
            );
          })()}

          {/* Player HP controls */}
          {typeof contextMenu.id === 'string' && contextMenu.id.startsWith('pl_') && (() => {
            const plIdNum = parseInt(contextMenu.id.replace('pl_', ''));
            const _pl = rPlayers.current.find(p => p.id === plIdNum);
            if (!_pl || !_pl.hpMax) return null;
            const _php = _pl.hp ?? _pl.hpMax;
            const _phr = _pl.hpMax > 0 ? Math.max(0, _php / _pl.hpMax) : 0;
            const _phc = _phr > 0.5 ? C.hpHigh : _phr > 0.25 ? C.hpMid : C.enemy;
            return (
              <div style={{ borderTop: `1px solid ${C.border}`, padding: '6px 8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                  <button onMouseDown={e => { e.stopPropagation(); adjustPlayerHp(_pl.id, -10); }} style={{ flex: 1, padding: '3px 0', background: 'rgba(248,81,73,.12)', border: '1px solid rgba(248,81,73,.3)', borderRadius: 4, cursor: 'pointer', color: '#f85149', fontSize: 10, fontWeight: 700 }}>-10</button>
                  <button onMouseDown={e => { e.stopPropagation(); adjustPlayerHp(_pl.id, -1); }} style={{ flex: 1, padding: '3px 0', background: 'rgba(248,81,73,.12)', border: '1px solid rgba(248,81,73,.3)', borderRadius: 4, cursor: 'pointer', color: '#f85149', fontSize: 10, fontWeight: 700 }}>-1</button>
                  <div style={{ flex: 2, background: 'rgba(0,0,0,.5)', borderRadius: 4, height: 20, position: 'relative', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${_phr * 100}%`, background: _phc }} />
                    <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#fff', fontWeight: 700 }}>{_php}/{_pl.hpMax}</span>
                  </div>
                  <button onMouseDown={e => { e.stopPropagation(); adjustPlayerHp(_pl.id, 1); }} style={{ flex: 1, padding: '3px 0', background: 'rgba(63,185,80,.12)', border: '1px solid rgba(63,185,80,.3)', borderRadius: 4, cursor: 'pointer', color: '#3fb950', fontSize: 10, fontWeight: 700 }}>+1</button>
                  <button onMouseDown={e => { e.stopPropagation(); adjustPlayerHp(_pl.id, 10); }} style={{ flex: 1, padding: '3px 0', background: 'rgba(63,185,80,.12)', border: '1px solid rgba(63,185,80,.3)', borderRadius: 4, cursor: 'pointer', color: '#3fb950', fontSize: 10, fontWeight: 700 }}>+10</button>
                </div>
              </div>
            );
          })()}

          {/* Scene / Boss intro button */}
          <div style={{ borderTop: `1px solid ${C.border}`, padding: '4px 6px' }}>
            <button onMouseDown={e => {
              e.stopPropagation();
              if (contextMenu.isLibEnemy && contextMenu.libEnemyId !== undefined) {
                const _le = rLibEnemies.current.find(en => en.id === contextMenu.libEnemyId);
                if (_le?.imageData) {
                  const tp = contextMenu.tokenPos ?? null;
                  const _img = new Image(); _img.src = _le.imageData;
                  onTriggerBossIntro({ tokenId: contextMenu.id, bossName: contextMenu.name, portrait: _img, tokenPos: tp });
                  bcRef.current?.postMessage({ type: 'BOSS_INTRO', tokenId: contextMenu.id, bossName: contextMenu.name, tokenPos: tp, portraitDataUrl: _le.imageData });
                  wsRef.current?.send(JSON.stringify({ type: 'BOSS_INTRO', tokenId: contextMenu.id, bossName: contextMenu.name, tokenPos: tp, portraitDataUrl: _le.imageData }));
                  onClose(); return;
                }
              }
              onOpenSceneConfig();
            }}
              style={{ width: '100%', padding: '6px', background: `${C.magic}1e`, border: `1px solid ${C.magic}59`, borderRadius: 5, color: C.magicBright, cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>
              ⚡ Cinematica
            </button>
          </div>
        </>
      )}
    </div>
  );
}
