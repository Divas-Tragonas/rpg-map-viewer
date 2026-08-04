'use client';
import React, { useEffect, useState } from 'react';
import { ENEMY_TEMPLATES } from '@/constants';
import { C } from '@/constants';
import { api, isApiConfigured } from '@/lib/api';
import type { ApiEnemy } from '@/lib/api';
import type { LibEnemy, DefeatedMap, ConditionsMap } from '@/types';
import { CreatureCard } from '@/components/dm/CreatureCard';

interface Props {
  libEnemies: LibEnemy[];
  defeated: DefeatedMap;
  conditions: ConditionsMap;
  onAddEnemy: (tmpl: typeof ENEMY_TEMPLATES[number]) => void;
  onAddDbEnemy: (enemy: ApiEnemy) => void;
  onRemove: (id: number) => void;
  onToggleVisibility: (id: number) => void;
  onAdjustHp: (id: number, delta: number) => void;
}

export function EnemyLibraryPanel({ libEnemies, defeated, conditions, onAddEnemy, onAddDbEnemy, onRemove, onToggleVisibility, onAdjustHp }: Props) {
  const [dbEnemies, setDbEnemies] = useState<ApiEnemy[]>([]);
  const [dbLoading, setDbLoading] = useState(false);

  useEffect(() => {
    if (!isApiConfigured()) return;
    setDbLoading(true);
    api.enemies.list()
      .then(setDbEnemies)
      .catch(() => {})
      .finally(() => setDbLoading(false));
  }, []);

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

      {isApiConfigured() && (
        <>
          <div style={{ fontSize: 10, color: C.dim, letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 700, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
            Base de dades
            {dbLoading && <span style={{ fontSize: 9, color: C.dim, fontWeight: 400 }}>carregant…</span>}
          </div>
          {!dbLoading && dbEnemies.length === 0 && (
            <div style={{ fontSize: 10, color: C.dim, marginBottom: 8 }}>Cap enemic a la BD</div>
          )}
          {dbEnemies.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3, marginBottom: 8 }}>
              {dbEnemies.map(en => (
                <button
                  key={en.id}
                  onClick={() => onAddDbEnemy(en)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5, padding: '5px 7px',
                    background: 'rgba(255,255,255,.04)', border: `1px solid ${C.border}`,
                    borderRadius: 5, cursor: 'pointer', color: C.text, fontSize: 11, textAlign: 'left',
                  }}
                >
                  <div style={{ width: 12, height: 12, borderRadius: '50%', background: en.color, flexShrink: 0 }} />
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{en.name}</span>
                  <span style={{ color: C.dim, fontSize: 9 }}>{en.hpMax}</span>
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {libEnemies.length > 0 && (
        <>
          <div style={{ fontSize: 10, color: C.dim, letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 700, marginBottom: 6 }}>
            A l&apos;escena ({libEnemies.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {libEnemies.map(en => (
              <CreatureCard
                key={en.id}
                enemy={en}
                conditions={conditions[`lib_${en.id}`] ?? []}
                defeated={!!defeated[`lib_${en.id}`]}
                onRemove={() => onRemove(en.id)}
                onToggleVisibility={() => onToggleVisibility(en.id)}
                onAdjustHp={delta => onAdjustHp(en.id, delta)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
