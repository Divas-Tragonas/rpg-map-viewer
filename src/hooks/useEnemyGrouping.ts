'use client';
import { useMemo, useSyncExternalStore } from 'react';
import type { EnemyGroupBy, EnemyGroupField } from '@/lib/enemy-groups';

interface Stored {
  by: EnemyGroupBy;
  /** Claus (`groupKey`) dels grups plegats, per a cada camp d'agrupació. */
  collapsed: Record<EnemyGroupField, string[]>;
}

const DEFAULT: Stored = { by: 'project', collapsed: { project: [], category: [] } };

// Còpia en memòria de la preferència: si localStorage no hi és (mode privat, bloquejat),
// plegar i agrupar funcionen igualment mentre la pàgina està oberta.
const memory = new Map<string, string | null>();
const listeners = new Set<() => void>();

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

function snapshot(key: string): string | null {
  if (!memory.has(key)) {
    let raw: string | null = null;
    try { raw = localStorage.getItem(key); } catch { /* sense localStorage */ }
    memory.set(key, raw);
  }
  return memory.get(key) ?? null;
}

function parse(raw: string | null): Stored {
  if (!raw) return DEFAULT;
  try {
    const v = JSON.parse(raw);
    const keys = (x: unknown) => Array.isArray(x) ? x.filter((k): k is string => typeof k === 'string') : [];
    return {
      by: v?.by === 'category' || v?.by === 'none' ? v.by : 'project',
      collapsed: { project: keys(v?.collapsed?.project), category: keys(v?.collapsed?.category) },
    };
  } catch {
    return DEFAULT;
  }
}

/**
 * Com s'agrupen els enemics de la BD i quins grups estan plegats. Es recorda per pantalla
 * (`scope`): la Biblioteca del DM es desmunta cada cop que es canvia de pestanya i, sense
 * desar-ho, tornaria a sortir tot desplegat. `useSyncExternalStore` amb `null` al servidor
 * evita l'error d'hidratació de llegir localStorage durant el primer render.
 */
export function useEnemyGrouping(scope: 'admin' | 'dm') {
  const storageKey = `rpg_enemy_groups_${scope}`;
  const raw = useSyncExternalStore(subscribe, () => snapshot(storageKey), () => null);
  const state = useMemo(() => parse(raw), [raw]);
  const { by, collapsed } = state;

  function save(next: Stored) {
    const json = JSON.stringify(next);
    memory.set(storageKey, json);
    try { localStorage.setItem(storageKey, json); } catch { /* es queda en memòria */ }
    listeners.forEach(l => l());
  }

  function setCollapsed(keys: string[]) {
    if (by !== 'none') save({ ...state, collapsed: { ...collapsed, [by]: keys } });
  }

  return {
    by,
    setBy: (next: EnemyGroupBy) => save({ ...state, by: next }),
    isCollapsed: (key: string) => by !== 'none' && collapsed[by].includes(key),
    toggle: (key: string) => {
      if (by === 'none') return;
      const cur = collapsed[by];
      setCollapsed(cur.includes(key) ? cur.filter(k => k !== key) : [...cur, key]);
    },
    /** Plega tots els grups que es veuen ara (`keys`) o els desplega tots. */
    foldAll: (keys: string[], fold: boolean) => setCollapsed(fold ? keys : []),
  };
}
