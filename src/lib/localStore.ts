/**
 * Magatzem JSON a `localStorage` per a dades que viuen FORA de la partida (el diari de la
 * sessió, la biblioteca de mòduls): han de sobreviure a canviar de mapa, carregar una partida
 * o obrir una missió, que és quan `applySessionState` substitueix tot l'estat de joc.
 *
 * - Una còpia en memòria (`cache`): `getSnapshot` de `useSyncExternalStore` ha de retornar
 *   sempre la MATEIXA referència mentre no canviï res.
 * - Es pot escriure des de qualsevol lloc (hooks, handlers, mòduls de `lib/`) sense passar per
 *   React: `update` notifica els components subscrits.
 * - Sense `localStorage` (mode privat, quota plena) tot continua funcionant en memòria.
 * - Al servidor (i durant la hidratació) el valor és `initial`: llegir `localStorage` al primer
 *   render donaria un error d'hidratació (veure `useStoredFlag`).
 */
import { useSyncExternalStore } from 'react';

export interface JsonStore<T> {
  readonly initial: T;
  get: () => T;
  set: (next: T) => void;
  update: (fn: (cur: T) => T) => void;
  subscribe: (cb: () => void) => () => void;
}

/** `revive` rep el que hi hagi desat (qualsevol cosa) i en torna un valor vàlid; mai ha de llançar. */
export function createJsonStore<T>(key: string, initial: T, revive: (raw: unknown) => T): JsonStore<T> {
  let cache: T | undefined;
  const listeners = new Set<() => void>();
  const get = (): T => {
    if (cache === undefined) {
      let v = initial;
      try {
        const raw = typeof localStorage === 'undefined' ? null : localStorage.getItem(key);
        if (raw) v = revive(JSON.parse(raw));
      } catch { /* desat corrupte o sense localStorage: es comença de zero */ }
      cache = v;
    }
    return cache;
  };
  const set = (next: T) => {
    cache = next;
    try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* es queda en memòria */ }
    listeners.forEach(l => l());
  };
  return {
    initial, get, set,
    update: fn => { const cur = get(); const next = fn(cur); if (next !== cur) set(next); },
    subscribe: cb => { listeners.add(cb); return () => { listeners.delete(cb); }; },
  };
}

export function useJsonStore<T>(s: JsonStore<T>): T {
  return useSyncExternalStore(s.subscribe, s.get, () => s.initial);
}
