'use client';
import React from 'react';
import { ENEMY_TEMPLATES } from '@/constants';
import { C } from '@/constants';
import type { LibEnemy, DefeatedMap } from '@/types';

interface Props {
  libEnemies: LibEnemy[];
  defeated: DefeatedMap;
  onAddEnemy: (tmpl: typeof ENEMY_TEMPLATES[number]) => void;
  onRemove: (id: number) => void;
  onToggleVisibility: (id: number) => void;
  onAdjustHp: (id: number, delta: number) => void;
}

export function EnemyLibraryPanel({ libEnemies, defeated, onAddEnemy, onRemove, onToggleVisibility, onAdjustHp }: Props) {
  return (
    <div style={{ padding: '8px' }}>
      <div style={{ fontSize: 10, color: C.dim, letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 700, marginBottom: 6 }}>
        Biblioteca
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3, marginBottom: 8 }}>
        {ENEMY_TEMPLATES.map(tmpl => (
          <button
            key={tmpl.id}
            onClick={() => onAddEnemy(tmpl)}
            style={{
              display: 'flex', alignItems: 'center', gap: 5, padding: '5px 7px',
              background: 'rgba(255,255,255,.04)', border: `1px solid ${C.border}`,
              borderRadius: 5, cursor: 'pointer', color: C.text, fontSize: 11, textAlign: 'left',
            }}
          >
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: tmpl.color, flexShrink: 0 }} />
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tmpl.name}</span>
            <span style={{ color: C.dim, fontSize: 9 }}>{tmpl.hpMax}</span>
          </button>
        ))}
      </div>

      {libEnemies.length > 0 && (
        <>
          <div style={{ fontSize: 10, color: C.dim, letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 700, marginBottom: 6 }}>
            A l&apos;escena ({libEnemies.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {libEnemies.map(en => {
              const hp = en.hp ?? en.hpMax;
              const hpRatio = en.hpMax > 0 ? Math.max(0, hp / en.hpMax) : 0;
              const hpColor = hpRatio > 0.5 ? C.hpHigh : hpRatio > 0.25 ? C.hpMid : C.enemy;
              const isDefeated = !!defeated[`lib_${en.id}`];
              return (
                <div key={en.id} style={{
                  background: 'rgba(255,255,255,.03)', border: `1px solid ${C.border}`,
                  borderRadius: 5, padding: '5px 7px',
                  opacity: (!en.visible || isDefeated) ? 0.5 : 1,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: en.color, flexShrink: 0 }} />
                    <span style={{ flex: 1, fontSize: 11, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{en.name}</span>
                    <button
                      onClick={() => onToggleVisibility(en.id)}
                      title={en.visible ? 'Ocultar' : 'Mostrar'}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: en.visible ? C.dim : '#555', padding: '1px 3px', fontSize: 11 }}
                    >
                      {en.visible ? '👁' : '🚫'}
                    </button>
                    <button
                      onClick={() => onRemove(en.id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f85149', padding: '1px 3px', fontSize: 11 }}
                      title="Treure de l'escena"
                    >
                      ✕
                    </button>
                  </div>
                  {en.hpMax > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                      <button
                        onClick={() => onAdjustHp(en.id, -1)}
                        onContextMenu={e => { e.preventDefault(); onAdjustHp(en.id, -10); }}
                        style={{ flex: 1, padding: '2px 0', background: 'rgba(248,81,73,.12)', border: '1px solid rgba(248,81,73,.3)', borderRadius: 3, cursor: 'pointer', color: '#f85149', fontSize: 10, fontWeight: 700 }}
                      >-1</button>
                      <div style={{ flex: 2, background: 'rgba(0,0,0,.5)', borderRadius: 3, height: 16, position: 'relative', overflow: 'hidden' }}>
                        <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${hpRatio * 100}%`, background: hpColor }} />
                        <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: '#fff', fontWeight: 700 }}>{hp}/{en.hpMax}</span>
                      </div>
                      <button
                        onClick={() => onAdjustHp(en.id, 1)}
                        onContextMenu={e => { e.preventDefault(); onAdjustHp(en.id, 10); }}
                        style={{ flex: 1, padding: '2px 0', background: 'rgba(63,185,80,.12)', border: '1px solid rgba(63,185,80,.3)', borderRadius: 3, cursor: 'pointer', color: '#3fb950', fontSize: 10, fontWeight: 700 }}
                      >+1</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
